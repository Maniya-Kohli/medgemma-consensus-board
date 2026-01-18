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
    page_title="Aegis Clinical – AI Safety Net",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ────────────────────────────────────────────────
# CUSTOM CSS - Blue Theme & Active Tab Highlighting
# ────────────────────────────────────────────────
st.markdown(
    """
    <style>

    /* ===== Tabs spacing (make them less cramped) ===== */
    div[data-baseweb="tab-list"]{
      gap: 14px !important;
      padding: 6px 4px !important;
    }

    div[data-baseweb="tab-list"] button[role="tab"]{
      padding: 10px 16px !important;
      margin: 0 !important;
      border-radius: 12px 12px 0 0 !important;
    }

    div[data-baseweb="tab-list"] button[role="tab"] p{
      margin: 0 !important;
      line-height: 1.2 !important;
    }

    /* ===== Tabs: improve contrast on black ===== */
    div[data-baseweb="tab-list"]{
      border-bottom: 1px solid #2a2a2a !important;
      gap: 6px !important;
    }

    div[data-baseweb="tab-list"] button[role="tab"] p{
      color: #cfcfcf !important;
      font-weight: 600 !important;
    }

    div[data-baseweb="tab-list"] button[role="tab"]:hover p{
      color: #ffffff !important;
    }

    div[data-baseweb="tab-list"] button[aria-selected="true"] p{
      color: #1976d2 !important;
      font-weight: 800 !important;
    }

    div[data-baseweb="tab-list"] button[aria-selected="true"]{
      border-bottom: 3px solid #1976d2 !important;
      background: rgba(25,118,210,0.12) !important;
      border-radius: 10px 10px 0 0 !important;
    }

    div[data-baseweb="tab-highlight"]{ display: none !important; }

    div[data-baseweb="tab-panel"]{
      padding-top: 10px !important;
      border-top: 1px solid #1f1f1f !important;
    }

    /* ===== Sidebar clarity on black ===== */
    section[data-testid="stSidebar"] > div{
      background-color: #0b0b0b !important;
      border-right: 1px solid #1f1f1f !important;
    }

    section[data-testid="stSidebar"] hr{
      border-color: #2a2a2a !important;
    }

    section[data-testid="stSidebar"] label,
    section[data-testid="stSidebar"] p,
    section[data-testid="stSidebar"] span{
      color: #e6e6e6 !important;
    }

    /* ===== Selectbox: make selected case highlight BLUE ===== */
    div[data-testid="stSelectbox"] div[data-baseweb="select"] > div{
      background-color: #111111 !important;
      border-color: #333333 !important;
    }

    div[data-testid="stSelectbox"] div[data-baseweb="select"] > div:focus-within{
      border-color: #1976d2 !important;
      box-shadow: 0 0 0 0.2rem rgba(25,118,210,0.35) !important;
      outline: none !important;
    }

    div[role="listbox"] div[aria-selected="true"]{
      background-color: rgba(25,118,210,0.20) !important;
    }

    div[role="listbox"] div[aria-selected="true"] *{
      color: #ffffff !important;
    }

    div[role="listbox"] div:hover{
      background-color: rgba(25,118,210,0.12) !important;
    }

    /* ===== Risk Levels (KEEP SAME COLORS) ===== */
    .high-risk {
      background-color: #ffebee;
      padding: 14px 16px;
      border-radius: 6px;
      border-left: 5px solid #c62828;
      margin-bottom: 1rem;
    }
    .medium-risk {
      background-color: #fff8e1;
      padding: 14px 16px;
      border-radius: 6px;
      border-left: 5px solid #f9a825;
      margin-bottom: 1rem;
    }
    .low-risk {
      background-color: #e8f5e9;
      padding: 14px 16px;
      border-radius: 6px;
      border: 1px solid #e0e0e0;
      border-left: 5px solid #2e7d32;
      margin-bottom: 1rem;
    }

    /* ===== FIXED: Audit Box Clean Dark Theme ===== */
    .audit-box {
      background-color: #111111 !important;
      padding: 24px;
      border-radius: 12px;
      border: 1px solid #2a2a2a !important;
      border-left: 5px solid #1976d2 !important;
      /* Remove Courier New to prevent Code-Block rendering */
      font-family: 'Inter', 'Segoe UI', sans-serif !important;
      color: #e6e6e6 !important;
      line-height: 1.6;
    }

    /* Hard Reset: Prevents any white background on pre/code blocks inside audit box */
    .audit-box pre, 
    .audit-box code, 
    .audit-box p, 
    .audit-box span {
      background-color: transparent !important;
      background: none !important;
      color: inherit !important;
      padding: 0 !important;
      border: none !important;
      font-family: inherit !important;
    }

    /* 🔵 Force PRIMARY sidebar button to be blue */
    section[data-testid="stSidebar"] button[kind="primary"],
    section[data-testid="stSidebar"] button[data-testid="baseButton-primary"]{
      background-color: #1976d2 !important;
      border: 1px solid #1976d2 !important;
      color: #ffffff !important;
    }

    section[data-testid="stSidebar"] button[kind="primary"]:hover,
    section[data-testid="stSidebar"] button[data-testid="baseButton-primary"]:hover{
      background-color: #1565c0 !important;
      border-color: #1565c0 !important;
      color: #ffffff !important;
    }

    </style>
    """,
    unsafe_allow_html=True
)



# ────────────────────────────────────────────────
# HELPERS
# ────────────────────────────────────────────────
def safe_float(x, default=0.0):
    try: return float(str(x).replace("%", "")) if x is not None else default
    except: return default

