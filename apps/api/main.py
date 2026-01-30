import os
import json
import re
import ast
import requests
from dotenv import load_dotenv
import ollama
from fastapi.middleware.cors import CORSMiddleware
import shutil  # Added for file saving
from fastapi import FastAPI, UploadFile, File, Form  # Added UploadFile, File, Form
from typing import Dict, Any, Optional
import httpx
import asyncio
from fastapi.responses import StreamingResponse
import sys
from pathlib import Path
from fastapi import HTTPException
from fastapi.staticfiles import StaticFiles





from consensus_board.schemas.contracts import (
    CaseInput,
    ConsensusOutput,
    DiscrepancyAlert,
    AgentReport,
    Claim,
    VisionReport
)

# 1. LOAD ENVIRONMENT VARIABLES
load_dotenv()

app = FastAPI(title="Consensus Board API", version="0.5.0 (MedGemma-Native)")

# --- CORS CONFIGURATION ---
# Define the origins that are allowed to make requests to this API
origins = [
    "http://localhost:3000",    
    "http://127.0.0.1:3000",
    "https://momo-clinical-msaf9zbyy-maniyas-projects.vercel.app",
    "https://momo-clinical.vercel.app", 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Suggested-Filename"] # Helpful for file handling
)



# --------------------------

API_URL = os.getenv("API_URL")

# -----------------------------
# NEW: UPLOAD ENDPOINT
# -----------------------------
@app.post("/upload/{case_id}")
async def upload_case_artifacts(
    case_id: str, 
    xray: UploadFile = File(None), 
    audio: UploadFile = File(None)
):
    """
    Saves uploaded files to the local disk so agents can find them.
    Path: artifacts/runs/{case_id}/xray.jpg (or audio.wav)
    """
    target_dir = f"artifacts/runs/{case_id}"
    os.makedirs(target_dir, exist_ok=True)

    # Save X-Ray
    if xray:
        file_location = os.path.join(target_dir, "xray.jpg")
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(xray.file, file_object)

    # Save Audio
    if audio:
        file_location = os.path.join(target_dir, "audio.wav")
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(audio.file, file_object)

    return {"message": "Files cached successfully", "case_id": case_id}



# 1. Define your base artifacts directory relative to main.py
BASE_DIR = Path(__file__).resolve().parent.parent.parent # Adjust based on your folder depth
ARTIFACTS_DIR = BASE_DIR / "artifacts" / "runs"

ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

# This makes every file in artifacts/runs accessible via your-api-url.com/view-artifacts/...
app.mount("/view-artifacts", StaticFiles(directory=str(ARTIFACTS_DIR)), name="artifacts")

@app.get("/debug/artifacts/{case_id}")
async def list_case_artifacts(case_id: str):
    case_path = ARTIFACTS_DIR / case_id
    
    if not case_path.exists():
        raise HTTPException(status_code=404, detail=f"No artifacts found for case: {case_id}")
        
    # Walk the directory and list files
    files = []
    for file in case_path.iterdir():
        if file.is_file():
            files.append({
                "name": file.name,
                "size_kb": round(file.stat().st_size / 1024, 2),
                "url": f"/view-artifacts/{case_id}/{file.name}" # Link to the static mount below
            })
            
    return {
        "case_id": case_id,
        "location": str(case_path),
        "files": files
    }

# -----------------------------
# HELPER: ROBUST JSON PARSER
# -----------------------------


def extract_json(text: str) -> Dict[str, Any]:
    if not text:
        return {"score": 0.5, "reasoning": "Empty input", "recommendation": "Review"}

    # 1. Clean common LLM formatting errors
    cleaned = text.replace("```json", "").replace("```", "").strip()

    # 2. Try to find the boundaries of the JSON object
    start = cleaned.find("{")
    end = cleaned.rfind("}")

    if start == -1 or end == -1:
        return {"score": 0.5, "reasoning": "JSON boundaries not found", "recommendation": "Review"}

    json_str = cleaned[start:end+1]

    # 3. Attempt Standard Parse
    try:
        return json.loads(json_str)
    except Exception:
        # 4. Fallback: Repair single quotes and common trailing commas
        try:
            # Replace single quotes with double quotes
            repaired = json_str.replace("'", '"')
            # Remove trailing commas before closing braces
            repaired = re.sub(r",\s*}", "}", repaired)
            return json.loads(repaired)
        except Exception:
            # 5. Last Resort: Regex Extraction
            try:
                score_match = re.search(r'"score":\s*(\d?\.\d+)', json_str)
                reason_match = re.search(r'"reasoning":\s*"(.*?)"', json_str)
                rec_match = re.search(r'"recommendation":\s*"(.*?)"', json_str)

                return {
                    "score": float(score_match.group(1)) if score_match else 0.5,
                    "reasoning": reason_match.group(1) if reason_match else "Regex recovery",
                    "recommendation": rec_match.group(1) if rec_match else "Manual Review"
                }
            except:
                return {"score": 0.5, "reasoning": "Total parse failure", "recommendation": "Manual Review"}
    
