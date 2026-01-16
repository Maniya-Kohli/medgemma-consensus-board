import os
from pathlib import Path
import requests
import streamlit as st
import json
import re
from dotenv import load_dotenv
from PIL import Image, ImageOps

# -----------------------------
# 1) SETUP & CONFIG
# -----------------------------
load_dotenv()

API_URL = "http://127.0.0.1:8000"
CASES_DIR = Path("data/cases")

st.set_page_config(
    page_title="MedGemma Consensus",
    page_icon="🧬",
    layout="wide",
    initial_sidebar_state="expanded",
)

# -----------------------------
# 2) JSON + TEXT HELPERS
# -----------------------------
def safe_float(x, default=0.0):
    try:
        if x is None:
            return default
        if isinstance(x, str):
            x = x.strip().replace("%", "")
        return float(x)
    except Exception:
        return default

def score_to_level(score: float) -> str:
    if score >= 0.70:
        return "high"
    if score >= 0.40:
        return "medium"
    return "low"

def extract_first_valid_json_object(text: str):
    """
    Extract ONE valid JSON object from messy text.
    Handles multiple JSON blocks by parsing candidates until one succeeds.
    """
    if not text or not isinstance(text, str):
        return None

    # Candidate scan (non-greedy)
    candidates = re.findall(r"\{.*?\}", text, flags=re.DOTALL)
    for c in candidates:
        c2 = c.replace("“", '"').replace("”", '"').replace("’", "'")
        try:
            obj = json.loads(c2)
            if isinstance(obj, dict):
                return obj
        except Exception:
            continue

    # Brace-balance fallback (for nested braces)
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(text)):
        ch = text[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                chunk = text[start : i + 1]
                chunk = chunk.replace("“", '"').replace("”", '"').replace("’", "'")
                try:
                    obj = json.loads(chunk)
                    if isinstance(obj, dict):
                        return obj
                except Exception:
                    return None
    return None

def normalize_consensus(out: dict) -> dict:
    """
    Stable output for UI:
      {
        score, level,
        reasoning, recommendation,
        ok (bool), error (str)
      }
    No raw dumping into UI.
    """
    base = {
        "score": 0.0,
        "level": "low",
        "reasoning": "",
        "recommendation": "",
        "ok": False,
        "error": "No consensus available yet.",
    }

    if not out or not isinstance(out, dict):
        return base

    # Prefer parsed object if your server returns it:
    consensus = out.get("consensus") or out.get("moderator") or {}
    parsed = consensus.get("parsed") if isinstance(consensus, dict) else None
    if isinstance(parsed, dict) and "score" in parsed:
        score = safe_float(parsed.get("score"), 0.0)
        return {
            "score": score,
            "level": score_to_level(score),
            "reasoning": str(parsed.get("reasoning", "") or ""),
            "recommendation": str(parsed.get("recommendation", "") or ""),
            "ok": True,
            "error": "",
        }

    # Try parsing JSON from any "raw_response" style fields (but DO NOT show raw)
    raw_sources = []
    if isinstance(consensus, dict):
        raw_sources += [consensus.get("raw_response"), consensus.get("raw")]
    raw_sources += [out.get("raw_response"), out.get("raw")]

    # Some servers put raw into discrepancy_alert.summary (unfortunate but common)
    da = out.get("discrepancy_alert")
    if isinstance(da, dict):
        raw_sources.append(da.get("summary"))

    raw_text = "\n\n".join([s for s in raw_sources if isinstance(s, str) and s.strip()])
    obj = extract_first_valid_json_object(raw_text)
    if isinstance(obj, dict) and "score" in obj:
        score = safe_float(obj.get("score"), 0.0)
        return {
            "score": score,
            "level": score_to_level(score),
            "reasoning": str(obj.get("reasoning", "") or ""),
            "recommendation": str(obj.get("recommendation", "") or ""),
            "ok": True,
            "error": "",
        }

    # Fallback to discrepancy_alert score if exists, but content not parseable
    if isinstance(da, dict) and "score" in da:
        score = safe_float(da.get("score"), 0.0)
        return {
            "score": score,
            "level": score_to_level(score),
            "reasoning": "",
            "recommendation": "",
            "ok": False,
            "error": "Consensus JSON could not be parsed. (Server output is not valid JSON.)",
        }

    return base

# -----------------------------
# 3) UI HELPERS
# -----------------------------
def format_case_name(dir_name: str) -> str:
    clean_name = dir_name.replace("_", " ").title()
    parts = clean_name.split()
    final_parts = []
    for part in parts:
        if part.isdigit():
            final_parts.append(str(int(part)))
        else:
            final_parts.append(part)
    return " ".join(final_parts)

def resize_for_display(image_path, target_height=520):
    target_width = int(target_height * (4 / 3))
    try:
        img = Image.open(image_path).convert("RGB")
        return ImageOps.pad(
            img,
            (target_width, target_height),
            method=Image.Resampling.LANCZOS,
            color=(0, 0, 0),
            centering=(0.5, 0.5),
        )
    except Exception:
        return Image.new("RGB", (target_width, target_height), color=(24, 24, 24))

def get_case_artifacts(case_id: str):
    base = Path(f"artifacts/runs/{case_id}")
    img_candidates = ["xray.jpg", "xray.jpeg", "xray.png", "image_current.jpg"]
    img_path = None
    for f in img_candidates:
        p = (base / f).resolve()
        if p.exists():
            img_path = p
            break

    audio_path = (base / "audio.wav").resolve()
    if not audio_path.exists():
        audio_path = None

    return img_path, audio_path

def clear_results():
    st.session_state.pop("analysis_result", None)
    st.session_state.pop("messages", None)

def ask_medgemma_live(context_json: dict, user_question: str) -> str:
    OLLAMA_URL = "http://localhost:11434/api/chat"
    MODEL_NAME = "gemma2:9b"

    # Keep context compact
    lightweight_context = {
        "risk_score": context_json.get("discrepancy_alert", {}).get("score"),
        "agents": [],
    }
    for agent in context_json.get("agent_reports", []):
        claims = [
            f"{c.get('value')} ({float(c.get('confidence', 0)):.2f})"
            for c in agent.get("claims", [])
        ]
        lightweight_context["agents"].append(
            {
                "role": agent.get("agent_name", "unknown"),
                "findings": claims,
                "description": agent.get("visual_description", "") or "",
            }
        )

    system_prompt = (
        "You are MedGemma, a senior clinical consultant. "
        "Answer concisely and state uncertainty if evidence conflicts."
    )

    try:
        payload = {
            "model": MODEL_NAME,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Context: {json.dumps(lightweight_context)}\nQuestion: {user_question}"},
            ],
            "stream": False,
        }
        r = requests.post(OLLAMA_URL, json=payload, timeout=30)
        if r.ok:
            return r.json()["message"]["content"]
        return f"Error from Ollama: {r.text}"
    except Exception as e:
        return f"Connection Error (Is Ollama running?): {e}"