def score_to_level(score: float) -> str:
    if score >= 0.70: return "high"
    if score >= 0.40: return "medium"
    return "low"

def format_case_name(dir_name: str) -> str:
    clean = dir_name.replace("_", " ").title()
    return " ".join([str(int(p)) if p.isdigit() else p for p in clean.split()])

def get_case_artifacts(case_id: str):
    base = Path(f"artifacts/runs/{case_id}")
    img = next((base / f for f in ["xray.jpg", "xray.jpeg", "xray.png"] if (base / f).exists()), None)
    audio = base / "audio.wav"
    return img, audio if audio and audio.exists() else None

def clear_results():
    st.session_state.pop("analysis_result", None)
    st.session_state.pop("messages", None)

# ────────────────────────────────────────────────
# SIDEBAR
# ────────────────────────────────────────────────
with st.sidebar:
    st.title("🛡️ Aegis Clinical")
    case_ids = sorted(p.name for p in CASES_DIR.iterdir() if p.is_dir())
    selected_case = st.selectbox("Select Case", case_ids, format_func=format_case_name)
    
    note_path = CASES_DIR / selected_case / "note.txt"
    note_content = note_path.read_text(encoding="utf-8") if note_path.exists() else ""
    
    st.session_state[f"note_{selected_case}"] = st.text_area(
        "Clinical Notes", value=note_content, height=170
    )

    st.divider()
    analyze_btn = st.button("Analyze Case", use_container_width=True, type="primary")
    st.button("Reset Analysis", use_container_width=True, on_click=clear_results)

# ────────────────────────────────────────────────
# MAIN FLOW
# ────────────────────────────────────────────────
st.markdown(f"## {format_case_name(selected_case)}")

if analyze_btn:
    with st.status("Executing Two-Stage Agentic Workflow...", expanded=True):
        try:
            payload = {"case_id": selected_case, "clinical_note_text": st.session_state[f"note_{selected_case}"]}
            resp = requests.post(f"{API_URL}/run", json=payload, timeout=90)
            if resp.ok:
                st.session_state["analysis_result"] = resp.json()
            else: st.error(f"API Error: {resp.text}")
        except Exception as e: st.error(f"Error: {e}")

out = st.session_state.get("analysis_result")

if out:
    # ────────────────────────────────────────────────
    # INTEGRATED LAYOUT: COL1 (METRICS) | COL2 (TABS)
    # ────────────────────────────────────────────────
    col1, col2 = st.columns([1.2, 2.8], gap="large")
    
    with col1:
        score = safe_float(out['discrepancy_alert']['score'])
        level = score_to_level(score)
        
        # Use the new Blue Risk classes
        st.markdown(f'<div class="{level}-risk">', unsafe_allow_html=True)
        st.metric("Discrepancy Score", f"{score:.2f}")
        st.markdown(f"**Risk Level:** {level.upper()}")
        st.markdown("</div>", unsafe_allow_html=True)
        
        st.subheader("Final Verdict")
        st.info(out['discrepancy_alert']['summary'])
        
        action = out['recommended_data_actions'][0] if out['recommended_data_actions'] else "N/A"
        st.warning(f"**Action:** {action}")

    with col2:
        # TABS: The CSS at the top ensures the active tab font turns blue
        tab_review, tab_audit, tab_consult, tab_raw = st.tabs([
            "📋 Case Review", "🧠 Clinical Audit", "💬 AI Consultant", "🛠️ Raw Output"
        ])
        
        with tab_review:
            img_path, audio_path = get_case_artifacts(selected_case)
            r1, r2 = st.columns([1, 1])
            with r1:
                st.caption("🖼️ Imaging Findings")
                if img_path: st.image(str(img_path), use_container_width=True)
                img_agent = next((a for a in out['agent_reports'] if a['agent_name'] == "imaging"), None)
                if img_agent: st.write(img_agent['claims'][0]['value'])
            
            with r2:
                st.caption("🔊 Acoustic Profile")
                if audio_path: st.audio(str(audio_path))
                aud_agent = next((a for a in out['agent_reports'] if a['agent_name'] == "acoustics"), None)
                if aud_agent: st.write(f"**{aud_agent['claims'][0]['value']}** (Conf: {aud_agent['claims'][0]['confidence']:.2f})")


        with tab_audit:
            full_audit = out.get("audit_markdown")
            # This now matches the key from main.py
            thought_trace = out.get("thought_process") 

            if not full_audit or "unavailable" in full_audit:
                st.warning("⚠️ Clinical Audit report is currently unavailable.")
            else:
                # Wrap in the audit-box div we defined in CSS
                st.markdown(f'<div class="audit-box">{full_audit}</div>', unsafe_allow_html=True)
                
                # Show the Chain of Thought reasoning so the user understands the 'Why'
                if thought_trace:
                    with st.expander("🔍 View Clinical Reasoning Trace (CoT)"):
                        st.markdown(thought_trace)
                    
            st.divider()
            st.caption("📜 This report is the interpretation of the AI Diagnostic Auditor.")

        with tab_consult:
            st.write("### 💬 AI Clinical Consultant")
            # Chat logic remains same

        with tab_raw:
            st.json(out)
            st.divider()
            for report in out['agent_reports']:
                with st.expander(f"{report['agent_name'].upper()} - {report['model']}"):
                    st.json(report)
else:
    st.info("Select a case and click **Analyze Case** to initiate the multi-agent consensus.")