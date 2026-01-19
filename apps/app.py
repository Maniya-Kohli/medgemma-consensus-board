import os
from pathlib import Path
import requests
import streamlit as st
import json
import uuid
import shutil
from dotenv import load_dotenv
from PIL import Image, ImageOps
import html

# ────────────────────────────────────────────────
# 1) SETUP & CONFIG
# ────────────────────────────────────────────────
load_dotenv()

API_URL = "http://127.0.0.1:8000"
CASES_DIR = Path("data/cases")
UPLOAD_DIR = Path("artifacts/runs") 

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

st.set_page_config(
    page_title="Aegis Clinical – AI Safety Net",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ────────────────────────────────────────────────
# ENHANCED CSS WITH INTERACTIVE ELEMENTS
# ────────────────────────────────────────────────
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;800;900&display=swap');

    /* Global font */
    body, .stApp, .stApp * {
      font-family: "Manrope", "Inter", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif !important;
    }

    .material-icons,
    .material-symbols-outlined,
    .material-symbols-rounded,
    .material-symbols-sharp,
    [data-testid="stIconMaterial"],
    [data-testid="stIconMaterial"] span,
    span[translate="no"] {
      font-family: "Material Symbols Rounded","Material Symbols Outlined","Material Icons" !important;
      font-weight: normal !important;
      font-style: normal !important;
      font-feature-settings: "liga" 1;
      -webkit-font-feature-settings: "liga";
    }

    /* App background */
    .stApp {
      background-color: #0b0f14 !important;
      color: #ffffff !important;
    }

    section[data-testid="stSidebar"] > div {
      background-color: #050505 !important;
      border-right: none !important;
      box-shadow: 10px 0 26px rgba(0,0,0,0.60) !important;
    }

    section[data-testid="stSidebar"] .block-container {
      padding-top: 1.1rem !important;
      padding-left: 1.0rem !important;
      padding-right: 1.0rem !important;
    }

    .main .block-container {
      padding-top: 2.2rem !important;
    }

    /* Brand header */
    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 6px 16px;
      margin-bottom: 12px;
    }

    .brand-icon {
      width: auto !important;
      height: auto !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      font-size: 48px !important;
      line-height: 1 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }

    section[data-testid="stSidebar"] .brand-title {
      font-family: "Manrope", "Inter", sans-serif !important;
      font-size: 42px !important;
      font-weight: 900 !important;
      line-height: 1.04 !important;
      letter-spacing: 0.25px !important;
      color: #ffffff !important;
      text-shadow: 0 0 18px rgba(25,118,210,0.18) !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    section[data-testid="stSidebar"] .brand-subtitle {
      font-family: "Manrope", "Inter", sans-serif !important;
      font-size: 14px !important;
      font-weight: 400 !important;
      letter-spacing: 0.25px !important;
      color: rgba(25,118,210,0.95) !important;
      margin-top: 4px !important;
    }

    /* Tabs styling */
    div[data-baseweb="tab-list"] {
      gap: 14px !important;
      padding: 6px 4px !important;
      border-bottom: none !important;
    }
    div[data-baseweb="tab-list"] button[role="tab"] {
      padding: 10px 16px !important;
      border-radius: 12px 12px 0 0 !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
    }
    div[data-baseweb="tab-list"] button[role="tab"] p {
      color: #cfcfcf !important;
      font-weight: 600 !important;
    }
    div[data-baseweb="tab-list"] button[aria-selected="true"] p {
      color: #ffffff !important;
      font-weight: 700 !important;
    }
    div[data-baseweb="tab-list"] button[aria-selected="true"] {
      border: none !important;
      box-shadow: none !important;
      background: rgba(255,255,255,0.04) !important;
    }
    div[data-baseweb="tab-highlight"] {
      background-color: transparent !important;
      height: 0px !important;
    }

    /* Uniform sidebar spacing */
    section[data-testid="stSidebar"] .stFileUploader,
    section[data-testid="stSidebar"] .stTextArea,
    section[data-testid="stSidebar"] .stSelectbox,
    section[data-testid="stSidebar"] .stRadio,
    section[data-testid="stSidebar"] .stButton {
      margin-top: 10px !important;
      margin-bottom: 10px !important;
    }

    /* Alerts */
    div[data-testid="stAlert"] {
      border: none !important;
      box-shadow: none !important;
      background: #070b10 !important;
    }
    div[data-testid="stAlert"] > div {
      border-left: none !important;
    }

    /* File uploader */
    section[data-testid="stSidebar"] div[data-testid="stFileUploader"] section {
      border: 1px solid #222 !important;
      background: #050505 !important;
      box-shadow: none !important;
      border-radius: 12px !important;
    }

    /* Case selectbox */
    div[data-baseweb="select"],
    div[data-baseweb="select"] > div,
    div[data-baseweb="select"] div[role="combobox"] {
      background: #070707 !important;
      border: 1px solid #222 !important;
      border-radius: 12px !important;
      box-shadow: none !important;
      outline: none !important;
    }
    div[data-baseweb="select"]:focus-within,
    div[data-baseweb="select"] div[role="combobox"]:focus-within {
      border-color: #222 !important;
      box-shadow: none !important;
      outline: none !important;
    }
    div[data-baseweb="select"] :is([aria-invalid="true"], input[aria-invalid="true"]) {
      border-color: #222 !important;
      box-shadow: none !important;
      outline: none !important;
    }

    /* Textarea */
    div[data-baseweb="textarea"] {
      background: #070707 !important;
      border: 1px solid #222 !important;
      border-radius: 12px !important;
      box-shadow: none !important;
      outline: none !important;
    }
    div[data-baseweb="textarea"] textarea {
      background: transparent !important;
      color: #ffffff !important;
      box-shadow: none !important;
      outline: none !important;
    }
    div[data-baseweb="textarea"]:focus-within {
      border-color: #1976d2 !important;
      box-shadow: 0 0 0 2px rgba(25,118,210,0.20) !important;
    }

    /* Inputs */
    div[data-baseweb="input"] {
      background: #070707 !important;
      border: 1px solid #222 !important;
      border-radius: 12px !important;
      box-shadow: none !important;
    }
    div[data-baseweb="input"]:focus-within {
      border-color: #1976d2 !important;
      box-shadow: 0 0 0 2px rgba(25,118,210,0.20) !important;
    }

    /* Radio pills */
    section[data-testid="stSidebar"] div[data-testid="stRadio"] div[role="radiogroup"] {
      gap: 14px !important;
    }
    section[data-testid="stSidebar"] div[data-testid="stRadio"] div[role="radiogroup"] > label {
      width: 100% !important;
      padding: 12px 14px !important;
      border-radius: 14px !important;
      border: 1px solid #222 !important;
      background: #050505 !important;
      margin: 0 !important;
    }
    section[data-testid="stSidebar"] div[data-testid="stRadio"] div[role="radiogroup"] > label:has(input:checked) {
      border: 1px solid #222 !important;
      background: rgba(25,118,210,0.18) !important;
    }
    section[data-testid="stSidebar"] div[data-testid="stRadio"] div[role="radiogroup"] > label:has(input:checked) p {
      color: rgba(25,118,210,0.98) !important;
      font-weight: 800 !important;
    }
    section[data-testid="stSidebar"] input[type="radio"] {
      accent-color: #1976d2 !important;
    }

    /* Risk boxes */
    .high-risk, .medium-risk, .low-risk {
      border: 1px solid #2a2a2a;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 1rem;
      color: #ffffff;
      background: #0a0a0a;
    }
    .high-risk { border-left: 5px solid #1976d2; }
    .medium-risk { border-left: 5px solid #0d47a1; background: #090909; }
    .low-risk { border-left: 5px solid rgba(25,118,210,0.65); background: #070707; }

    /* Audit box */
    .audit-box {
      background-color: #050505 !important;
      padding: 24px;
      border-radius: 12px;
      border: 1px solid rgba(25,118,210,0.65) !important;
      color: #e6e6e6 !important;
      line-height: 1.6;
    }

    /* Verdict */
    .verdict-box{
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid #222;
      background: #070b10;
      line-height: 1.5;
      margin-bottom: 14px !important;
    }
    .verdict-high{
      background: rgba(244, 67, 54, 0.12) !important;
      border-color: rgba(244, 67, 54, 0.35) !important;
      color: #ffd6d6 !important;
    }
    .verdict-medium{
      background: rgba(255, 193, 7, 0.12) !important;
      border-color: rgba(255, 193, 7, 0.35) !important;
      color: #ffe9b3 !important;
    }
    .verdict-low{
      background: rgba(76, 175, 80, 0.12) !important;
      border-color: rgba(76, 175, 80, 0.35) !important;
      color: #c8f5cc !important;
    }

    /* Buttons */
    section[data-testid="stSidebar"] button[kind="primary"] {
      background-color: #1976d2 !important;
      color: #000000 !important;
      font-weight: 800 !important;
      border: none !important;
      border-radius: 10px !important;
      padding: 0.65rem 0.9rem !important;
    }
    section[data-testid="stSidebar"] button[kind="primary"]:hover {
      filter: brightness(1.05) !important;
    }
    div.stButton > button:not([kind="primary"]) {
      background-color: transparent !important;
      border: 1px solid #2a2a2a !important;
      color: #a0a0a0 !important;
      border-radius: 10px !important;
    }
    div.stButton > button:not([kind="primary"]):hover {
      border-color: #3a3a3a !important;
      color: #ffffff !important;
    }

    /* INTERACTIVE HEATMAP STYLES */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .diagnostic-insight {
      background: linear-gradient(90deg, rgba(25,118,210,0.15) 0%, rgba(25,118,210,0.05) 100%);
      border: 1px solid rgba(25,118,210,0.3);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: fadeIn 0.5s ease-out;
    }

    .insight-icon {
      background: #1976d2;
      padding: 12px;
      border-radius: 10px;
      animation: pulse 2s ease-in-out infinite;
      font-size: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 52px;
      min-height: 52px;
    }

    .insight-icon.warning {
      background: #ff9800;
    }

    .insight-icon.critical {
      background: #f44336;
    }

    .insight-content {
      flex: 1;
    }

    .insight-title {
      font-size: 0.85rem;
      color: #8a92a8;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .insight-message {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 6px;
      color: #ffffff;
    }

    .insight-action {
      font-size: 0.9rem;
      color: #b0b8cc;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .confidence-badge {
      margin-left: 12px;
      background: rgba(25,118,210,0.2);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.85rem;
    }

    .heatmap-container {
      background: #0a0e14;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #1a1f2e;
      margin-top: 20px;
    }

    .heatmap-header {
      display: grid;
      grid-template-columns: 180px repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 8px;
      font-weight: 600;
      font-size: 0.85rem;
      color: #8a92a8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .heatmap-row {
      display: grid;
      grid-template-columns: 180px repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 8px;
    }

    .heatmap-label {
      display: flex;
      align-items: center;
      font-weight: 600;
      color: #e1e4ed;
      font-size: 0.95rem;
      padding: 12px;
      background: rgba(255,255,255,0.03);
      border-radius: 10px;
      transition: all 0.3s ease;
    }

    .heatmap-label:hover {
      background: rgba(25,118,210,0.1);
    }

    .heatmap-cell {
      height: 70px;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: 2px solid;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .heatmap-cell:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }

    .cell-confidence {
      font-size: 1.3rem;
      font-weight: 700;
      z-index: 2;
    }

    .cell-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.8;
      margin-top: 2px;
      z-index: 2;
    }

    .quality-indicator {
      margin-top: 16px;
      padding: 12px 16px;
      background: rgba(25,118,210,0.08);
      border-left: 3px solid #1976d2;
      border-radius: 6px;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .detail-panel {
      background: linear-gradient(135deg, rgba(25,118,210,0.15) 0%, rgba(25,118,210,0.05) 100%);
      border: 2px solid rgba(25,118,210,0.4);
      border-radius: 12px;
      padding: 24px;
      margin-top: 20px;
      animation: fadeIn 0.3s ease-out;
    }

    .detail-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      font-size: 1.2rem;
      font-weight: 600;
    }

    .detail-section {
      margin-bottom: 16px;
    }

    .detail-section-title {
      color: #8a92a8;
      font-size: 0.8rem;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .detail-section-content {
      font-size: 1rem;
      line-height: 1.5;
    }

    .interpretation-box {
      padding: 12px;
      border-radius: 8px;
      font-size: 0.9rem;
      border-left: 4px solid;
    }

    .modality-card {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      transition: all 0.3s ease;
    }

    .modality-card:hover {
      background: rgba(255,255,255,0.04);
      border-color: rgba(25,118,210,0.3);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }

    .modality-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .modality-icon {
      background: rgba(25,118,210,0.2);
      padding: 10px;
      border-radius: 8px;
      font-size: 24px;
      min-width: 44px;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .modality-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: #ffffff;
    }

    .finding-box {
      border-left: 6px solid;
      background: rgba(255,255,255,0.05);
      padding: 15px;
      border-radius: 4px;
      margin-top: 10px;
    }

    .finding-label {
      text-transform: uppercase;
      font-size: 0.8rem;
      margin-bottom: 6px;
      font-weight: 600;
    }

    .finding-text {
      font-size: 1.1rem;
      line-height: 1.4;
    }
    </style>
    """,
    unsafe_allow_html=True
)

# ────────────────────────────────────────────────
# HELPERS
# ────────────────────────────────────────────────

import streamlit as st
import json

def render_interactive_heatmap(confidence_matrix, agents_data, severity_labels):
    """
    Renders an interactive heatmap using React via st.components
    
    Args:
        confidence_matrix: dict of {modality: [conf1, conf2, conf3]}
        agents_data: dict of agent data
        severity_labels: list of severity category names
    """
    
    # Prepare data for React component
    heatmap_data = []
    for modality, confidences in confidence_matrix.items():
        agent = agents_data.get(modality)
        finding = agent['claims'][0]['value'] if agent and agent.get('claims') else "No data available"
        
        heatmap_data.append({
            'modality': modality,
            'confidences': confidences,
            'finding': finding
        })
    
    # Create the React component HTML
    component_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <style>
            * {{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }}
            body {{
                font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
                background: #0a0e14;
                color: #fff;
                padding: 20px;
            }}
            
            @keyframes pulse {{
                0%, 100% {{ opacity: 1; }}
                50% {{ opacity: 0.6; }}
            }}
            
            @keyframes fadeIn {{
                from {{ opacity: 0; transform: translateY(10px); }}
                to {{ opacity: 1; transform: translateY(0); }}
            }}
            
            .heatmap-container {{
                background: #0a0e14;
                border-radius: 12px;
                padding: 20px;
                border: 1px solid #1a1f2e;
                animation: fadeIn 0.5s ease-out;
            }}
            
            .heatmap-header {{
                display: grid;
                grid-template-columns: 180px repeat(3, 1fr);
                gap: 8px;
                margin-bottom: 12px;
                font-weight: 600;
                font-size: 0.85rem;
                color: #8a92a8;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }}
            
            .heatmap-row {{
                display: grid;
                grid-template-columns: 180px repeat(3, 1fr);
                gap: 8px;
                margin-bottom: 8px;
            }}
            
            .heatmap-label {{
                display: flex;
                align-items: center;
                font-weight: 600;
                color: #e1e4ed;
                font-size: 0.95rem;
                padding: 12px;
                background: rgba(255,255,255,0.03);
                border-radius: 10px;
                transition: all 0.3s ease;
            }}
            
            .heatmap-label:hover {{
                background: rgba(25,118,210,0.1);
            }}
            
            .heatmap-cell {{
                height: 70px;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border: 2px solid;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
                cursor: pointer;
            }}
            
            .heatmap-cell:hover {{
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(0,0,0,0.6) !important;
            }}
            
            .heatmap-cell.selected {{
                transform: scale(1.05);
                border-color: #fff !important;
                z-index: 10;
            }}
            
            .cell-confidence {{
                font-size: 1.3rem;
                font-weight: 700;
                z-index: 2;
            }}
            
            .cell-label {{
                font-size: 0.7rem;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                opacity: 0.8;
                margin-top: 2px;
                z-index: 2;
            }}
            
            .detail-panel {{
                background: linear-gradient(135deg, rgba(25,118,210,0.15) 0%, rgba(25,118,210,0.05) 100%);
                border: 2px solid rgba(25,118,210,0.4);
                border-radius: 12px;
                padding: 24px;
                margin-top: 20px;
                animation: fadeIn 0.3s ease-out;
            }}
            
            .detail-header {{
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
                font-size: 1.2rem;
                font-weight: 600;
            }}
            
            .detail-section {{
                margin-bottom: 16px;
            }}
            
            .detail-section-title {{
                color: #8a92a8;
                font-size: 0.8rem;
                margin-bottom: 6px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }}
            
            .detail-section-content {{
                font-size: 1rem;
                line-height: 1.5;
            }}
            
            .interpretation-box {{
                padding: 12px;
                border-radius: 8px;
                font-size: 0.9rem;
                border-left: 4px solid;
            }}
            
            .quality-indicator {{
                margin-top: 16px;
                padding: 12px 16px;
                background: rgba(25,118,210,0.08);
                border-left: 3px solid #1976d2;
                border-radius: 6px;
                font-size: 0.9rem;
                line-height: 1.5;
            }}
        </style>
    </head>
    <body>
        <div id="root"></div>
        
        <script type="text/babel">
            const {{ useState }} = React;
            
            const HeatmapComponent = () => {{
                const [selectedCell, setSelectedCell] = useState(null);
                
                const severityLabels = {json.dumps(severity_labels)};
                const heatmapData = {json.dumps(heatmap_data)};
                
                const getConfidenceStyle = (conf) => {{
                    if (conf >= 0.85) {{
                        return {{
                            bg: '#1976d2',
                            border: '#42a5f5',
                            text: '#ffffff',
                            opacity: 1.0,
                            glow: '0 0 20px rgba(25,118,210,0.5)',
                            pulse: true
                        }};
                    }} else if (conf >= 0.70) {{
                        return {{
                            bg: '#1976d2',
                            border: '#1976d2',
                            text: '#ffffff',
                            opacity: 0.8,
                            glow: '0 0 15px rgba(25,118,210,0.3)',
                            pulse: false
                        }};
                    }} else if (conf >= 0.50) {{
                        return {{
                            bg: '#ff9800',
                            border: '#ffb74d',
                            text: '#ffffff',
                            opacity: 0.9,
                            glow: '0 0 15px rgba(255,152,0,0.4)',
                            pulse: false
                        }};
                    }} else if (conf >= 0.30) {{
                        return {{
                            bg: '#ff9800',
                            border: '#ff9800',
                            text: '#ffffff',
                            opacity: 0.6,
                            glow: '0 0 10px rgba(255,152,0,0.2)',
                            pulse: false
                        }};
                    }} else {{
                        return {{
                            bg: '#37474f',
                            border: '#546e7a',
                            text: '#90a4ae',
                            opacity: 0.4,
                            glow: 'none',
                            pulse: false
                        }};
                    }}
                }};
                
                const handleCellClick = (modalityIdx, confIdx, conf, finding, severity) => {{
                    if (conf > 0) {{
                        const cellId = `${{modalityIdx}}-${{confIdx}}`;
                        setSelectedCell(selectedCell === cellId ? null : {{
                            id: cellId,
                            modality: heatmapData[modalityIdx].modality,
                            severity,
                            conf,
                            finding
                        }});
                    }}
                }};
                
                const lowQualityModalities = heatmapData
                    .filter(d => Math.max(...d.confidences) < 0.50 && Math.max(...d.confidences) > 0)
                    .map(d => ({{ name: d.modality, conf: Math.max(...d.confidences) }}));
                
                return (
                    <div className="heatmap-container">
                        <div className="heatmap-header">
                            <div></div>
                            {{severityLabels.map((label, idx) => (
                                <div key={{idx}} style={{{{ textAlign: 'center' }}}}>{{label}}</div>
                            ))}}
                        </div>
                        
                        {{heatmapData.map((data, modalityIdx) => (
                            <div key={{modalityIdx}} className="heatmap-row">
                                <div className="heatmap-label">{{data.modality}}</div>
                                {{data.confidences.map((conf, confIdx) => {{
                                    const style = getConfidenceStyle(conf);
                                    const cellId = `${{modalityIdx}}-${{confIdx}}`;
                                    const isSelected = selectedCell?.id === cellId;
                                    
                                    return (
                                        <div
                                            key={{confIdx}}
                                            className={{`heatmap-cell ${{isSelected ? 'selected' : ''}}`}}
                                            onClick={{() => handleCellClick(modalityIdx, confIdx, conf, data.finding, severityLabels[confIdx])}}
                                            style={{{{
                                                background: `linear-gradient(135deg, ${{style.bg}} 0%, ${{style.bg}}dd 100%)`,
                                                borderColor: isSelected ? '#fff' : style.border,
                                                color: style.text,
                                                opacity: style.opacity,
                                                boxShadow: isSelected ? '0 0 25px rgba(255,255,255,0.3)' : style.glow,
                                                animation: style.pulse ? 'pulse 2s ease-in-out infinite' : 'none'
                                            }}}}
                                        >
                                            {{conf > 0 ? (
                                                <>
                                                    <div className="cell-confidence">{{Math.round(conf * 100)}}%</div>
                                                    <div className="cell-label">Confidence</div>
                                                </>
                                            ) : (
                                                <div className="cell-label" style={{{{ fontSize: '0.75rem' }}}}>No Data</div>
                                            )}}
                                        </div>
                                    );
                                }})}}
                            </div>
                        ))}}
                        
                        {{lowQualityModalities.length > 0 && (
                            <div className="quality-indicator">
                                ⚠️ <strong>Data Quality Alert:</strong> Low confidence detected in {{lowQualityModalities.map((m, i) => 
                                    `${{m.name}} (${{Math.round(m.conf * 100)}}%)`
                                ).join(', ')}}. Discrepancies may reflect poor data quality rather than clinical findings.
                            </div>
                        )}}
                        
                        {{selectedCell && (
                            <div className="detail-panel">
                                <div className="detail-header">
                                    ℹ️ {{selectedCell.modality}} → {{selectedCell.severity}}
                                </div>
                                <div className="detail-section">
                                    <div className="detail-section-title">Clinical Finding</div>
                                    <div className="detail-section-content">{{selectedCell.finding}}</div>
                                </div>
                                <div className="detail-section">
                                    <div className="detail-section-title">Clinical Interpretation</div>
                                    <div 
                                        className="interpretation-box"
                                        style={{{{
                                            background: selectedCell.conf > 0.85 ? 'rgba(25,118,210,0.2)' : 
                                                       selectedCell.conf > 0.5 ? 'rgba(255,152,0,0.2)' : 'rgba(96,125,139,0.2)',
                                            borderColor: selectedCell.conf > 0.85 ? '#1976d2' : 
                                                        selectedCell.conf > 0.5 ? '#ff9800' : '#607d8b'
                                        }}}}
                                    >
                                        <strong>Interpretation:</strong> {{
                                            selectedCell.conf > 0.85 ? 
                                                'High confidence - finding is reliable for clinical decision making' :
                                            selectedCell.conf > 0.5 ?
                                                'Moderate confidence - correlate with other findings before acting' :
                                                'Low confidence - data quality issues detected, repeat examination recommended'
                                        }}
                                    </div>
                                </div>
                            </div>
                        )}}
                        
                        <div style={{{{
                            marginTop: '20px',
                            padding: '12px',
                            background: '#0a0e14',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            color: '#a0a8b8'
                        }}}}>
                            <strong>Interactive Guide:</strong> Click any cell to see detailed diagnostic reasoning • 
                            Brightness = confidence level • Glowing cells = high reliability • 
                            Orange = caution zone • Gray = unreliable data
                        </div>
                    </div>
                );
            }};
            
            const root = ReactDOM.createRoot(document.getElementById('root'));
            root.render(<HeatmapComponent />);
        </script>
    </body>
    </html>
    """
    
    # Render in Streamlit
    st.components.v1.html(component_html, height=600, scrolling=False)


def get_reliability_color(confidence):
    """Maps model confidence to a trust-level color."""
    if confidence >= 0.85:
        return "#1976d2"
    if confidence >= 0.50:
        return "#ff9800"
    return "#757575"

def safe_float(x, default=0.0):
    try: return float(str(x).replace("%", "")) if x is not None else default
    except: return default

def score_to_level(score: float) -> str:
    if score >= 0.70: return "high"
    if score >= 0.40: return "medium"
    return "low"

def get_severity_index(finding: str) -> int:
    """Maps finding strings to a 0-2 severity index for the heatmap."""
    finding = finding.lower()
    if any(word in finding for word in ["stable", "normal", "healthy", "no finding", "baseline"]):
        return 0
    if any(word in finding for word in ["pneumonia", "crackles", "wheeze", "weight loss", "acute", "fever", "edema"]):
        return 2
    return 1

def format_case_name(dir_name: str) -> str:
    if dir_name and dir_name.startswith("UPLOAD_"): return f"📁 Live Case: {dir_name.split('_')[1]}"
    clean = dir_name.replace("_", " ").title() if dir_name else ""
    return " ".join([str(int(p)) if p.isdigit() else p for p in clean.split()])

def get_case_artifacts(case_id: str):
    if not case_id: return None, None
    base = UPLOAD_DIR / case_id
    img = next((base / f for f in ["xray.jpg", "xray.jpeg", "xray.png"] if (base / f).exists()), None)
    audio = base / "audio.wav"
    return img, audio if audio and audio.exists() else None

def wipe_current_session():
    """Wipes session state and physically deletes patient data from disk."""
    if "active_case_id" in st.session_state:
        case_id = st.session_state.active_case_id
        path = UPLOAD_DIR / case_id
        if path.exists():
            shutil.rmtree(path)
    
    st.session_state.pop("analysis_result", None)
    st.session_state.pop("active_case_id", None)
    st.session_state.pop("temp_case_id", None)
    st.session_state.pop("selected_cell", None)

def handle_uploads(case_id, img_file, audio_file, note_text):
    path = UPLOAD_DIR / case_id
    path.mkdir(parents=True, exist_ok=True)
    
    if img_file:
        with open(path / "xray.jpg", "wb") as f:
            f.write(img_file.getbuffer())
    if audio_file:
        with open(path / "audio.wav", "wb") as f:
            f.write(audio_file.getbuffer())
    if note_text:
        (path / "note.txt").write_text(note_text)
    return case_id

def calculate_diagnostic_insight(agent_reports):
    """Generate AI diagnostic insight from agent reports"""
    agents = {a['agent_name']: a for a in agent_reports}
    
    img_conf = agents.get('imaging', {}).get('claims', [{}])[0].get('confidence', 0)
    aud_conf = agents.get('acoustics', {}).get('claims', [{}])[0].get('confidence', 0)
    hist_conf = agents.get('history', {}).get('claims', [{}])[0].get('confidence', 0)
    
    img_severity = get_severity_index(agents.get('imaging', {}).get('claims', [{}])[0].get('value', ''))
    aud_severity = get_severity_index(agents.get('acoustics', {}).get('claims', [{}])[0].get('value', ''))
    hist_severity = get_severity_index(agents.get('history', {}).get('claims', [{}])[0].get('value', ''))
    
    # High confidence acute findings
    if img_conf > 0.85 and hist_conf > 0.85 and img_severity == 2 and hist_severity == 2:
        if aud_conf < 0.5:
            return {
                "type": "quality-discrepancy",
                "icon": "⚠️",
                "message": "Strong consensus between imaging and history, but audio data is unreliable",
                "action": "Repeat acoustic exam in quieter environment or verify with stethoscope",
                "confidence": (img_conf + hist_conf) / 2
            }
        else:
            return {
                "type": "confirmed-acute",
                "icon": "🚨",
                "message": "Multi-modal consensus: Acute condition confirmed across all modalities",
                "action": "Immediate clinical intervention recommended",
                "confidence": (img_conf + hist_conf + aud_conf) / 3
            }
    
    # Conflicting signals
    if abs(img_severity - hist_severity) >= 2 or abs(img_severity - aud_severity) >= 2:
        return {
            "type": "conflict",
            "icon": "⚠️",
            "message": "Conflicting signals detected across modalities - investigation needed",
            "action": "Review raw data and consider additional diagnostic testing",
            "confidence": max(img_conf, hist_conf, aud_conf)
        }
    
    # Default monitoring
    return {
        "type": "monitoring",
        "icon": "ℹ️",
        "message": "Mixed signals detected - continue patient monitoring",
        "action": "Follow-up examination within 24 hours recommended",
        "confidence": (img_conf + hist_conf + aud_conf) / 3
    }

# ────────────────────────────────────────────────
# SIDEBAR - DATA ENTRY
# ────────────────────────────────────────────────
with st.sidebar:
    st.markdown(
        """
        <div class="brand">
          <div class="brand-icon">🛡️</div>
          <div class="brand-text">
            <div class="brand-title">Aegis Clinical</div>
            <div class="brand-subtitle">AI Safety Net</div>
          </div>
        </div>
        """,
        unsafe_allow_html=True
    )
    
    mode = st.radio("Analysis Mode", ["Library", "New Patient"], on_change=wipe_current_session)
    
    current_case_id = None
    
    if mode == "Library":
        case_ids = sorted(p.name for p in CASES_DIR.iterdir() if p.is_dir())
        selected_lib = st.selectbox("Select Research Case", case_ids, format_func=format_case_name)
        current_case_id = selected_lib
        
        note_path = CASES_DIR / selected_lib / "note.txt"
        note_content = note_path.read_text(encoding="utf-8") if note_path.exists() else ""
        clinical_note = st.text_area("Clinical Notes", value=note_content, height=170)
        
        lib_dest = UPLOAD_DIR / selected_lib
        if not lib_dest.exists():
            shutil.copytree(CASES_DIR / selected_lib, lib_dest)
    else:
        if "temp_case_id" not in st.session_state:
            st.session_state.temp_case_id = f"UPLOAD_{uuid.uuid4().hex[:6].upper()}"
        
        current_case_id = st.session_state.temp_case_id
        st.info(f"Session Active: {current_case_id}")
        
        up_img = st.file_uploader("Upload X-Ray (JPG/PNG)", type=["jpg", "jpeg", "png"])
        up_audio = st.file_uploader("Upload Lung Sounds (WAV)", type=["wav"])
        clinical_note = st.text_area("Patient History / Symptoms", placeholder="e.g. 55yo female...", height=150)
        
        if up_img or up_audio or clinical_note:
            handle_uploads(current_case_id, up_img, up_audio, clinical_note)

    st.divider()
    analyze_btn = st.button("Run Analysis", use_container_width=True, type="primary")
    st.button("Reset & Wipe Data", use_container_width=True, on_click=wipe_current_session)

# ────────────────────────────────────────────────
# MAIN FLOW
# ────────────────────────────────────────────────
st.markdown(f"## {format_case_name(current_case_id)}")

if analyze_btn:
    with st.status("Agents Deliberating...", expanded=True):
        try:
            payload = {"case_id": current_case_id, "clinical_note_text": clinical_note}
            resp = requests.post(f"{API_URL}/run", json=payload, timeout=120)
            if resp.ok:
                st.session_state["analysis_result"] = resp.json()
                st.session_state["active_case_id"] = current_case_id
            else: 
                st.error(f"API Error: {resp.text}")
        except Exception as e: 
            st.error(f"Connection Error: {e}")

out = st.session_state.get("analysis_result")

if out:
    col1, col2 = st.columns([1.2, 2.8], gap="large")
    
    with col1:
        score = safe_float(out['discrepancy_alert']['score'])
        level = score_to_level(score)
        
        st.markdown(f'<div class="{level}-risk">', unsafe_allow_html=True)
        st.metric("Discrepancy Score", f"{score:.2f}")
        st.markdown(f"Risk Level: {level.upper()}")
        st.markdown("</div>", unsafe_allow_html=True)
        
        st.subheader("Adjudicator Verdict")
        verdict = out["discrepancy_alert"]["summary"] or ""
        verdict_safe = html.escape(verdict)

        cls = "verdict-low"
        if level == "high":
            cls = "verdict-high"
        elif level == "medium":
            cls = "verdict-medium"

        st.markdown(f'<div class="verdict-box {cls}">{verdict_safe}</div>', unsafe_allow_html=True)
        
        action = out['recommended_data_actions'][0] if out['recommended_data_actions'] else "N/A"
        st.warning(f"Recommended Action: {action}")

    with col2:
        tab_review, tab_audit, tab_consult, tab_raw = st.tabs([
            "📋 Case Evidence", "🧠 Clinical Audit", "💬 AI Consultant", "🛠️ Debug"
        ])
        
        with tab_review:
            # AI DIAGNOSTIC INSIGHT BANNER
            insight = calculate_diagnostic_insight(out['agent_reports'])
            icon_class = "critical" if insight["type"] == "confirmed-acute" else "warning" if insight["type"] in ["quality-discrepancy", "conflict"] else ""
            
            st.markdown(f"""
                <div class="diagnostic-insight">
                    <div class="insight-icon {icon_class}">{insight["icon"]}</div>
                    <div class="insight-content">
                        <div class="insight-title">AI Diagnostic Insight</div>
                        <div class="insight-message">{html.escape(insight["message"])}</div>
                        <div class="insight-action">
                            ➤ {html.escape(insight["action"])}
                            <span class="confidence-badge">{int(insight["confidence"] * 100)}% confidence</span>
                        </div>
                    </div>
                </div>
            """, unsafe_allow_html=True)
            
            # MODALITY CARDS
            img_path, audio_path = get_case_artifacts(st.session_state.active_case_id)
            
            # Imaging Card
            img_agent = next((a for a in out['agent_reports'] if a['agent_name'] == "imaging"), None)
            if img_agent and img_agent['claims']:
                conf = img_agent['claims'][0]['confidence']
                finding = img_agent['claims'][0]['value']
                color = get_reliability_color(conf)
                
                st.markdown(f"""
                    <div class="modality-card">
                        <div class="modality-header">
                            <div class="modality-icon">🖼️</div>
                            <div class="modality-title">X-Ray Imaging Analysis</div>
                        </div>
                    </div>
                """, unsafe_allow_html=True)
                
                if img_path:
                    st.image(str(img_path), use_container_width=True)
                else:
                    st.warning("No image uploaded")
                
                st.markdown(f"""
                    <div class="finding-box" style="border-color: {color};">
                        <div class="finding-label" style="color: {color};">Imaging Finding ({conf:.0%} Confidence)</div>
                        <div class="finding-text">{html.escape(finding)}</div>
                    </div>
                """, unsafe_allow_html=True)
            
            st.markdown("<br>", unsafe_allow_html=True)
            
            # Acoustic Card
            aud_agent = next((a for a in out['agent_reports'] if a['agent_name'] == "acoustics"), None)
            if aud_agent and aud_agent['claims']:
                conf = aud_agent['claims'][0]['confidence']
                finding = aud_agent['claims'][0]['value']
                color = get_reliability_color(conf)
                
                st.markdown(f"""
                    <div class="modality-card">
                        <div class="modality-header">
                            <div class="modality-icon">🔊</div>
                            <div class="modality-title">Acoustic Profile Analysis</div>
                        </div>
                    </div>
                """, unsafe_allow_html=True)
                
                if audio_path:
                    st.audio(str(audio_path))
                else:
                    st.warning("No audio uploaded")
                
                st.markdown(f"""
                    <div class="finding-box" style="border-color: {color};">
                        <div class="finding-label" style="color: {color};">Acoustic Finding ({conf:.0%} Confidence)</div>
                        <div class="finding-text">{html.escape(finding)}</div>
                    </div>
                """, unsafe_allow_html=True)
            
            st.markdown("<br>", unsafe_allow_html=True)
            
            # Patient History Card
            hist_agent = next((a for a in out['agent_reports'] if a['agent_name'] == "history"), None)
            if hist_agent and hist_agent['claims']:
                conf = hist_agent['claims'][0]['confidence']
                finding = hist_agent['claims'][0]['value']
                color = get_reliability_color(conf)
                
                st.markdown(f"""
                    <div class="modality-card">
                        <div class="modality-header">
                            <div class="modality-icon">📋</div>
                            <div class="modality-title">Patient History Analysis</div>
                        </div>
                    </div>
                """, unsafe_allow_html=True)
                
                st.markdown(f"""
                    <div class="finding-box" style="border-color: {color};">
                        <div class="finding-label" style="color: {color};">Clinical History ({conf:.0%} Confidence)</div>
                        <div class="finding-text">{html.escape(finding)}</div>
                    </div>
                """, unsafe_allow_html=True)

            # INTERACTIVE HEATMAP
            st.divider()
            st.subheader("🔥 Interactive Confidence Heatmap")
            st.caption("Click any cell to see detailed diagnostic reasoning")

            # Build confidence matrix
            agents_data_dict = {
                "X-Ray Imaging": img_agent,
                "Lung Acoustics": aud_agent,
                "Patient History": hist_agent
            }

            severity_labels = ["Stable/Normal", "Inconclusive", "Acute/Critical"]
            confidence_matrix = {}
            
            for name, agent in agents_data_dict.items():
                confidence_matrix[name] = [0.0, 0.0, 0.0]
                if agent and agent['claims']:
                    finding = agent['claims'][0]['value']
                    conf = agent['claims'][0]['confidence']
                    target_idx = get_severity_index(finding)
                    confidence_matrix[name][target_idx] = conf
            
            # Prepare data for component
            heatmap_data = []
            for modality, confidences in confidence_matrix.items():
                agent = agents_data_dict.get(modality)
                finding = agent['claims'][0]['value'] if agent and agent.get('claims') else "No data available"
                heatmap_data.append({
                    'modality': modality,
                    'confidences': confidences,
                    'finding': finding
                })
            
            # Render interactive React heatmap
            component_html = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
                <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
                <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
                <style>
                    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
                    body {{ font-family: "Inter", sans-serif; background: #0a0e14; color: #fff; padding: 10px; }}
                    @keyframes pulse {{ 0%, 100% {{ opacity: 1; }} 50% {{ opacity: 0.6; }} }}
                    @keyframes fadeIn {{ from {{ opacity: 0; }} to {{ opacity: 1; }} }}
                    .heatmap-container {{ background: #0a0e14; border-radius: 12px; padding: 20px; border: 1px solid #1a1f2e; animation: fadeIn 0.5s ease-out; }}
                    .heatmap-header {{ display: grid; grid-template-columns: 180px repeat(3, 1fr); gap: 8px; margin-bottom: 12px; font-weight: 600; font-size: 0.85rem; color: #8a92a8; text-transform: uppercase; }}
                    .heatmap-row {{ display: grid; grid-template-columns: 180px repeat(3, 1fr); gap: 8px; margin-bottom: 8px; }}
                    .heatmap-label {{ display: flex; align-items: center; font-weight: 600; color: #e1e4ed; font-size: 0.95rem; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 10px; transition: all 0.3s ease; }}
                    .heatmap-label:hover {{ background: rgba(25,118,210,0.1); }}
                    .heatmap-cell {{ height: 70px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px solid; transition: all 0.3s ease; cursor: pointer; position: relative; overflow: hidden; }}
                    .heatmap-cell:hover {{ transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.6) !important; }}
                    .heatmap-cell.selected {{ transform: scale(1.05); border-color: #fff !important; z-index: 10; }}
                    .cell-confidence {{ font-size: 1.3rem; font-weight: 700; z-index: 2; }}
                    .cell-label {{ font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8; margin-top: 2px; z-index: 2; }}
                    .detail-panel {{ background: linear-gradient(135deg, rgba(25,118,210,0.15) 0%, rgba(25,118,210,0.05) 100%); border: 2px solid rgba(25,118,210,0.4); border-radius: 12px; padding: 24px; margin-top: 20px; animation: fadeIn 0.3s ease-out; }}
                    .detail-header {{ display: flex; align-items: center; gap: 12px; margin-bottom: 16px; font-size: 1.2rem; font-weight: 600; }}
                    .detail-section {{ margin-bottom: 16px; }}
                    .detail-section-title {{ color: #8a92a8; font-size: 0.8rem; margin-bottom: 6px; text-transform: uppercase; }}
                    .detail-section-content {{ font-size: 1rem; line-height: 1.5; }}
                    .interpretation-box {{ padding: 12px; border-radius: 8px; font-size: 0.9rem; border-left: 4px solid; }}
                    .quality-indicator {{ margin-top: 16px; padding: 12px 16px; background: rgba(25,118,210,0.08); border-left: 3px solid #1976d2; border-radius: 6px; font-size: 0.9rem; }}
                </style>
            </head>
            <body>
                <div id="root"></div>
                <script type="text/babel">
                    const {{ useState }} = React;
                    const HeatmapComponent = () => {{
                        const [selectedCell, setSelectedCell] = useState(null);
                        const severityLabels = {json.dumps(severity_labels)};
                        const heatmapData = {json.dumps(heatmap_data)};
                        
                        const getConfidenceStyle = (conf) => {{
                            if (conf >= 0.85) return {{ bg: '#1976d2', border: '#42a5f5', text: '#fff', opacity: 1.0, glow: '0 0 20px rgba(25,118,210,0.5)', pulse: true }};
                            if (conf >= 0.70) return {{ bg: '#1976d2', border: '#1976d2', text: '#fff', opacity: 0.8, glow: '0 0 15px rgba(25,118,210,0.3)', pulse: false }};
                            if (conf >= 0.50) return {{ bg: '#ff9800', border: '#ffb74d', text: '#fff', opacity: 0.9, glow: '0 0 15px rgba(255,152,0,0.4)', pulse: false }};
                            if (conf >= 0.30) return {{ bg: '#ff9800', border: '#ff9800', text: '#fff', opacity: 0.6, glow: '0 0 10px rgba(255,152,0,0.2)', pulse: false }};
                            return {{ bg: '#37474f', border: '#546e7a', text: '#90a4ae', opacity: 0.4, glow: 'none', pulse: false }};
                        }};
                        
                        const handleCellClick = (modalityIdx, confIdx, conf, finding, severity) => {{
                            if (conf > 0) {{
                                const cellId = `${{modalityIdx}}-${{confIdx}}`;
                                setSelectedCell(selectedCell?.id === cellId ? null : {{ id: cellId, modality: heatmapData[modalityIdx].modality, severity, conf, finding }});
                            }}
                        }};
                        
                        const lowQualityModalities = heatmapData.filter(d => Math.max(...d.confidences) < 0.50 && Math.max(...d.confidences) > 0);
                        
                        return (
                            <div className="heatmap-container">
                                <div className="heatmap-header">
                                    <div></div>
                                    {{severityLabels.map((label, idx) => <div key={{idx}} style={{{{ textAlign: 'center' }}}}>{{label}}</div>)}}
                                </div>
                                {{heatmapData.map((data, modalityIdx) => (
                                    <div key={{modalityIdx}} className="heatmap-row">
                                        <div className="heatmap-label">{{data.modality}}</div>
                                        {{data.confidences.map((conf, confIdx) => {{
                                            const style = getConfidenceStyle(conf);
                                            const cellId = `${{modalityIdx}}-${{confIdx}}`;
                                            const isSelected = selectedCell?.id === cellId;
                                            return (
                                                <div key={{confIdx}} className={{`heatmap-cell ${{isSelected ? 'selected' : ''}}`}}
                                                    onClick={{() => handleCellClick(modalityIdx, confIdx, conf, data.finding, severityLabels[confIdx])}}
                                                    style={{{{ background: `linear-gradient(135deg, ${{style.bg}} 0%, ${{style.bg}}dd 100%)`, borderColor: isSelected ? '#fff' : style.border, color: style.text, opacity: style.opacity, boxShadow: isSelected ? '0 0 25px rgba(255,255,255,0.3)' : style.glow, animation: style.pulse ? 'pulse 2s ease-in-out infinite' : 'none' }}}}>
                                                    {{conf > 0 ? <><div className="cell-confidence">{{Math.round(conf * 100)}}%</div><div className="cell-label">Confidence</div></> : <div className="cell-label" style={{{{ fontSize: '0.75rem' }}}}>No Data</div>}}
                                                </div>
                                            );
                                        }})}}
                                    </div>
                                ))}}
                                {{lowQualityModalities.length > 0 && (
                                    <div className="quality-indicator">⚠️ <strong>Data Quality Alert:</strong> Low confidence detected in {{lowQualityModalities.map(m => `${{m.modality}} (${{Math.round(Math.max(...m.confidences) * 100)}}%)`).join(', ')}}.</div>
                                )}}
                                {{selectedCell && (
                                    <div className="detail-panel">
                                        <div className="detail-header">ℹ️ {{selectedCell.modality}} → {{selectedCell.severity}}</div>
                                        <div className="detail-section">
                                            <div className="detail-section-title">Clinical Finding</div>
                                            <div className="detail-section-content">{{selectedCell.finding}}</div>
                                        </div>
                                        <div className="detail-section">
                                            <div className="detail-section-title">Clinical Interpretation</div>
                                            <div className="interpretation-box" style={{{{ background: selectedCell.conf > 0.85 ? 'rgba(25,118,210,0.2)' : selectedCell.conf > 0.5 ? 'rgba(255,152,0,0.2)' : 'rgba(96,125,139,0.2)', borderColor: selectedCell.conf > 0.85 ? '#1976d2' : selectedCell.conf > 0.5 ? '#ff9800' : '#607d8b' }}}}>
                                                <strong>Interpretation:</strong> {{selectedCell.conf > 0.85 ? 'High confidence - reliable for clinical decisions' : selectedCell.conf > 0.5 ? 'Moderate confidence - correlate with other findings' : 'Low confidence - repeat examination recommended'}}
                                            </div>
                                        </div>
                                    </div>
                                )}}
                                <div style={{{{ marginTop: '20px', padding: '12px', background: '#0a0e14', borderRadius: '8px', fontSize: '0.85rem', color: '#a0a8b8' }}}}>
                                    <strong>Interactive Guide:</strong> Click cells for details • Brightness = confidence • Glowing = high reliability • Orange = caution • Gray = unreliable
                                </div>
                            </div>
                        );
                    }};
                    ReactDOM.createRoot(document.getElementById('root')).render(<HeatmapComponent />);
                </script>
            </body>
            </html>
            """
            
            st.components.v1.html(component_html, height=650, scrolling=False)

        with tab_audit:
            full_audit = out.get("audit_markdown")
            thought_trace = out.get("thought_process")
            if not full_audit or "unavailable" in full_audit:
                st.warning("⚠️ Clinical Audit report unavailable.")
            else:
                st.markdown(f'<div class="audit-box">{full_audit}</div>', unsafe_allow_html=True)
                if thought_trace:
                    with st.expander("🔍 View Adjudication Logic (CoT)"):
                        st.markdown(thought_trace)
            st.divider()
            st.caption("📜 Report generated by MedGemma Multimodal Consensus.")

        with tab_consult:
            st.write("### 💬 AI Clinical Consultant")
            st.info("Interactive consultation available in next update.")

        with tab_raw:
            st.json(out)
else:
    st.info("👈 Enter patient data in the sidebar and click **Run Analysis**.")