def _extract_tag(text: str, tag: str) -> str:
        m = re.search(fr"<{tag}>(.*?)</{tag}>", text, flags=re.S)
        return m.group(1).strip() if m else ""

# -----------------------------
# 1) LOCAL AGENTS (Gemma-2-2B)
# -----------------------------


async def extract_history_with_medgemma(client: httpx.AsyncClient, note_text: str) -> AgentReport:
    """
    Asynchronous Context Agent: Translates clinical notes into structured profiles
    concurrently with other diagnostic streams.
    """
    print(f"  [📄 CONTEXT START] Analyzing clinical notes...")
    
    try:
        # 1. ASYNC INFERENCE
        # Using AsyncClient ensures the CPU/GPU work on the local model 
        # allows the event loop to still handle network IO for other agents.
        client = ollama.AsyncClient()
        response = await client.chat(
            model='koesn/llama3-openbiollm-8b',
            messages=[
                {
                    'role': 'system', 
                    'content': (
                        "You are a Clinical Data Extractor. Extract findings into: "
                        "[ACTIVE], [BASELINE], [RISK], [NEGATION]. \n"
                        "Search specifically for symptoms (e.g., weight loss, fever, cough). "
                        "Format: '[CATEGORY] Finding'. Example: ['[ACTIVE] 102F fever']"
                    )
                },
                {'role': 'user', 'content': f"Extract: {note_text}"}
            ],
            format='json',
        )
        
        raw_data = json.loads(response['message']['content'])

        print('Patient history findings : ' , raw_data)
        findings = []

        # 2. ROBUST PARSING (Same logic as before)
        if isinstance(raw_data, list):
            findings = raw_data
        elif isinstance(raw_data, dict):
            for cat, val in raw_data.items():
                if isinstance(val, list):
                    for v in val: findings.append(f"[{cat.upper()}] {v}")
                else:
                    findings.append(f"[{cat.upper()}] {val}")

        # 3. DEDUPLICATION & CLEANUP
        valid_prefixes = ["[ACTIVE]", "[BASELINE]", "[RISK]", "[NEGATION]"]
        final_claims = []
        
        for f in findings:
            f_str = str(f).strip()
            if any(f_str.startswith(p) for p in valid_prefixes):
                for p in valid_prefixes:
                    double_p = f"{p} {p}"
                    if f_str.startswith(double_p):
                        f_str = f_str.replace(double_p, p, 1)
                
                if len(f_str) > 10:
                    final_claims.append(f_str)

        # 4. SIGNALING STATUS
        if not final_claims:
            print(f"  [⚠️  CONTEXT WARNING] No entities extracted. Manual review flagged.")
            return AgentReport(
                agent_name="history",
                model="OpenBioLLM-8B (Local)",
                claims=[
                    Claim(
                        label="extraction_status", 
                        value="[SYSTEM] Manual History Review Required - No findings extracted.", 
                        confidence=0.0  
                    )
                ],
                uncertainties=["Local extraction failed to identify clinical entities."]
            )

        print(f"  [✅ CONTEXT SUCCESS] Extracted {len(final_claims)} clinical entities.")
        return AgentReport(
            agent_name="history",
            model="OpenBioLLM-8B (Local)",
            claims=[Claim(label="finding", value=f, confidence=0.9) for f in final_claims]
        )
        
    except Exception as e:
        print(f"  [💥 CONTEXT CRASH] Exception: {str(e)}")
        return AgentReport(
            agent_name="history", 
            model="Error", 
            claims=[Claim(label="error", value=f"Service Offline: {str(e)}", confidence=0.0)]
        )

