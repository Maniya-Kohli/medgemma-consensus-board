# Multi-Agent Medical Diagnostic System

A Next.js-based medical diagnostic platform powered by a multi-agent AI system that processes multimodal medical data (images, audio, text) to provide comprehensive diagnostic insights.

## 🏗️ Architecture Overview

This project implements a sophisticated multi-agent blackboard system for medical diagnostics, evolved through two distinct phases:

---

## 📍 Phase 1: Sequential Multi-Agent Pipeline

### Overview

Phase 1 established the foundational architecture using a sequential processing pipeline where specialized agents worked independently in a predetermined order.

### Architecture Components

**Core Agents:**

- **AudioAgent**: Processes auscultation audio (lung sounds, heart sounds)
- **VisionAgent**: Analyzes medical imaging (X-rays, CT scans)
- **LeadClinician**: Synthesizes findings and generates final diagnosis

### Phase 1 Flow

```
┌─────────────────────────────────────────────────────────┐
│                    User Input                           │
│  (Medical History + Image + Audio)                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│              Sequential Processing                       │
└─────────────────────────────────────────────────────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
      ▼                     ▼
┌─────────────┐       ┌─────────────┐
│ AudioAgent  │       │VisionAgent  │
│             │       │             │
│ • Analyze   │       │ • Process   │
│   audio     │       │   medical   │
│   signals   │       │   images    │
│ • Extract   │       │ • Identify  │
│   features  │       │   patterns  │
└─────┬───────┘       └──────┬──────┘
      │                      │
      └──────────┬───────────┘
                 ▼
         ┌──────────────┐
         │LeadClinician │
         │              │
         │ • Synthesize │
         │   findings   │
         │ • Generate   │
         │   diagnosis  │
         └──────┬───────┘
                │
                ▼
         ┌──────────────┐
         │Final Report  │
         └──────────────┘
```

### Phase 1 Limitations

- Fixed execution order
- No dynamic prioritization
- Limited agent interaction
- No iterative refinement
- Agents couldn't react to each other's findings

---

## 🚀 Phase 2: Dynamic Blackboard Architecture (Current)

### Overview

Phase 2 introduces a sophisticated blackboard pattern where agents collaborate dynamically, share knowledge, and iteratively refine their analysis based on collective intelligence.

### Architecture Components

**Blackboard System:**

- **Knowledge Base**: Shared repository of findings and claims
- **Moderator**: Orchestrates agent execution based on priorities
- **Dynamic Agent Selection**: Agents are invoked based on context and need

**Enhanced Agent Capabilities:**

- **Priority-based Execution**: Agents have configurable priorities
- **Claim Posting**: Agents post structured findings with confidence scores
- **Cross-agent Awareness**: Agents can see and react to other agents' findings
- **Iterative Refinement**: Multiple rounds of analysis possible

### Phase 2 Flow

```
┌──────────────────────────────────────────────────────────────┐
│                      User Input                              │
│        (Medical History + Image + Audio)                     │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                 BLACKBOARD INITIALIZATION                     │
│  • Create shared knowledge base                              │
│  • Register all agents with priorities                       │
│  • Set termination criteria                                  │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │        MODERATOR               │
        │  • Select next agent           │
        │  • Check termination           │
        │  • Manage workflow             │
        └────────┬───────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌─────────┐ ┌─────────┐ ┌──────────────┐
│ Audio   │ │ Vision  │ │ Lead         │
│ Agent   │ │ Agent   │ │ Clinician    │
│         │ │         │ │              │
│Priority:│ │Priority:│ │ Priority: 1  │
│   10    │ │    5    │ │              │
└────┬────┘ └────┬────┘ └──────┬───────┘
     │           │             │
     │  ┌────────▼─────────┐   │
     └─►│   BLACKBOARD     │◄──┘
        │  Knowledge Base  │
        │                  │
        │ • Findings       │
        │ • Claims         │
        │ • Focus Areas    │
        │ • Hypothesis     │
        │ • Audit Trail    │
        └────────┬─────────┘
                 │
     ┌───────────┼───────────┐
     │           │           │
     ▼           ▼           ▼
  Read/Write  Read/Write  Read/Write
     │           │           │
     └───────────┴───────────┘
                 │
         ┌───────▼────────┐
         │  ITERATION?    │
         │                │
         │ Check if more  │
         │ agents needed  │
         └───┬────────┬───┘
             │        │
          YES│        │NO
             │        │
             ▼        ▼
         ┌───────┐ ┌────────────┐
         │REPEAT │ │  FINALIZE  │
         │CYCLE  │ │            │
         └───────┘ │ • Generate │
                   │   consensus│
                   │ • Create   │
                   │   report   │
                   └─────┬──────┘
                         │
                         ▼
                   ┌──────────┐
                   │  OUTPUT  │
                   │          │
                   │ • Final  │
                   │   Diag.  │
                   │ • Conf.  │
                   │ • Differ.│
                   │   Diag.  │
                   └──────────┘
```