# -----------------------------
# 4) MINIMAL CSS
# -----------------------------
st.markdown(
    """
<style>
.block-container { padding-top: 1.2rem; padding-bottom: 2rem; max-width: 1300px; }
h1, h2, h3 { letter-spacing: 0.2px; }
small, .stCaption { opacity: 0.85; }
hr { margin: 0.8rem 0; }
</style>
""",
    unsafe_allow_html=True,
)

# -----------------------------
# 5) SIDEBAR
# -----------------------------
with st.sidebar:
    st.title("🧬 MedGemma")
    st.caption("Consensus Board")

    if not CASES_DIR.exists():
        st.error("❌ data/cases folder missing.")
        st.stop()

    case_ids = sorted([p.name for p in CASES_DIR.iterdir() if p.is_dir()])
    selected_case_dir = st.selectbox("Patient Case", case_ids, format_func=format_case_name)

    note_path = CASES_DIR / selected_case_dir / "note.txt"
    note_default = note_path.read_text(encoding="utf-8") if note_path.exists() else "No note found."

    st.divider()
    st.subheader("Clinical Context")

    if "note_text" not in st.session_state or st.session_state.get("note_case_id") != selected_case_dir:
        st.session_state.note_text = note_default
        st.session_state.note_case_id = selected_case_dir

    st.session_state.note_text = st.text_area(
        "Live Notes",
        value=st.session_state.note_text,
        height=170,
        label_visibility="collapsed",
        placeholder="Enter symptoms, history, vitals, etc.",
    )

    st.divider()
    run_btn = st.button("Run Protocol", use_container_width=True, type="secondary")
    st.button("Clear Session", use_container_width=True, on_click=clear_results)

    st.caption(f"API: `{API_URL}`")

# -----------------------------
# 6) HEADER
# -----------------------------
st.markdown(f"## {format_case_name(selected_case_dir)}")
st.caption("Imaging • Acoustics • History → Consensus → Consultant")

# -----------------------------
# 7) RUN PROTOCOL
# -----------------------------
if run_btn:
    with st.status("Running protocol…", expanded=False) as status:
        try:
            payload = {"case_id": selected_case_dir, "clinical_note_text": st.session_state.note_text}
            resp = requests.post(f"{API_URL}/run", json=payload, timeout=90)
            if resp.ok:
                st.session_state["analysis_result"] = resp.json()
                status.update(label="Protocol complete", state="complete")
            else:
                status.update(label="API error", state="error")
                st.error(f"API Error: {resp.text}")
        except Exception as e:
            status.update(label="Connection error", state="error")
            st.error(f"Connection Error: {e}")

has_results = "analysis_result" in st.session_state
out = st.session_state.get("analysis_result")

# -----------------------------
# 8) TOP SUMMARY + MODERATOR OUTPUT
# -----------------------------
summary_col, actions_col = st.columns([3, 1], gap="large")