# -----------------------------
# 2) CLOUD AGENTS (MedGemma 4B / HeAR)
# -----------------------------

async def call_vision_agent(client: httpx.AsyncClient, case_id: str, note_text: str):
    """
    Dispatches clinical note and streams agentic reasoning tokens.
    Uses detailed error reporting to diagnose connection issues.
    """
    print(f"\n[🚀 START] Agentic Vision Loop | Case: {case_id}")
    image_path = f"artifacts/runs/{case_id}/xray.jpg"

    if not os.path.exists(image_path):
        yield json.dumps({"type": "error", "message": "Image artifact missing on local server"})
        return

    try:
        # Check if API_URL exists
        if not API_URL:
            yield json.dumps({"type": "error", "message": "API_URL missing in .env file"})
            return

        payload = {"context_hint": f"Clinical History: {note_text}"}
        
        with open(image_path, "rb") as img_file:
            files = {"image": ("xray.jpg", img_file, "image/jpeg")}
            
            # Use a fresh client instance with specific settings for tunnels
            async with httpx.AsyncClient(timeout=None, verify=False) as streaming_client:
                async with streaming_client.stream(
                    "POST", 
                    f"{API_URL}/agent/vision", 
                    data=payload, 
                    files=files
                ) as response:
                    
                    if response.status_code != 200:
                        error_body = await response.aread()
                        error_text = error_body.decode()
                        yield json.dumps({"type": "error", "message": f"Colab rejected ({response.status_code}): {error_text}"})
                        return

                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            yield line.replace("data: ", "").strip()
                        elif line.strip():
                            # Wrap raw text chunks as thoughts
                            yield json.dumps({"type": "thought", "delta": line})

        print(f"[✅ SUCCESS] Vision streaming finished for {case_id}\n")

    except httpx.ConnectError:
        yield json.dumps({"type": "error", "message": "Connection Refused. Is ngrok running on Colab?"})
    except Exception as e:
        # Use repr(e) to get the specific class of the error (e.g., Timeout, DNS error)
        error_detail = repr(e)
        print(f"[💥 BRIDGE CRASH] {error_detail}")
        yield json.dumps({"type": "error", "message": f"Vision Stream Bridge Failed: {error_detail}"})

    except Exception as e:
        print(f"[💥 CRASH] Agentic Loop Failure: {str(e)}")
        yield json.dumps({"type": "error", "message": f"Vision Stream Error: {str(e)}"})


async def call_audio_agent(client: httpx.AsyncClient, case_id: str) -> AgentReport:
    """
    Asynchronous Audio Agent: Analyzes bio-acoustic signatures (HeAR) 
    in parallel with other diagnostic streams.
    """
    print(f"  [🎤 AUDIO START] Processing Case: {case_id}")
    audio_path = f"artifacts/runs/{case_id}/audio.wav"
    
    if not os.path.exists(audio_path):
        print(f"  [❌ AUDIO ERROR] Audio file missing: {audio_path}")
        return AgentReport(
            agent_name="acoustics", 
            model="Error", 
            claims=[Claim(label="error", value="File missing", confidence=0.0)]
        )

    try:
        if not API_URL: 
            raise ValueError("API_URL is missing in .env")

        print(f"  [☁️  CLOUD REQUEST] Dispatching to HeAR Acoustic Endpoint (Async)...")
        
        # Async file handling with httpx
        files = {"file": ("audio.wav", open(audio_path, "rb"), "audio/wav")}
        
        response = await client.post(
            f"{API_URL}/agent/audio", 
            files=files, 
            timeout=300.0
        )
        response.raise_for_status()
        
        data = response.json()
        
        # --- THE FIX: SAFETY CLAMPING ---
        # Ensures confidence is always within [0.0, 1.0] for Pydantic validation
        raw_confidence = data.get("confidence", 0.0)
        safe_confidence = max(0.0, min(1.0, float(raw_confidence)))

        print(f"  [✅ AUDIO SUCCESS] Acoustic classification: {data.get('prediction', 'unknown')}")

        return AgentReport(
            agent_name="acoustics",
            model="HeAR (Cloud)",
            claims=[
                Claim(
                    label="classification", 
                    value=data.get("prediction", "unknown"), 
                    confidence=safe_confidence 
                )
            ]
        )
    except Exception as e:
        print(f"  [💥 AUDIO CRASH] Exception: {str(e)}")
        return AgentReport(
            agent_name="acoustics", 
            model="Offline", 
            claims=[Claim(label="error", value=str(e), confidence=0.0)]
        )