### Detailed Phase 2 Workflow

#### 1. **Initialization**

```javascript
Blackboard = {
  inputs: { image_path, audio_path, history, context },
  knowledge_base: [],
  focus_areas: [],
  hypothesis: {},
  state: "active",
  audit_trail: [],
};
```

#### 2. **Agent Execution Cycle**

```
┌─────────────────────────────────────────────┐
│ MODERATOR: Select Agent by Priority        │
├─────────────────────────────────────────────┤
│                                             │
│  1. Scan available agents                   │
│  2. Check eligibility                       │
│  3. Select highest priority agent           │
│  4. Execute agent                           │
│                                             │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│ AGENT EXECUTION                              │
├──────────────────────────────────────────────┤
│                                              │
│  Agent.execute(blackboard) {                 │
│    1. Read blackboard knowledge              │
│    2. Process modality-specific data         │
│    3. Generate observations                  │
│    4. Post claims with confidence            │
│    5. Update focus areas                     │
│    6. Return status                          │
│  }                                           │
│                                              │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│ BLACKBOARD UPDATE                            │
├──────────────────────────────────────────────┤
│                                              │
│  • Add finding to knowledge_base             │
│  • Update focus_areas if provided            │
│  • Append to audit_trail                     │
│  • Recalculate priorities                    │
│                                              │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│ TERMINATION CHECK                            │
├──────────────────────────────────────────────┤
│                                              │
│  if (LeadClinician completed AND             │
│      min_findings >= threshold)              │
│    → FINALIZE                                │
│  else                                        │
│    → NEXT ITERATION                          │
│                                              │
└──────────────────────────────────────────────┘
```

#### 3. **Claim Structure**

```python
Claim = {
  "label": "Finding Type",
  "value": "Detailed observation",
  "confidence": 0.0-1.0,
  "source_agent": "Agent Name",
  "timestamp": float
}
```

#### 4. **Final Hypothesis Generation**

```python
Hypothesis = {
  "condition": "Primary Diagnosis",
  "confidence": 0.0-1.0,
  "reasoning": "Clinical reasoning",
  "differential_diagnosis": ["Alt 1", "Alt 2", ...],
  "consensus_summary": "Synthesis of all findings"
}
```

### Key Improvements in Phase 2

| Feature                 | Phase 1        | Phase 2                |
| ----------------------- | -------------- | ---------------------- |
| **Execution Model**     | Sequential     | Dynamic Priority-based |
| **Agent Communication** | None           | Shared Blackboard      |
| **Iteration**           | Single Pass    | Multi-iteration        |
| **Confidence Tracking** | Basic          | Per-claim granular     |
| **Focus Areas**         | None           | Dynamic identification |
| **Audit Trail**         | Limited        | Complete               |
| **Flexibility**         | Fixed pipeline | Adaptive workflow      |

### Blackboard Data Structure

