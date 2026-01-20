import os
from pathlib import Path
import requests
import streamlit as st
import json
import uuid
import shutil
from dotenv import load_dotenv
from PIL import Image
import plotly.graph_objects as go

# ────────────────────────────────────────────────
# 1) SETUP & CONFIG
# ────────────────────────────────────────────────
load_dotenv()

API_URL = "http://127.0.0.1:8000"
CASES_DIR = Path("data/cases")
UPLOAD_DIR = Path("artifacts/runs") 

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

st.set_page_config(
    page_title="Aegis Clinical | Multi-Modal Consensus",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ────────────────────────────────────────────────
# SLEEK CLINICAL UI THEME (CSS)
# ────────────────────────────────────────────────
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

    :root {
        --bg-main: #0a0e14;
        --bg-card: #151b26;
        --accent-blue: #3b82f6;
        --accent-amber: #fbbf24;
        --accent-green: #22c55e;
        --text-muted: #8a92a8;
        --border: #2a3441;
    }

    * { font-family: 'Plus Jakarta Sans', sans-serif !important; }

    .stApp { background-color: var(--bg-main); color: #e1e4ed; }

    /* Sidebar Styling */
    section[data-testid="stSidebar"] {
        background-color: var(--bg-card) !important;
        border-right: 1px solid var(--border) !important;
    }
    
    /* Card Styles - Only applied when content exists */
    .metric-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 1rem;
    }

    .verdict-banner {
        background: linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, rgba(10, 14, 20, 0) 100%);
        border-left: 4px solid var(--accent-blue);
        padding: 18px;
        border-radius: 4px 12px 12px 4px;
        margin-bottom: 20px;
    }

    /* Status Badges */
    .conf-badge {
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        display: inline-block;
    }
    .conf-high { background: rgba(34, 197, 94, 0.1); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); }
    .conf-med { background: rgba(251, 191, 36, 0.1); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3); }
    
    /* Button Stack */
    .stButton > button {
        border-radius: 8px !important;
        width: 100% !important;
        margin-bottom: 8px !important;
    }
    
    /* Primary Action */
    div.stButton > button[kind="primary"] {
        background: var(--accent-blue) !important;
        border: none !important;
    }

    .sidebar-header {
        font-size: 10px;
        font-weight: 800;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 1.2px;
        margin-bottom: 12px;
    }
    </style>
    """,
    unsafe_allow_html=True
)

# ────────────────────────────────────────────────
# VISUALIZATION HELPERS
# ────────────────────────────────────────────────

def create_discrepancy_meter(score):
    fig = go.Figure(go.Indicator(
        mode = "gauge+number",
        value = score * 100,
        domain = {'x': [0, 1], 'y': [0, 1]},
        title = {'text': "Conflict Level", 'font': {'size': 14, 'color': '#8a92a8'}},
        number = {'suffix': "%", 'font': {'size': 32, 'color': '#ffffff'}},
        gauge = {
            'axis': {'range': [None, 100], 'tickwidth': 1, 'tickcolor': "#2a3441"},
            'bar': {'color': "#3b82f6"},
            'bgcolor': "rgba(0,0,0,0)",
            'borderwidth': 1,
            'bordercolor': "#2a3441",
            'steps': [
                {'range': [0, 30], 'color': 'rgba(34, 197, 94, 0.05)'},
                {'range': [30, 70], 'color': 'rgba(251, 191, 36, 0.05)'},
                {'range': [70, 100], 'color': 'rgba(239, 68, 68, 0.05)'}
            ]
        }
    ))
    fig.update_layout(height=160, margin=dict(l=20, r=20, t=30, b=0), paper_bgcolor='rgba(0,0,0,0)')
    return fig

def get_conf_html(conf):
    cls = "conf-high" if conf >= 0.8 else "conf-med"
    return f'<div class="conf-badge {cls}">{int(conf*100)}% Confidence</div>'

# ────────────────────────────────────────────────
# SIDEBAR - STREAMLINED
# ────────────────────────────────────────────────
with st.sidebar:
    st.markdown("### 🛡️ Aegis Clinical")
    st.markdown('<p style="color:#8a92a8; font-size:12px; margin-top:-15px;">AI Multimodal Consensus Engine</p>', unsafe_allow_html=True)
    st.divider()
    
    st.markdown('<div class="sidebar-header">Data Source</div>', unsafe_allow_html=True)
    mode = st.radio("Mode", ["Clinical Library", "Emergency Upload"], label_visibility="collapsed")
    
    current_case_id = None
    clinical_note = ""
    
    if mode == "Clinical Library":
        case_ids = sorted([p.name for p in CASES_DIR.iterdir() if p.is_dir()]) if CASES_DIR.exists() else []
        selected_case = st.selectbox("Select Patient Case", case_ids)
        current_case_id = selected_case
        
        note_path = CASES_DIR / selected_case / "note.txt"
        clinical_note = note_path.read_text() if note_path.exists() else ""
    else:
        # Create persistent session ID for uploads
        if "session_id" not in st.session_state:
            st.session_state.session_id = f"UPLOAD-{uuid.uuid4().hex[:5].upper()}"
        
        current_case_id = st.session_state.session_id
        st.info(f"Session: {current_case_id}")
        
        up_img = st.file_uploader("X-Ray (JPG/PNG)", type=["jpg", "png"])
        up_audio = st.file_uploader("Lung Audio (.wav)", type=["wav"])
        clinical_note = st.text_area("Patient History / Notes", placeholder="35-year-old male...")
        
        # Save files instantly when they appear
        if up_img or up_audio:
            path = UPLOAD_DIR / current_case_id
            path.mkdir(parents=True, exist_ok=True)
            if up_img: Image.open(up_img).save(path / "xray.jpg")
            if up_audio: 
                with open(path / "audio.wav", "wb") as f: f.write(up_audio.getbuffer())

    st.divider()
    
    # Combined Button Column (Stacked Vertically)
    analyze_btn = st.button("🚀 Execute Consensus", type="primary", use_container_width=True)
    
    if st.button("🗑️ Reset Session", use_container_width=True):
        st.session_state.clear()
        st.rerun()

# ────────────────────────────────────────────────
# MAIN CONTENT
# ────────────────────────────────────────────────
res = st.session_state.get("analysis_result")

if not res:
    # Initial State - Clean Header
    st.markdown(f"# Case: <span style='color:#3b82f6;'>{current_case_id or 'Ready'}</span>", unsafe_allow_html=True)
    st.markdown("---")
    
    if analyze_btn:
        with st.status("Running Diagnostic Agents...", expanded=True) as status:
            try:
                payload = {"case_id": current_case_id, "clinical_note_text": clinical_note}
                resp = requests.post(f"{API_URL}/run", json=payload, timeout=60)
                if resp.ok:
                    st.session_state["analysis_result"] = resp.json()
                    status.update(label="Analysis Complete", state="complete", expanded=False)
                    st.rerun()
                else:
                    st.error(f"API Error: {resp.status_code}")
            except Exception as e:
                st.error(f"Connection Error: {e}")
    else:
        st.markdown("""
        ### Instructions
        1. Provide **Imaging**, **Acoustics**, or **Clinical History**.
        2. Click **Execute Consensus** to trigger the multi-agent reasoning chain.
        3. The system will adjudicate findings and flag discrepancies.
        """)

else:
    # RESULTS VIEW
    alert = res.get("discrepancy_alert", {})
    score = alert.get("score", 0.0)
    
    # Hero Verdict
    st.markdown(f"""
    <div class="verdict-banner">
        <h4 style="margin:0; color:#8a92a8; font-size:11px; text-transform:uppercase; letter-spacing:1px;">Primary Clinical Verdict</h4>
        <h2 style="margin:6px 0; color:#ffffff; font-size:28px;">{alert.get('summary', 'Verdict Pending')}</h2>
        <p style="margin:0; color:var(--accent-blue); font-weight:600;">{alert.get('action_recommendation', '')}</p>
    </div>
    """, unsafe_allow_html=True)

    # Key Metrics Row
    c1, c2, c3 = st.columns([1, 1.2, 1])
    
    with c1:
        st.markdown('<div class="metric-card">', unsafe_allow_html=True)
        st.plotly_chart(create_discrepancy_meter(score), use_container_width=True, config={'displayModeBar': False})
        st.markdown('</div>', unsafe_allow_html=True)

    with c2:
        st.markdown('<div class="metric-card">', unsafe_allow_html=True)
        st.markdown("### 🧠 Adjudication Reason")
        reason = res.get('reasoning_trace', ['-'])[0]
        st.markdown(f"<p style='font-size:14px; color:#e1e4ed; line-height:1.6;'>{reason}</p>", unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

    with c3:
        st.markdown('<div class="metric-card">', unsafe_allow_html=True)
        st.markdown("### 📋 Agent Alignment")
        for report in res.get("agent_reports", []):
            name = report.get('agent_name', 'Agent')
            claims = report.get('claims', [{}])
            conf = claims[0].get('confidence', 0) if claims else 0
            st.markdown(f"""
            <div style="display:flex; justify-content:space-between; margin-bottom:12px; align-items:center;">
                <span style="font-size:13px; color:#8a92a8;">{name.title()}</span>
                {get_conf_html(conf)}
            </div>
            """, unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

    # Tabs for detail
    t1, t2, t3 = st.tabs(["🔍 Modality Evidence", "🧬 Audit Trail", "🛠️ Raw Data"])
    
    with t1:
        col_img, col_aud, col_note = st.columns(3)
        base_path = UPLOAD_DIR / current_case_id if mode == "Emergency Upload" else CASES_DIR / current_case_id
        
        with col_img:
            st.markdown("#### Imaging (X-Ray)")
            img_p = base_path / "xray.jpg"
            if img_p.exists(): st.image(str(img_p))
            else: st.info("No imaging available.")

        with col_aud:
            st.markdown("#### Acoustics (Lung)")
            aud_p = base_path / "audio.wav"
            if aud_p.exists(): st.audio(str(aud_p))
            else: st.info("No audio available.")
            
        with col_note:
            st.markdown("#### Clinical History")
            st.markdown(f"""
            <div style="background:#1a212d; padding:15px; border-radius:8px; border:1px solid var(--border); font-size:13px; color:#e1e4ed;">
                {clinical_note or "No history provided."}
            </div>
            """, unsafe_allow_html=True)

    with t2:
        for i, step in enumerate(res.get("reasoning_trace", [])):
            st.markdown(f"**[{i+1}] Adjudication Step:** {step}")

    with t3:
        st.json(res)

st.markdown("---")
st.caption("Aegis Clinical Consensus v2.1 • Medical Decision Support Tool")