# -----------------------------
# 3) UPDATED CLOUD CONSENSUS (main.py)
# -----------------------------
async def call_cloud_consensus(case_id: str, imaging_txt: str, audio_txt: str, history_txt: str):
    image_path = f"artifacts/runs/{case_id}/xray.jpg"
    
    if not os.path.exists(image_path):
        yield json.dumps({"type": "error", "message": "Image Missing"})
        return

    payload = {
        "imaging_text": imaging_txt,
        "audio_text": audio_txt,
        "history_text": history_txt
    }

    try:
        async with httpx.AsyncClient(timeout=None,  verify=False) as client:
            with open(image_path, "rb") as f:
                files = {"image": ("xray.jpg", f, "image/jpeg")}
                
                # 🟢 Use client.stream to pipe word-by-word thoughts to the UI
                async with client.stream(
                    "POST", 
                    f"{API_URL}/agent/consensus", 
                    data=payload, 
                    files=files
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            yield line.replace("data: ", "").strip()
    except Exception as e:
        yield json.dumps({"type": "error", "message": f"Cloud Adjudicator Bridge Failed: {str(e)}"})

# -----------------------------
# 4) MAIN FLOW
# -----------------------------

# In backend_brains_Phase_2.ipynb - Update the stream_protocol function:

# @app.post("/run")
# async def run_case(case: CaseInput):
#     async def stream_protocol():
#         target_dir = f"artifacts/runs/{case.case_id}"
#         image_path = os.path.join(target_dir, "xray.jpg")
#         audio_path = os.path.join(target_dir, "audio.wav")

#         # Convert image to base64
#         image_base64 = None
#         if os.path.exists(image_path):
#             import base64
#             with open(image_path, "rb") as img_file:
#                 image_base64 = base64.b64encode(img_file.read()).decode('utf-8')

#         # Read audio if exists
#         audio_bytes = None
#         if os.path.exists(audio_path):
#             with open(audio_path, "rb") as aud_file:
#                 audio_bytes = aud_file.read()

#         payload = {
#             "history": json.dumps([{"role": "user", "content": case.clinical_note_text}]),
#             "image_base64": image_base64,  # Send as string
#             "has_audio": audio_bytes is not None
#         }

#         try:
#             async with httpx.AsyncClient(timeout=None) as client:
#                 # Send as JSON, not multipart
#                 async with client.stream(
#                     "POST", 
#                     f"{API_URL}/consensus", 
#                     json=payload,  # Changed from data= and files=
#                 ) as response:
#                     async for line in response.aiter_lines():
#                         if line.startswith("data: "):
#                             yield f"{line}\n\n"
#                         elif line.strip():
#                             yield f"data: {json.dumps({'type': 'thought', 'delta': line})}\n\n"

#         except Exception as e:
#             yield f"data: {json.dumps({'type': 'error', 'message': f'Gateway Error: {str(e)}'})}\n\n"

#     return StreamingResponse(stream_protocol(), media_type="text-event-stream")

# @app.post("/run")
# async def run_case(case: CaseInput):
#     async def stream_protocol():
#         target_dir = f"artifacts/runs/{case.case_id}"
#         image_path = os.path.join(target_dir, "xray.jpg")
#         audio_path = os.path.join(target_dir, "audio.wav")

#         opened_files = []
#         try:
#             # 1. Initialize the payloads BEFORE the stream call 
#             files_payload = {}
#             if os.path.exists(image_path):
#                 f_img = open(image_path, "rb")
#                 opened_files.append(f_img)
#                 files_payload["image"] = ("vision.jpg", f_img, "image/jpeg")
            
#             if os.path.exists(audio_path):
#                 f_aud = open(audio_path, "rb")
#                 opened_files.append(f_aud)
#                 files_payload["audio"] = ("audio.wav", f_aud, "audio/wav")

#             # Define 'payload' here so it is available for the next line
#             payload = {
#                 "history": json.dumps([{"role": "user", "content": case.clinical_note_text}])
#             }

#             # 2. Start the stream to Google Colab
#             async with httpx.AsyncClient(timeout=None) as client:
#                 async with client.stream(
#                     "POST", 
#                     f"{API_URL}/consensus", 
#                     data=payload,  # 'payload' is now defined!
#                     files=files_payload
#                 ) as response:
                    
#                     async for line in response.aiter_lines():
#                         if not line.strip() or not line.startswith("data: "):
#                             continue
                        
#                         try:
#                             # Parse the JSON from the Colab Blackboard 
#                             colab_data = json.loads(line[6:])
#                             msg = colab_data.get("message", "")

#                             # Handle word-by-word streaming ("ChatGPT style")
#                             if colab_data.get("type") == "thought":
#                                 token = colab_data.get("delta", "")
#                                 yield f"data: {json.dumps({'type': 'thought', 'delta': token})}\n\n"
                            
#                             elif ">>" in msg:
#                                 token = msg.split(">>")[-1]
#                                 yield f"data: {json.dumps({'type': 'thought', 'delta': token})}\n\n"

#                             # Handle status updates
#                             elif "STATUS:" in msg or colab_data.get("type") == "status":
#                                 clean_status = msg.replace("STATUS:", "").strip()
#                                 yield f"data: {json.dumps({'type': 'status', 'message': clean_status})}\n\n"

#                             # Handle the final clinical diagnosis
#                             elif colab_data.get("type") == "final":
#                                 yield f"{line}\n\n"

#                         except Exception:
#                             continue

#         except Exception as e:
#             print(f"💥 Gateway Error: {str(e)}")
#             yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
#         finally:
#             # Clean up local file pointers
#             for f in opened_files:
#                 f.close()

#     return StreamingResponse(stream_protocol(), media_type="text-event-stream")

# ============================================================================
# UPDATED VS CODE GATEWAY ENDPOINT
# Handles new moderator-driven blackboard data structures
# ============================================================================

@app.post("/run")
async def run_case(case: CaseInput):
    """
    Main endpoint that streams blackboard orchestration to UI
    """
    
    # Helper functions defined at module level (outside the async generator)
    def format_agent_reports(agent_reports: list) -> list:
        """Format agent reports for better UI display"""
        formatted = []
        
        for report in agent_reports:
            agent_name = report.get("agent", "Unknown")
            status = report.get("status", "unknown")
            observation = report.get("observation", "")
            claims = report.get("claims", [])
            execution_time = report.get("execution_time", 0)
            error = report.get("error")
            metadata = report.get("metadata", {})  # ✅ EXTRACT METADATA
            
            formatted_report = {
                "agent": agent_name,
                "status": status,
                "observation": observation,
                "execution_time": f"{execution_time:.2f}s",
                "claims_count": len(claims),
                "claims": claims,
                "icon": get_agent_icon(agent_name),
                "success": status == "completed",
                "metadata": metadata  # ✅ INCLUDE METADATA IN OUTPUT
            }
            
            if error:
                formatted_report["error"] = error
            
            formatted.append(formatted_report)
        
        return formatted
    
    def get_agent_icon(agent_name: str) -> str:
        """Get emoji icon for agent"""
        icons = {
            "AudioAgent": "🎤",
            "VisionAgent": "👁️",
            "LeadClinician": "🧠"
        }
        return icons.get(agent_name, "🤖")
    
    async def stream_protocol():
        target_dir = f"artifacts/runs/{case.case_id}"
        image_path = os.path.join(target_dir, "xray.jpg")
        audio_path = os.path.join(target_dir, "audio.wav")

        opened_files = []
        try:
            # 1. Initialize the payloads
            files_payload = {}
            if os.path.exists(image_path):
                f_img = open(image_path, "rb")
                opened_files.append(f_img)
                files_payload["image"] = ("vision.jpg", f_img, "image/jpeg")
            
            if os.path.exists(audio_path):
                f_aud = open(audio_path, "rb")
                opened_files.append(f_aud)
                files_payload["audio"] = ("audio.wav", f_aud, "audio/wav")

            payload = {
                "history": json.dumps([{"role": "user", "content": case.clinical_note_text}])
            }

            # 2. Stream from Google Colab Blackboard
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream(
                    "POST", 
                    f"{API_URL}/consensus", 
                    data=payload,
                    files=files_payload
                ) as response:
                    
                    async for line in response.aiter_lines():
                        if not line.strip() or not line.startswith("data: "):
                            continue
                        
                        try:
                            # Parse the JSON from the Colab Blackboard
                            colab_data = json.loads(line[6:])
                            data_type = colab_data.get("type", "")
                            
                            # ============================================================
                            # Handle moderator status updates
                            # ============================================================
                            if data_type == "status":
                                msg = colab_data.get("message", "")
                                board_snapshot = colab_data.get("board_snapshot", {})
                                
                                kb_size = board_snapshot.get("kb_size", 0)
                                status = board_snapshot.get("status", "")
                                focus_areas = board_snapshot.get("focus_areas", [])
                                
                                clean_msg = msg.replace("STATUS:", "").strip()
                                
                                yield f"data: {json.dumps({'type': 'status', 'message': clean_msg, 'metadata': {'findings_count': kb_size, 'state': status, 'focus_areas': focus_areas}})}\n\n"
                            
                            # ============================================================
                            # Handle agent-specific updates
                            # ============================================================
                            elif "Iteration" in colab_data.get("message", ""):
                                msg = colab_data.get("message", "")
                                
                                if "Dispatching" in msg:
                                    agent_name = msg.split("Dispatching")[-1].strip().rstrip("...")
                                    yield f"data: {json.dumps({'type': 'agent_start', 'agent': agent_name, 'message': f'🔄 {agent_name} analyzing...'})}\n\n"
                                else:
                                    yield f"data: {json.dumps({'type': 'status', 'message': msg})}\n\n"
                            
                            elif "completed" in colab_data.get("message", "").lower():
                                msg = colab_data.get("message", "")
                                agent_name = msg.split()[1] if len(msg.split()) > 1 else "Agent"
                                yield f"data: {json.dumps({'type': 'agent_complete', 'agent': agent_name, 'message': f'✅ {agent_name} complete'})}\n\n"
                            
                            # ============================================================
                            # Handle thought process streaming
                            # ============================================================
                            elif data_type == "thought":
                                token = colab_data.get("delta", "")
                                yield f"data: {json.dumps({'type': 'thought', 'delta': token})}\n\n"
                            
                            elif ">>" in colab_data.get("message", ""):
                                token = colab_data.get("message", "").split(">>")[-1]
                                yield f"data: {json.dumps({'type': 'thought', 'delta': token})}\n\n"
                            
                            # ============================================================
                            # Enhanced final result handling
                            # ============================================================
                            elif data_type == "final":
                                parsed = colab_data.get("parsed", {})
                                audit_trail = colab_data.get("audit_trail", [])
                                agent_reports = colab_data.get("agent_reports", [])
                                raw_logic = colab_data.get("raw_logic", "")
                                
                                enhanced_final = {
                                    "type": "final",
                                    "parsed": {
                                        "condition": parsed.get("condition", "Undetermined"),
                                        "confidence": parsed.get("confidence", 0),
                                        "diagnosis": parsed.get("diagnosis", ""),
                                        "reasoning": parsed.get("reasoning", ""),
                                        "differential_diagnosis": parsed.get("differential_diagnosis", []),
                                        "consensus_summary": parsed.get("consensus_summary", "")
                                    },
                                    "audit_trail": audit_trail,
                                    "agent_reports": format_agent_reports(agent_reports),
                                    "raw_logic": raw_logic,
                                    "metadata": {
                                        "total_agents": len(agent_reports),
                                        "successful_agents": len([r for r in agent_reports if r.get("status") == "completed"]),
                                        "execution_times": {r.get("agent", ""): r.get("execution_time", 0) for r in agent_reports}
                                    }
                                }
                                
                                yield f"data: {json.dumps(enhanced_final)}\n\n"
                            
                            # ============================================================
                            # Fallback: pass through other messages
                            # ============================================================
                            else:
                                yield f"{line}\n\n"

                        except json.JSONDecodeError:
                            continue
                        except Exception as e:
                            print(f"⚠️ Error processing line: {e}")
                            continue

        except Exception as e:
            print(f"💥 Gateway Error: {str(e)}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            for f in opened_files:
                f.close()
    
    return StreamingResponse(stream_protocol(), media_type="text/event-stream")