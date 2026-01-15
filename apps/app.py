import os
from pathlib import Path
import requests
import streamlit as st
import json
from dotenv import load_dotenv

# 1. SETUP & CONFIGURATION
load_dotenv()
API_URL = os.getenv("API_URL", "http://127.0.0.1:8000")
CASES_DIR = Path("data/cases")

st.set_page_config(
    page_title="MedGemma Consensus",
    page_icon="🧬",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- HELPER FUNCTION FOR CASE NAMES ---
def format_case_name(dir_name):
    """
    Converts 'CASE_001' -> 'Case 1'
    Converts 'patient_alpha' -> 'Patient Alpha'
    """
    clean_name = dir_name.replace("_", " ").title()
    # Remove leading zeros from numbers if present (e.g. Case 001 -> Case 1)
    parts = clean_name.split()
    final_parts = []
    for part in parts:
        if part.isdigit():
            final_parts.append(str(int(part)))
        else:
            final_parts.append(part)
    return " ".join(final_parts)

# 2. CUSTOM CSS FOR "FUTURISTIC" LOOK
st.markdown("""
    <style>
    /* --- MAIN LAYOUT --- */
    /* Metric Cards */
    div[data-testid="stMetric"] {
        background-color: #1E1E1E;
        padding: 15px;
        border-radius: 10px;
        border: 1px solid #333;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }

    /* Agent Cards */
    .agent-card {
        background-color: #0E1117;
        border-radius: 8px;
        padding: 20px;
        border-left: 5px solid #4CAF50;
        margin-bottom: 10px;
    }
    
    /* --- SIDEBAR STYLING --- */
    section[data-testid="stSidebar"] {
        background-color: #0E0E0E;
    }

    /* DROPDOWN (Selectbox) Styling */
    div[data-baseweb="select"] > div {
        background-color: #1E1E1E !important;
        color: white !important;
        border: 1px solid #333 !important;
        border-radius: 8px !important;
    }
    div[data-baseweb="select"] > div:hover {
        border-color: #0083B8 !important; /* Medical Blue Hover */
        cursor: pointer;
    }
    div[data-baseweb="select"] span {
        color: #E0E0E0 !important;
    }
    
    /* TEXT AREA (Clinical Notes) Styling */
    div[data-baseweb="textarea"] textarea {
        background-color: #151515 !important;
        color: #00FF99 !important; /* Retro Terminal Green text */
        font-family: 'Courier New', Courier, monospace !important;
        border: 1px solid #333 !important;
        border-radius: 8px !important;
        font-size: 14px !important;
    }
    div[data-baseweb="textarea"] textarea:focus {
        border-color: #0083B8 !important;
        box-shadow: 0 0 8px rgba(0, 131, 184, 0.3) !important;
    }

    /* LABELS */
    .stSelectbox label, .stTextArea label {
        color: #888 !important;
        font-size: 0.75rem !important;
        text-transform: uppercase !important;
        letter-spacing: 1.5px !important;
        font-weight: 600 !important;
    }

    /* BUTTON STYLING (Medical Blue) */
    div.stButton > button:first-child {
        background-color: #0083B8; 
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: bold;
        padding: 0.5rem 1rem;
        transition: all 0.2s ease;
    }
    div.stButton > button:first-child:hover {
        background-color: #00A3E0;
        box-shadow: 0 0 10px rgba(0, 131, 184, 0.6);
        transform: translateY(-1px);
    }
    div.stButton > button:first-child:active {
        background-color: #006699;
    }

    </style>
    """, unsafe_allow_html=True)

# 3. SIDEBAR: CASE SELECTION
with st.sidebar:
    # --- FIX: EMBEDDED LOGO (No external links required) ---
    logo_html = """
    <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <svg width="50" height="50" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#0083B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="#0083B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="#0083B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="12" r="3" fill="#00FF99" fill-opacity="0.5"/>
        </svg>
        <div style="margin-left: 10px;">
            <h2 style="margin: 0; font-size: 18px; color: #fff;">MedGemma</h2>
            <p style="margin: 0; font-size: 10px; color: #888;">CONSENSUS V1.0</p>
        </div>
    </div>
    """
    st.markdown(logo_html, unsafe_allow_html=True)
    # -------------------------------------------------------

    st.caption("Powered by **MedGemma 4B** & **MedSigLIP**")
    
    st.markdown("---")
    
    if not CASES_DIR.exists():
        st.error("❌ Data folder missing.")
        st.stop()

    case_ids = sorted([p.name for p in CASES_DIR.iterdir() if p.is_dir()])
    
    # Styled Dropdown with FORMAT_FUNC
    selected_case_dir = st.selectbox(
        "Select Patient Case", 
        case_ids, 
        index=0,
        format_func=format_case_name 
    )
    
    # Load Note
    note_path = CASES_DIR / selected_case_dir / "note.txt"
    note_default = note_path.read_text(encoding="utf-8") if note_path.exists() else "No note found."
    
    # Styled Text Area
    st.markdown("<br>", unsafe_allow_html=True)
    note = st.text_area("Clinical Note (Live Input)", height=300, value=note_default, help="Edit this text to simulate different patient histories.")
    
    st.markdown("---")
    run_btn = st.button("🚀 INITIATE PROTOCOL", type="primary", use_container_width=True)
    
    st.markdown(f"<div style='text-align: center; color: #444; font-size: 10px; margin-top: 10px;'>Connected to: {API_URL}</div>", unsafe_allow_html=True)
# 4. MAIN DASHBOARD
# Use the formatted name for the title
st.title(f"Protocol: {format_case_name(selected_case_dir)}") 
st.markdown("### Discrepancy Detection & Multi-Agent Resolution")

if run_btn:
    with st.spinner("🔄 Orchestrating Agents (MedSigLIP, HeAR, MedGemma)..."):
        try:
            payload = {
                "case_id": selected_case_dir, # Send the actual directory name to API
                "image_current_path": None,
                "image_prior_path": None,
                "audio_current_path": None,
                "audio_prior_path": None,
                "clinical_note_text": note,
            }
            resp = requests.post(f"{API_URL}/run", json=payload, timeout=60)
            if not resp.ok:
                st.error(f"System Error: {resp.text}")
                st.stop()
            out = resp.json()
        except Exception as e:
            st.error(f"Connection Failed: {e}")
            st.stop()

    # --- TOP ROW: HEADS UP DISPLAY ---
    alert_level = out["discrepancy_alert"]["level"].upper()
    score = out["discrepancy_alert"]["score"]
    
    # Dynamic Color Logic
    alert_color = "off"
    if alert_level == "HIGH": alert_color = "inverse"
    elif alert_level == "MEDIUM": alert_color = "normal"
    
    col1, col2, col3 = st.columns([1, 1, 2])
    
    with col1:
        st.metric("DISCREPANCY SCORE", f"{score:.2f}", delta="Risk Level", delta_color=alert_color)
    with col2:
        st.metric("ALERT STATUS", alert_level, delta="Action Required" if score > 0.5 else "Stable", delta_color=alert_color)
    with col3:
        st.subheader("🤖 AI Clinical Summary")
        st.write(out['discrepancy_alert']['summary'])

    st.markdown("---")

    # --- MIDDLE ROW: AGENT GRID ---
    st.subheader("📡 Agent Intelligence Reports")
    
    acol1, acol2, acol3 = st.columns(3)
    
    def get_agent(name):
        return next((a for a in out["agent_reports"] if a["agent_name"] == name), None)

    # 1. IMAGING AGENT
    with acol1:
        agent = get_agent("imaging")
        if agent:
            with st.container(border=True):
                st.markdown("### 🖼️ Imaging")
                st.caption(f"Model: {agent['model']}")
                claim = agent['claims'][0]
                st.metric("Finding", claim['value'], f"{claim['confidence']*100:.0f}% Conf")
                st.progress(claim['confidence'])

    # 2. ACOUSTICS AGENT
    with acol2:
        agent = get_agent("acoustics")
        if agent:
            with st.container(border=True):
                st.markdown("### 🔊 Acoustics")
                st.caption(f"Model: {agent['model']}")
                if "error" in agent and agent["error"]:
                      st.error("Sensor Error")
                else:
                    claim = agent['claims'][0]
                    is_bad = "wheez" in claim['value'].lower()
                    st.metric("Sound Profile", claim['value'], f"{claim['confidence']*100:.0f}% Conf", delta_color="inverse" if is_bad else "normal")
                    st.progress(claim['confidence'])

    # 3. HISTORY AGENT
    with acol3:
        agent = get_agent("history")
        if agent:
            with st.container(border=True):
                st.markdown("### 📜 History")
                st.caption(f"Model: {agent['model']}")
                claim = agent['claims'][0]
                display_val = (claim['value'][:75] + '..') if len(claim['value']) > 75 else claim['value']
                st.markdown(f"**Extracted:**\n>{display_val}")

    # --- BOTTOM ROW: REASONING TRACE ---
    st.markdown("---")
    r_col1, r_col2 = st.columns([2, 1])
    
    with r_col1:
        st.subheader("🧠 Consensus Logic Trace")
        log_text = "\n".join([f"> {line}" for line in out["reasoning_trace"]])
        st.code(log_text, language="bash")
        
    with r_col2:
        st.subheader("📋 Actions")
        if out["recommended_data_actions"]:
            for action in out["recommended_data_actions"]:
                st.warning(f"👉 {action}")
        else:
            st.success("✅ No further data required.")

    # --- DEBUG EXPANDER ---
    with st.expander("🔍 Developer Mode (Raw JSON)"):
        st.json(out)

else:
    # IMPROVED EMPTY STATE
    st.info("👈 Select a patient case from the sidebar and click 'INITIATE PROTOCOL' to start the analysis.")
    
    st.markdown("""
    <div style='text-align: center; color: #555; margin-top: 80px;'>
        <img src="https://img.icons8.com/wired/64/555555/pulse.png" style="opacity: 0.5;">
        <h3 style="margin-top: 20px;">Waiting for Input Streams...</h3>
        <p style="font-size: 14px;">System Ready. All Agents Online.</p>
    </div>
    """, unsafe_allow_html=True)