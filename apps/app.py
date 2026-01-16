import os
from pathlib import Path
import requests
import streamlit as st
import json
from dotenv import load_dotenv
from huggingface_hub import InferenceClient
from PIL import Image, ImageOps  # <--- Vital Import for scaling

# 1. SETUP & CONFIGURATION
load_dotenv()
API_URL = "http://127.0.0.1:8000"
CASES_DIR = Path("data/cases")
HF_TOKEN = os.getenv("HF_TOKEN")

st.set_page_config(
    page_title="MedGemma Consensus",
    page_icon="🧬",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- HELPER FUNCTIONS ---

def format_case_name(dir_name):
    clean_name = dir_name.replace("_", " ").title()
    parts = clean_name.split()
    final_parts = []
    for part in parts:
        if part.isdigit():
            final_parts.append(str(int(part)))
        else:
            final_parts.append(part)
    return " ".join(final_parts)

def resize_for_display(image_path, target_height=500):
    """
    Robust Loader v2:
    Uses ImageOps.pad to ensure EVERY image (tiny or huge) 
    scales to fill the exact same 4:3 frame.
    """
    # 1. Set the fixed canvas size (4:3 Ratio)
    target_width = int(target_height * (4/3))
    
    try:
        img = Image.open(image_path).convert("RGB")
        
        # 2. ImageOps.pad will UPSCALES small images and DOWNSCALES large ones
        # to fit perfectly within the box while keeping aspect ratio.
        new_img = ImageOps.pad(
            img, 
            (target_width, target_height), 
            method=Image.Resampling.LANCZOS, 
            color=(0, 0, 0), 
            centering=(0.5, 0.5)
        )
        return new_img
        
    except Exception:
        # Fallback: Return a blank black box of the EXACT same size
        return Image.new('RGB', (target_width, target_height), color=(20, 20, 20))

def ask_medgemma_live(context_json: dict, user_question: str) -> str:
    # OLLAMA CONFIG
    OLLAMA_URL = "http://localhost:11434/api/chat"
    MODEL_NAME = "gemma2:9b"
    
    lightweight_context = {
        "discrepancy_score": context_json.get("discrepancy_alert", {}).get("score"),
        "alert_summary": context_json.get("discrepancy_alert", {}).get("summary"),
        "agents": []
    }
    
    for agent in context_json.get("agent_reports", []):
        claims = [f"{c['value']} ({c['confidence']:.2f})" for c in agent.get("claims", [])]
        desc = agent.get("visual_description", "")
        lightweight_context["agents"].append({
            "role": agent["agent_name"],
            "findings": claims,
            "description": desc
        })

    system_prompt = (
        "You are MedGemma, a senior clinical consultant. "
        "Answer the doctor's questions concisely based on the provided context."
    )

    try:
        payload = {
            "model": MODEL_NAME,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Context: {json.dumps(lightweight_context)}\nQuestion: {user_question}"}
            ],
            "stream": False
        }
        
        response = requests.post(OLLAMA_URL, json=payload)
        if response.ok:
            return response.json()['message']['content']
        else:
            return f"Error: {response.text}"
            
    except Exception as e:
        return f"Connection Error (Is Ollama running?): {e}"
# 2. CUSTOM CSS
st.markdown("""
    <style>
    .stApp { background-color: #0E1117; }
    
    /* Uniform container boxes */
    div[data-testid="stVerticalBlockBorderWrapper"] {
        background-color: #161B22;
        border: 1px solid #30363D;
        border-radius: 8px;
    }
    
    /* Metrics */
    div[data-testid="stMetric"] {
        background-color: #0D1117;
        padding: 10px;
        border-radius: 6px;
        border: 1px solid #21262D;
    }
    
    /* Buttons */
    div.stButton > button {
        background-color: #238636;
        color: white;
        border: 1px solid rgba(240,246,252,0.1);
    }
    div.stButton > button:hover {
        background-color: #2EA043;
    }
    </style>
    """, unsafe_allow_html=True)

# 3. SIDEBAR
with st.sidebar:
    st.title("🧬 MedGemma")
    st.caption("Consensus Board v2.1")
    st.markdown("---")
    
    if not CASES_DIR.exists():
        st.error("❌ Data folder missing.")
        st.stop()

    case_ids = sorted([p.name for p in CASES_DIR.iterdir() if p.is_dir()])
    selected_case_dir = st.selectbox("Select Patient Case", case_ids, format_func=format_case_name)
    
    note_path = CASES_DIR / selected_case_dir / "note.txt"
    note_default = note_path.read_text(encoding="utf-8") if note_path.exists() else "No note found."
    
    st.markdown("### Clinical Context")
    note = st.text_area("Live Notes", height=150, value=note_default)
    
    st.markdown("---")
    run_btn = st.button("RUN PROTOCOL", use_container_width=True)
    if st.button("Clear Session", use_container_width=True):
        st.session_state.pop('analysis_result', None)
        st.rerun()

# 4. MAIN DASHBOARD

# A. Header
st.header(f"Currently Viewing: {format_case_name(selected_case_dir)}")