with summary_col:
    st.subheader("Consensus Summary")

    if has_results:
        cons = normalize_consensus(out)
        score = cons["score"]
        level = cons["level"].upper()

        m1, m2 = st.columns([1, 1], gap="medium")
        with m1:
            st.metric("Risk Score", f"{score:.2f}")
        with m2:
            st.metric("Status", level)

        # Show clean moderator fields (not raw)
        st.divider()
        st.subheader("Moderator Output")

        if cons["ok"]:
            if cons["reasoning"]:
                st.markdown("**Reasoning**")
                st.write(cons["reasoning"])
            if cons["recommendation"]:
                st.markdown("**Recommendation**")
                st.write(cons["recommendation"])
        else:
            # Clean message only
            st.warning(cons["error"])
    else:
        st.info("Run the protocol to generate agent findings and a consensus verdict.")

with actions_col:
    st.subheader("Quick Actions")
    st.write("")
    if has_results:
        if st.button("Copy Consensus JSON", use_container_width=True):
            cons = normalize_consensus(out)
            st.code(json.dumps(cons, indent=2))
    st.write("")
    with st.expander("Troubleshooting", expanded=False):
        st.markdown(
            "- If API fails: confirm server + ngrok are running.\n"
            "- If chat fails: confirm Ollama is running and model is pulled.\n"
            "- If artifacts missing: check `artifacts/runs/<case_id>/`."
        )

st.divider()

# -----------------------------
# 9) TABS
# -----------------------------
tab_review, tab_consult, tab_raw = st.tabs(["Review", "Consultant", "Raw Output"])

with tab_review:
    img_path, audio_path = get_case_artifacts(selected_case_dir)
    c_img, c_audio, c_hist = st.columns([2, 1, 1], gap="large")

    # Imaging
    with c_img:
        st.subheader("🖼️ Imaging")
        if img_path:
            st.image(resize_for_display(img_path, target_height=520), use_container_width=True)
            st.caption(f"Artifact: `{img_path.name}`")
        else:
            st.info("No imaging artifact found for this case.")

        if has_results:
            agent = next((a for a in out.get("agent_reports", []) if a.get("agent_name") == "imaging"), None)
            st.divider()
            st.caption("AI Findings")
            if agent:
                if agent.get("visual_description"):
                    st.write(agent["visual_description"])
                elif agent.get("claims"):
                    c0 = agent["claims"][0]
                    st.write(f"**{c0.get('value','')}**  \nConfidence: `{float(c0.get('confidence',0.0)):.2f}`")
            else:
                st.write("No imaging agent report.")

    # Audio
    with c_audio:
        st.subheader("🔊 Audio")
        if audio_path:
            st.audio(str(audio_path))
            st.caption(f"Artifact: `{audio_path.name}`")
        else:
            st.info("No audio artifact found for this case.")

        if has_results:
            agent = next((a for a in out.get("agent_reports", []) if a.get("agent_name") == "acoustics"), None)
            st.divider()
            st.caption("AI Findings")
            if agent and agent.get("claims"):
                c0 = agent["claims"][0]
                st.write(f"**Class:** {c0.get('value','')}")
                st.progress(float(c0.get("confidence", 0.0)))
                st.caption(f"Confidence: `{float(c0.get('confidence',0.0)):.2f}`")
            else:
                st.write("No acoustics agent report yet.")

    # History
    with c_hist:
        st.subheader("📜 History")
        st.caption("Current note (read-only view)")
        st.text_area(
            "note-preview",
            value=st.session_state.note_text,
            height=160,
            label_visibility="collapsed",
            disabled=True,
        )

        if has_results:
            agent = next((a for a in out.get("agent_reports", []) if a.get("agent_name") == "history"), None)
            st.divider()
            st.caption("Extracted Findings")
            if agent and agent.get("claims"):
                for c in agent["claims"][:6]:
                    st.write(f"- {c.get('value','')}")
            else:
                st.write("No history agent report yet.")

with tab_consult:
    st.subheader("💬 Consultant Interface")
    if not has_results:
        st.info("Run the protocol first to enable consultant chat.")
    else:
        if "messages" not in st.session_state:
            st.session_state.messages = []

        for m in st.session_state.messages:
            with st.chat_message(m["role"]):
                st.markdown(m["content"])

        user_q = st.chat_input("Ask a question about the discrepancy, evidence, or next steps…")
        if user_q:
            st.session_state.messages.append({"role": "user", "content": user_q})
            with st.chat_message("user"):
                st.markdown(user_q)

            with st.chat_message("assistant"):
                with st.spinner("Thinking…"):
                    ans = ask_medgemma_live(out, user_q)
                    st.markdown(ans)
            st.session_state.messages.append({"role": "assistant", "content": ans})

with tab_raw:
    st.subheader("Raw Output")
    if not has_results:
        st.info("No output yet.")
    else:
        st.json(out)
        st.divider()
        st.subheader("Agent Reports")
        for agent in out.get("agent_reports", []):
            with st.expander(f"{agent.get('agent_name','agent').title()} report", expanded=False):
                st.json(agent)
