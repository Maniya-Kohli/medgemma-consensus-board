# 🛡️ AEGis: MedGemma Clinical Consensus Board

**AEGis** (Agentic Evaluation & Gathersystem) is an advanced medical AI framework designed to resolve discrepancies between clinical modalities. By utilizing an **agentic multi-phase reasoning loop**, the system adjudicates evidence from **Radiology (X-Rays)**, **Bio-Acoustics (Lungs/Heart sounds)**, and **Patient History** to provide a unified diagnostic consensus.

---

## 🏗️ System Architecture & Multi-Agent Logic

AEGis operates as a **Hierarchical Multi-Agent System (MAS)** utilizing **Vertical Orchestration**. Specialized domain agents process raw multimodal data into high-level claims, which are then "handed up" to a Senior Adjudicator for final conflict resolution.

### 🧠 Reasoning Framework: Multi-Phase CoT

The system employs **Chain-of-Thought (CoT)** reasoning across its core agents to ensure clinical transparency.

- **Vision Agent Loop (Self-Correction CoT)**: Rather than a single pass, the Vision Agent follows a three-step internal monologue:

1. **Strategic Planning**: Formulates an observation plan based on clinical context (e.g., identifying primary anatomical regions of interest).
2. **High-Recall Execution**: Performs an ultra-sensitive scan for all potential abnormalities, including minor shadows or risk markers.
3. **Clinical Adjudication**: Refines "noisy" observations into a peer-reviewed technical rationale for the consensus board.

- **Consensus Agent Loop (Few-Shot CoT)**: The Adjudicator uses **Few-Shot CoT** to learn "Medical Debate" logic. It is trained via examples to prioritize clinical rules, such as acknowledging that radiographic findings often lag behind physical symptoms, over raw model confidence scores.

### 🤖 Agent Communication Structure

The system uses **Vertical Communication** (Top-Down/Bottom-Up) to maintain data integrity.

- **Parallel Execution**: The Acoustic (HeAR), Vision (MedGemma), and History (OpenBioLLM) agents work in parallel to prevent **cascading bias**.
- **Vertical Adjudication**: Structured findings are funneled into the **Consensus Board**. This supervisor agent has the authority to **override** individual agent findings if it detects cross-modal contradictions (e.g., overriding a "stable" X-ray if acoustics reveal new-onset crackles).

### 🛠️ ReAct Logic

During streaming, the system follows the **ReAct (Reason + Act)** pattern:

1. **Reason**: Analyzes clinical context to determine specific "Regions of Interest."
2. **Act**: Performs targeted feature extraction across imaging and acoustics.
3. **Refine**: Resolves discrepancies to produce the final clinical directive.

---

## 🧬 System Sequence Diagram

```text
+-------------------------------------------------------------------------------------+
|                       AEGIS: MEDGEMMA CLINICAL CONSENSUS BOARD                      |
+-------------------------------------------------------------------------------------+
|                                                                                     |
|   INTAKE                       PROCESSING                     OUTPUT                |
|   ------                       ----------                     ------                |
|                                                                                     |
|   Frontend UI (Next.js) ->     Vision Agent      ->           Consensus Agent       |
|   (Clinical Dashboard)         (MedGemma, Cloud)              (Adjudicator, Cloud)  |
|       |                            |                              |                 |
|       v                            v                              v                 |
|   Local Bridge (FastAPI)       Acoustic Agent    ->           FINAL DELIVERABLES    |
|   (Data Handler)               (HeAR, Cloud)                  (to Frontend UI)      |
|       |                            |                              |                 |
|       v                            v                              +-> Verdict       |
|   Inputs:                      Context Agent     ->           +-> Directives        |
|   - X-ray (Image)              (OpenBioLLM, Local)            +-> Heatmap           |
|   - Audio (WAV/MP3)                                                                 |
|   - History (Text)                                                                  |
|                                                                                     |
+-------------------------------------------------------------------------------------+
|                                                                                     |
|   CONTROL CENTER                                                                    |
|   --------------                                                                    |
|   main.py             -> Orchestrates the local pipeline & data flow                |
|   backend_brains.py   -> Manages Cloud Agents (Vision, Acoustic, Consensus)         |
|   page.tsx            -> Handles UI rendering & real-time stream display            |
|   run_case (API)      -> Executes the end-to-end analysis workflow                  |
|                                                                                     |
+-------------------------------------------------------------------------------------+

```

---

## 🛠️ Technical Stack

- **Frontend**: Next.js 14, Tailwind CSS, Lucide Icons, React-Markdown.
- **Backend**: FastAPI (Python), Uvicorn, Httpx (Streaming).
- **AI Models**:
- `google/medgemma-1.5-4b-it` (Vision/Reasoning).
- `google/hear-pytorch` (Acoustics).
- `koesn/llama3-openbiollm-8b` (Local Extraction).

- **Infrastructure**: Ngrok (Tunneling), PyTorch, Transformers.

---

## 🚦 Getting Started

### Backend Setup (Cloud/Colab)

1. Open the `backend_brains.py` script in a GPU-enabled Google Colab environment.
2. Add your HuggingFace Token with access to MedGemma.
3. Run the cells to launch the **Ngrok Tunnel**.
4. **Copy the generated API URL** (e.g., `https://xxxx.ngrok-free.app`).

### Local Bridge Setup

1. Navigate to the `/backend` directory.
2. Create a `.env` file and paste your Colab URL:

```env
API_URL=https://your-ngrok-url-here.ngrok-free.app

```

3. Install dependencies and start the local bridge:

```bash
pip install -r requirements.txt
python main.py

```

### Frontend Setup

1. Navigate to `/medgemma-ui`.
2. Install packages and run:

```bash
npm install
npm run dev

```

3. Access the dashboard at `http://localhost:3000`.
