
import os
from pathlib import Path
import requests
import streamlit as st
import json
from dotenv import load_dotenv
from PIL import Image, ImageOps

# ────────────────────────────────────────────────
# 1) SETUP & CONFIG
# ────────────────────────────────────────────────
load_dotenv()

API_URL = "http://127.0.0.1:8000"
CASES_DIR = Path("data/cases")

st.set_page_config(
    page_title="MedGemma – Clinical AI Consensus",
    page_icon="🧬",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ────────────────────────────────────────────────
# CUSTOM CSS ─ clean tabs + risk level highlighting
# ────────────────────────────────────────────────

st.markdown(
    """
    <style>
    /* Force-remove bottom border / underline on ALL tabs, including selected one */
    div[data-baseweb="tab-list"] {
        border-bottom: 1px solid #e0e0e0 !important;
    }

    div[data-baseweb="tab-list"] > button {
        border: none !important;
        border-bottom: none !important;
        background: transparent !important;
        color: #555 !important;
        padding: 10px 20px !important;
        margin: 0 4px !important;
        font-size: 15px !important;
    }

    /* Selected tab: only color + bold, absolutely no border/underline */
    div[data-baseweb="tab-list"] > button[aria-selected="true"],
    div[data-baseweb="tab-list"] > button[aria-selected="true"]:hover {
        color: #1e88e5 !important;
        font-weight: 600 !important;
        border: none !important;
        border-bottom: none !important;
        background: transparent !important;
        box-shadow: none !important;
    }

    /* Make sure the indicator (underline) is completely killed */
    div[data-baseweb="tab-highlight"] {
        display: none !important;
    }

    div[data-baseweb="tab-list"] > button::after,
    div[data-baseweb="tab-list"] > button[aria-selected="true"]::after {
        border-bottom: none !important;
        height: 0 !important;
        display: none !important;
    }

    /* Hover feedback - very subtle */
    div[data-baseweb="tab-list"] > button:hover {
        color: #1976d2 !important;
        background: rgba(25, 118, 210, 0.06) !important;
    }

    /* Risk colors - unchanged */
    .high-risk { background-color: #ffebee; padding: 14px 16px; border-radius: 6px; border-left: 5px solid #d32f2f; margin-bottom: 1rem; }
    .medium-risk { background-color: #fff3e0; padding: 14px 16px; border-radius: 6px; border-left: 5px solid #f57c00; margin-bottom: 1rem; }
    .low-risk { background-color: #e8f5e9; padding: 14px 16px; border-radius: 6px; border-left: 5px solid #388e3c; margin-bottom: 1rem; }
    </style>
    """,
    unsafe_allow_html=True
)
# ────────────────────────────────────────────────
# HELPERS
# ────────────────────────────────────────────────
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


def normalize_consensus(out: dict) -> dict:
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

    da = out.get("discrepancy_alert") or {}
    score = safe_float(da.get("score"), 0.0)

    reasoning_trace = out.get("reasoning_trace") or []
    reasoning = reasoning_trace[0] if reasoning_trace else ""

    recommendation = ""
    actions = out.get("recommended_data_actions") or []
    if actions:
        recommendation = actions[0]

    if "score" in da:
        return {
            "score": score,
            "level": score_to_level(score),
            "reasoning": str(reasoning),
            "recommendation": str(recommendation),
            "ok": True,
            "error": "",
        }

    return base


def format_case_name(dir_name: str) -> str:
    clean = dir_name.replace("_", " ").title()
    parts = [str(int(p)) if p.isdigit() else p for p in clean.split()]
    return " ".join(parts)


def resize_for_display(image_path, target_height=520):
    target_width = int(target_height * 4 / 3)
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
    img_path = next((base / f for f in img_candidates if (base / f).exists()), None)

    audio_path = base / "audio.wav"
    audio_path = audio_path if audio_path.exists() else None

    return img_path, audio_path


def clear_results():
    st.session_state.pop("analysis_result", None)
    st.session_state.pop("messages", None)


def ask_medgemma_live(context_json: dict, user_question: str) -> str:
    OLLAMA_URL = "http://localhost:11434/api/chat"
    MODEL_NAME = "gemma2:9b"

    lightweight_context = {
        "risk_score": context_json.get("discrepancy_alert", {}).get("score"),
        "agents": [],
    }
    for agent in context_json.get("agent_reports", []):
        claims = [f"{c.get('value')} ({float(c.get('confidence', 0)):.2f})" for c in agent.get("claims", [])]
        lightweight_context["agents"].append({
            "role": agent.get("agent_name", "unknown"),
            "findings": claims,
            "description": agent.get("visual_description", "") or "",
        })

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
        return f"Ollama error: {r.text}"
    except Exception as e:
        return f"Connection error (Ollama running?): {e}"

# ────────────────────────────────────────────────
# SIDEBAR
# ────────────────────────────────────────────────
with st.sidebar:
    st.title("🧬 MedGemma")
    st.caption("Clinical AI Consensus")

    if not CASES_DIR.exists():
        st.error("❌ data/cases folder missing.")
        st.stop()

    case_ids = sorted(p.name for p in CASES_DIR.iterdir() if p.is_dir())
    selected_case = st.selectbox(
        "Select Case",
        case_ids,
        format_func=format_case_name
    )

    note_path = CASES_DIR / selected_case / "note.txt"
    note_default = note_path.read_text(encoding="utf-8") if note_path.exists() else ""

    st.divider()
    st.subheader("Clinical Notes")

    key = f"note_{selected_case}"
    if key not in st.session_state:
        st.session_state[key] = note_default

    st.session_state[key] = st.text_area(
        "Notes",
        value=st.session_state[key],
        height=170,
        label_visibility="collapsed",
        placeholder="Symptoms, history, vitals...",
    )

    st.divider()
    analyze_btn = st.button("Analyze Case", use_container_width=True, type="secondary")
    st.button("Reset Analysis", use_container_width=True, on_click=clear_results)

    st.caption(f"API: {API_URL}")

# ────────────────────────────────────────────────
# HEADER
# ────────────────────────────────────────────────
st.markdown(f"## {format_case_name(selected_case)}")
st.caption("Imaging • Audio • Notes → AI Consensus")

# ────────────────────────────────────────────────
# RUN ANALYSIS
# ────────────────────────────────────────────────
if analyze_btn:
    with st.status("Analyzing case…", expanded=True):
        try:
            payload = {
                "case_id": selected_case,
                "clinical_note_text": st.session_state[f"note_{selected_case}"]
            }
            resp = requests.post(f"{API_URL}/run", json=payload, timeout=90)
            if resp.ok:
                st.session_state["analysis_result"] = resp.json()
                st.success("Analysis complete")
            else:
                st.error(f"API error: {resp.text}")
        except Exception as e:
            st.error(f"Connection error: {e}")

has_results = "analysis_result" in st.session_state
out = st.session_state.get("analysis_result")

# ────────────────────────────────────────────────
# SUMMARY + TOOLS
# ────────────────────────────────────────────────
col_summary, col_tools = st.columns([3.5, 1.2], gap="large")

with col_summary:
    st.subheader("Consensus Summary")

    if has_results:
        cons = normalize_consensus(out)
        score = cons["score"]
        level = cons["level"].upper()

        risk_class = f"{cons['level']}-risk"

        with st.container():
            st.markdown(f'<div class="{risk_class}">', unsafe_allow_html=True)
            m1, m2 = st.columns([1, 1])
            with m1:
                st.metric("Discrepancy Score", f"{score:.2f}")
            with m2:
                st.metric("Risk Level", level)
            st.markdown("</div>", unsafe_allow_html=True)

        st.divider()

        if cons["ok"]:
            if cons["reasoning"]:
                st.markdown("**Key Reasoning**")
                st.write(cons["reasoning"])
            if cons["recommendation"]:
                st.markdown("**Recommended Next Steps**")
                st.write(cons["recommendation"])
        else:
            st.warning(cons["error"])
    else:
        st.info("Click **Analyze Case** to generate AI-powered insights.")

with col_tools:
    st.subheader("Quick Tools")
    if has_results:
        if st.button("Copy Summary JSON", use_container_width=True):
            cons = normalize_consensus(out)
            st.code(json.dumps(cons, indent=2), language="json")

    with st.expander("Help & Troubleshooting", expanded=False):
        st.markdown(
            "- Server & ngrok running?\n"
            "- Ollama running + gemma2:9b pulled?\n"
            "- Check `artifacts/runs/<case>/` for files"
        )

st.divider()

# ────────────────────────────────────────────────
# TABS
# ────────────────────────────────────────────────
tab_review, tab_consult, tab_raw = st.tabs(["Case Review", "AI Consultant", "Raw Output"])

with tab_review:
    img_path, audio_path = get_case_artifacts(selected_case)
    c_img, c_audio, c_hist = st.columns([2, 1, 1], gap="large")

    with c_img:
        st.subheader("🖼️ Imaging")
        if img_path:
            st.image(resize_for_display(img_path), use_container_width=True)
            st.caption(f"File: {img_path.name}")
        else:
            st.info("No imaging available.")

        if has_results:
            agent = next((a for a in out.get("agent_reports", []) if a.get("agent_name") == "imaging"), None)
            st.divider()
            st.caption("AI Findings")
            if agent:
                if agent.get("visual_description"):
                    st.write(agent["visual_description"])
                elif agent.get("claims"):
                    c = agent["claims"][0]
                    st.markdown(f"**{c.get('value', '—')}**")
                    st.caption(f"Confidence: {float(c.get('confidence', 0)):.0%}")
            else:
                st.write("No imaging report yet.")

    with c_audio:
        st.subheader("🔊 Audio")
        if audio_path:
            st.audio(str(audio_path))
            st.caption(f"File: {audio_path.name}")
        else:
            st.info("No audio available.")

        if has_results:
            agent = next((a for a in out.get("agent_reports", []) if a.get("agent_name") == "acoustics"), None)
            st.divider()
            st.caption("AI Findings")
            if agent and agent.get("claims"):
                c = agent["claims"][0]
                st.write(f"**{c.get('value', '—')}**")
                st.progress(float(c.get("confidence", 0.0)))
                st.caption(f"Confidence: {float(c.get('confidence', 0)):.0%}")
            else:
                st.write("No audio report yet.")

    with c_hist:
        st.subheader("📜 History")
        st.caption("Current notes")
        st.text_area(
            "preview",
            value=st.session_state.get(f"note_{selected_case}", ""),
            height=140,
            disabled=True,
            label_visibility="collapsed",
        )

        if has_results:
            agent = next((a for a in out.get("agent_reports", []) if a.get("agent_name") == "history"), None)
            st.divider()
            st.caption("Key Extracts")
            if agent and agent.get("claims"):
                for c in agent["claims"][:6]:
                    st.write(f"• {c.get('value','')}")
            else:
                st.write("No history extracts.")

with tab_consult:
    st.subheader("💬 AI Clinical Consultant")
    if not has_results:
        st.info("Run analysis first to enable chat.")
    else:
        if "messages" not in st.session_state:
            st.session_state.messages = []

        for msg in st.session_state.messages:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])

        if prompt := st.chat_input("Ask about findings, risks, next steps…"):
            st.session_state.messages.append({"role": "user", "content": prompt})
            with st.chat_message("user"):
                st.markdown(prompt)

            with st.chat_message("assistant"):
                with st.spinner("Thinking…"):
                    answer = ask_medgemma_live(out, prompt)
                    st.markdown(answer)
            st.session_state.messages.append({"role": "assistant", "content": answer})

with tab_raw:
    st.subheader("Raw Output (debug)")
    if not has_results:
        st.info("No data yet.")
    else:
        st.json(out)
        st.divider()
        st.subheader("Agent Reports")
        for agent in out.get("agent_reports", []):
            name = agent.get("agent_name", "agent").title()
            with st.expander(f"{name} Report", expanded=False):
                st.json(agent)
