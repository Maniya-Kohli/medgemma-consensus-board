# 🧬 Consensus Board: Multimodal Discrepancy Detection

> **Winner, MedGemma Impact Challenge Submission** > _Preventing diagnostic errors by synthesizing conflicting clinical signals._

## 🚨 The Problem: "Siloed Signals"

In high-pressure clinical environments, **burnout causes blindness**. A fatigued clinician might see a "Stable" Chest X-ray and discharge a patient, missing the subtle "Wheeze" in the lung audio or the "Weight Loss" note buried in history.
**Medical errors are the 3rd leading cause of death.** We believe many of these are due to data disconnects, not lack of skill.

## 💡 The Solution: Agentic Consensus

**Consensus Board** is a Hybrid Agentic System that acts as an automated "Safety Net."
It employs specialized AI Agents to monitor distinct data streams (Vision, Audio, Text) and uses a **Consensus Agent (MedGemma)** to detect contradictions in real-time.

- **If all agents agree:** The dashboard shows Green (Low Risk).
- **If agents conflict (e.g., Vision says Healthy vs. Audio says Sick):** The dashboard triggers a **RED ALERT**, forcing a "Second Look" before discharge.

## 🏗️ Hybrid Architecture

We use a **Cloud-to-Edge** architecture to bring heavy Google Health AI models to lightweight hospital devices.

### 1. The Perception Layer (Cloud / T4 GPU)

_Runs heavily on Google Colab to process raw signals._

- **Visual Agent:** Uses **Google MedSigLIP** to analyze Chest X-rays for pneumonia, effusion, and stability.
- **Acoustic Agent:** Uses **Google HeAR (Health Acoustic Representations)** to generate vector embeddings from lung sounds (wheezes/crackles).
- **History Agent:** Uses **Google MedGemma 4B** to extract key symptoms (weight loss, fever) from unstructured notes.

### 2. The Consensus Layer (Local / Edge)

_Runs locally on the physician's device (MacBook/iPad)._

- **Discrepancy Resolver:** Aggregates the JSON outputs from the Perception Layer. It applies logic to weigh conflicting evidence (e.g., "Acoustic Biomarkers override Visual Stability if confidence > 85%").
- **Privacy First:** No raw patient images or audio leave the secure perception pipeline; only high-level embeddings and claims reach the dashboard.

## 🛠️ Tech Stack

- **Models:**
  - `google/medsiglip-448` (Vision)
  - `google/hear-pytorch` (Audio)
  - `google/medgemma-1.5-4b-it` (Language & Logic)
- **Backend:** FastAPI (Python)
- **Frontend:** Streamlit
- **Pipeline:** PyTorch, Hugging Face Transformers, Librosa

## 🚀 How to Run

### Step 1: Generate the "Perception" Data

Because `MedSigLIP` and `HeAR` require GPUs, we provide a Colab notebook to generate the case artifacts.

1.  Open `notebooks/MedGemma_Inference_Pipeline.ipynb` in Google Colab.
2.  Run all cells to process the raw X-rays and Audio.
3.  Download `case_pack_5.zip` and extract it to `artifacts/runs/`.

### Step 2: Launch the Consensus Board

On your local machine (Mac/PC):

```bash
# 1. Install Dependencies
pip install -r requirements.txt

# 2. Start the API Backend
python -m uvicorn apps.api.main:app --reload

# 3. Start the Dashboard (New Terminal)
streamlit run apps/app.py
```
