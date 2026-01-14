import os
import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()
API_URL = os.getenv("API_URL", "http://127.0.0.1:8000")

st.set_page_config(page_title="Consensus Board", layout="wide")
st.title("Consensus Board — Discrepancy Resolver (Day 1 Stub)")

with st.sidebar:
    st.header("Case Input")
    case_id = st.text_input("Case ID", value="CASE_001")
    note = st.text_area("Clinical note text", height=160, value="Patient reports 10lb weight loss over 4 weeks. New wheezing.")

    st.caption("Day 1: image/audio are placeholders; we’ll wire real inference via Kaggle artifacts next.")
    run = st.button("Run Case")

if run:
    payload = {
        "case_id": case_id,
        "image_current_path": None,
        "image_prior_path": None,
        "audio_current_path": None,
        "audio_prior_path": None,
        "clinical_note_text": note,
    }
    resp = requests.post(f"{API_URL}/run", json=payload, timeout=60)
    resp.raise_for_status()
    out = resp.json()

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Alert Level", out["discrepancy_alert"]["level"])
    with col2:
        st.metric("Score", f'{out["discrepancy_alert"]["score"]:.2f}')
    with col3:
        st.write("Summary")
        st.info(out["discrepancy_alert"]["summary"])
    with col4:
        st.write("Contradictions")
        st.write(out["key_contradictions"] or ["None"])

    st.divider()
    c1, c2 = st.columns(2)
    with c1:
        st.subheader("Agent Reports")
        st.json(out["agent_reports"])
    with c2:
        st.subheader("Reasoning Trace")
        for line in out["reasoning_trace"]:
            st.write("- ", line)

    st.subheader("Recommended Data Actions")
    for a in out["recommended_data_actions"]:
        st.write("- ", a)

    st.subheader("Limitations")
    for l in out["limitations"]:
        st.write("- ", l)