```json
{
  "inputs": {
    "image_path": "/path/to/xray.jpg",
    "audio_path": "/path/to/auscultation.wav",
    "history": [{ "role": "user", "content": "symptoms" }],
    "context": {}
  },
  "knowledge_base": [
    {
      "agent": "AudioAgent",
      "status": "completed",
      "observation": "Detailed finding...",
      "claims": [
        {
          "label": "Neural Acoustic Intensity",
          "value": "Signal Mean: 0.0211",
          "confidence": 0.95,
          "source_agent": "AudioAgent",
          "timestamp": 1769567087.821221
        }
      ],
      "metadata": {},
      "error": null,
      "timestamp": "timestamp",
      "execution_time": 1.23
    }
  ],
  "focus_areas": ["pulmonary opacity"],
  "hypothesis": {
    "condition": "Lung Cancer",
    "confidence": 0.9,
    "reasoning": "...",
    "differential_diagnosis": ["Alt1", "Alt2"],
    "consensus_summary": "..."
  },
  "state": "complete",
  "audit_trail": [],
  "metadata": {}
}
```

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Backend**: Python-based agent system
- **AI/ML**:
  - LLM: Gemini Flash 2.0
  - Audio Processing: Neural network-based acoustic analysis
  - Vision: Medical image analysis models
- **UI**: React with Tailwind CSS
- **Font**: Geist (Vercel Font Family)

---

## 🚦 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.8+
- GPU support (T4 or better recommended)

### Installation

```bash
# Install frontend dependencies
npm install
# or
yarn install
# or
pnpm install
```

### Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

---

## 🎯 Features

### Current Features (Phase 2)

- ✅ Dynamic multi-agent collaboration
- ✅ Blackboard knowledge sharing
- ✅ Priority-based agent execution
- ✅ Iterative diagnostic refinement
- ✅ Confidence-scored findings
- ✅ Comprehensive audit trails
- ✅ Multimodal data processing (image, audio, text)
- ✅ Differential diagnosis generation
- ✅ GPU-accelerated processing

### Planned Features

- 🔄 Real-time streaming updates
- 🔄 Extended modality support (ECG, lab results)
- 🔄 Advanced visualization dashboard
- 🔄 Historical case comparison
- 🔄 Treatment recommendation engine

---

## 🧪 Example Usage

```python
# Initialize blackboard session
session = BlackboardSession(
    agents=[audio_agent, vision_agent, lead_clinician],
    moderator=moderator
)

# Process case
result = session.process_case(
    image_path="chest_xray.jpg",
    audio_path="lung_sounds.wav",
    history=[{
        "role": "user",
        "content": "Patient symptoms..."
    }]
)

# Access results
diagnosis = result["hypothesis"]["condition"]
confidence = result["hypothesis"]["confidence"]
reasoning = result["hypothesis"]["reasoning"]
```

---

## 📊 Agent Priority System

| Agent         | Priority | When Executed                       |
| ------------- | -------- | ----------------------------------- |
| AudioAgent    | 10       | First - Processes auscultation data |
| VisionAgent   | 5        | Second - Analyzes medical imaging   |
| LeadClinician | 1        | Last - Synthesizes all findings     |

_Lower priority number = executed later in the cycle_

---

## 🔍 Learn More

### Next.js Resources

- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features and API
- [Learn Next.js](https://nextjs.org/learn) - Interactive Next.js tutorial
- [Next.js GitHub Repository](https://github.com/vercel/next.js)

### Medical AI Resources

- Multi-agent systems in healthcare
- Blackboard pattern in AI systems
- Medical image analysis with deep learning

---

## 🚀 Deployment

### Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Backend Deployment

- Consider using cloud GPU instances (AWS, GCP, Azure)
- Set up proper API key management
- Implement request queuing for concurrent cases
- Monitor GPU memory usage

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📧 Contact

EMAIL : maniyakohli77@gmail.com

---

**Note**: This system is designed for research and educational purposes. Always consult qualified healthcare professionals for medical diagnosis and treatment decisions.