# B. Logic Processing
if run_btn:
    with st.spinner("🔄 Synthesizing Consensus..."):
        try:
            payload = {"case_id": selected_case_dir, "clinical_note_text": note}
            resp = requests.post(f"{API_URL}/run", json=payload, timeout=60)
            if resp.ok:
                st.session_state['analysis_result'] = resp.json()
            else:
                st.error(f"API Error: {resp.text}")
        except Exception as e:
            st.error(f"Connection Error: {e}")

has_results = 'analysis_result' in st.session_state
out = st.session_state['analysis_result'] if has_results else None

# C. Top Status Row (Conditional)
if has_results:
    alert = out["discrepancy_alert"]
    m1, m2, m3 = st.columns([1, 1, 2])
    with m1: st.metric("Risk Score", f"{alert['score']:.2f}", delta="High" if alert['score']>0.7 else "Low", delta_color="inverse")
    with m2: st.metric("Discrepancy Status", alert['level'].upper())
    with m3: st.info(f"**Consensus Verdict:** {alert['summary']}")
else:
    # Placeholder status when nothing has run
    st.info("Click 'RUN PROTOCOL' to begin AI analysis.")

st.markdown("---")

# D. PATIENT DATA GRID (Always Visible)
# We use [2, 1, 1] to give the Image 50% width
c_img, c_audio, c_hist = st.columns([2, 1, 1])

# 1. IMAGING (Visual Agent)
with c_img:
    with st.container(border=True):
        st.markdown("#### 🖼️ Imaging")
        
        # --- A. ALWAYS SHOW IMAGE (Raw Data) ---
        possible_files = ["xray.jpg", "xray.jpeg", "xray.png", "image_current.jpg"]
        found_path = None
        for fname in possible_files:
            p = Path(f"artifacts/runs/{selected_case_dir}/{fname}").resolve()
            if p.exists():
                found_path = str(p)
                break
        
        if found_path:
            # New Resize Function guarantees size
            display_img = resize_for_display(found_path, target_height=450)
            st.image(display_img, use_container_width=True)
        else:
            # Placeholder for missing file
            placeholder = Image.new('RGB', (600, 450), color=(20, 20, 20))
            st.image(placeholder, caption="[No Imaging Data Artifact]", use_container_width=True)

        # --- B. SHOW AI RESULTS (If available) ---
        if has_results:
            agent = next((a for a in out["agent_reports"] if a["agent_name"] == "imaging"), None)
            st.divider()
            st.caption("🤖 **MedSigLIP/PaliGemma Analysis**")
            if agent and "visual_description" in agent and agent["visual_description"]:
                st.info(agent["visual_description"])
            elif agent:
                st.metric("Finding", agent['claims'][0]['value'])
        else:
            st.caption("Waiting for analysis...")

# 2. ACOUSTICS (Audio Agent)
with c_audio:
    with st.container(border=True):
        st.markdown("#### 🔊 Audio")
        st.markdown("<br>", unsafe_allow_html=True)
        
        # --- A. ALWAYS SHOW PLAYER ---
        audio_path = Path(f"artifacts/runs/{selected_case_dir}/audio.wav")
        if audio_path.exists():
            st.audio(str(audio_path))
        else:
            st.warning("No Audio File")

        # --- B. SHOW AI RESULTS ---
        if has_results:
            st.divider()
            st.caption("🤖 **HeAR Analysis**")
            agent = next((a for a in out["agent_reports"] if a["agent_name"] == "acoustics"), None)
            if agent and agent['claims']:
                val = agent['claims'][0]['value']
                st.metric("Class", val)
                st.progress(agent['claims'][0]['confidence'], text="Confidence")
        else:
            st.markdown("<br><br>", unsafe_allow_html=True)
            st.caption("Waiting for analysis...")

# 3. HISTORY (History Agent)
with c_hist:
    with st.container(border=True):
        st.markdown("#### 📜 History")
        st.markdown("<br>", unsafe_allow_html=True)
        
        # --- A. ALWAYS SHOW SNIPPET ---
        st.text_area("Raw", value=note_default, height=100, disabled=True, label_visibility="collapsed")

        # --- B. SHOW AI RESULTS ---
        if has_results:
            st.divider()
            st.caption("🤖 **MedGemma Extraction**")
            agent = next((a for a in out["agent_reports"] if a["agent_name"] == "history"), None)
            if agent and agent['claims']:
                for c in agent['claims'][:3]:
                    st.markdown(f"• **{c['value']}**")
        else:
             st.markdown("<br><br>", unsafe_allow_html=True)
             st.caption("Waiting for analysis...")

# E. CHAT SECTION (Conditional)
if has_results:
    st.markdown("---")
    st.markdown("### 💬 Consultant Interface")
    
    if "messages" not in st.session_state:
        st.session_state.messages = []

    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    if prompt := st.chat_input("Ask about the discrepancy..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                response = ask_medgemma_live(out, prompt)
                st.markdown(response)
        st.session_state.messages.append({"role": "assistant", "content": response})