# 🏥 Medical Image VQA — Multimodal RAG Web Application

A production-ready **Retrieval-Augmented Generation (RAG)** system for medical image Visual Question Answering (VQA). Combines **BiomedCLIP** embeddings, a **FAISS** vector index built from the **SLAKE** dataset, and a choice of four LLM backends — all wrapped in a premium dark-themed chatbot UI served by **FastAPI**.

---

## 📌 Overview

The system answers clinical questions about radiology images (X-rays, MRIs, CT scans) by first retrieving the most relevant question-answer pairs from the SLAKE knowledge base and then generating a grounded, anti-hallucination answer using the configured LLM engine.

**Full pipeline:**

```
Query (text + optional medical image)
        │
        ▼
BiomedCLIP Encoder  ←  fused image + text embedding (α-blend)
        │
        ▼
FAISS IndexFlatIP   ←  top-K nearest neighbors from SLAKE
        │
        ▼
Grounded Prompt Builder  ←  retrieved QA pairs + medical facts
        │
        ▼
LLM Engine (choose one: HF API / Gemini API / Moondream / LLaVA)
        │
        ▼
Answer  →  Chatbot UI with conversation history
```

---

## 🗂️ Project Structure

```
Capstone_Project/
├── run.py                          # Master startup script (uvicorn on :8000)
├── havedone.txt                    # Detailed session-by-session progress log
├── README.md                       # This file
├── System_Architecture.png         # Architecture diagram
├── Capstone_B.ipynb                # Original research notebook (reference only)
│
├── backend/
│   ├── requirements.txt            # All Python dependencies
│   └── app/
│       ├── __init__.py
│       ├── config.py               # Device detection, paths, engine defaults
│       ├── pipeline.py             # BiomedCLIP, FAISS indexing, retrieval, VQA
│       ├── main.py                 # FastAPI app: all REST endpoints + static serving
│       ├── test_pipeline.py        # Smoke test for imports and hardware config
│       └── static/                 # (reserved for future static assets)
│
└── frontend/
    ├── index.html                  # Single-page chatbot dashboard
    ├── style.css                   # Dark clinical theme, glassmorphism, animations
    └── app.js                      # Chat logic, session state, RAG context accordion
```

---

## 🧠 Models & Components

| Component | Model / Tool |
|---|---|
| Image + Text Encoder | [`microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224`](https://huggingface.co/microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224) |
| Vector Index | FAISS `IndexFlatIP` (inner-product / cosine similarity) |
| Dataset | [`BoKelvin/SLAKE`](https://huggingface.co/datasets/BoKelvin/SLAKE) — structured medical VQA |
| Engine A (default) | Hugging Face Serverless Inference API — `llava-hf/llava-1.5-7b-hf` |
| Engine B | Google Gemini 1.5 Flash API |
| Engine C | Local Moondream2 1.6B (CPU-friendly, ~2 GB RAM) |
| Engine D | Local LLaVA-1.5-7B (4-bit NF4, GPU only) |

**BiomedCLIP** is pretrained on 15 M biomedical image-caption pairs from PubMed Central — far more suited for medical retrieval than generic CLIP.

---

## ⚙️ Local Setup

### Requirements

- Python 3.9+
- Windows / Linux / macOS
- GPU optional (CPU works for Moondream2 and HF/Gemini API engines)

### 1. Clone & enter the project

```bash
git clone https://github.com/Syeed7682/Capstone-Project-C.git
cd Capstone-Project-C
```

### 2. Create & activate a virtual environment

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r backend/requirements.txt
```

This will install the necessary core libraries for the project, including:
- **FastAPI & Uvicorn** (for the web server and API)
- **PyTorch & OpenCLIP** (for BiomedCLIP image/text embeddings)
- **FAISS-CPU** (for high-speed vector search)
- **Hugging Face Transformers & Accelerate** (for local LLMs)
- **Google GenerativeAI** (for Gemini API backend)
- **Python-Dotenv** (for managing environment variables)

### 4. Set API keys (Environment Variables)

You only need API keys if you plan to use the cloud engines (Hugging Face API or Gemini). 

**Option A: Using a `.env` file (Recommended)**
Create a file named `.env` in the root of the project and add your keys:
```env
HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxx
```

**Option B: Using Terminal Commands**
```bash
# Windows CMD
set HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx
set GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxx

# PowerShell
$env:HF_TOKEN="hf_xxxxxxxxxxxxxxxxxxxx"
$env:GEMINI_API_KEY="AIzaxxxxxxxxxxxxxxxx"
```

### 5. Start the server (Run on Localhost)

```bash
python run.py
```

The server will start locally on your machine. Open your web browser and navigate to:
**http://localhost:8000** (or **http://127.0.0.1:8000**)

> **Note:** On first run the server will automatically download the SLAKE dataset metadata and `imgs.zip` (~640 MB) from Hugging Face, extract images, and build the FAISS index in a background thread. Progress is tracked in real time on the dashboard.

---

## 🚀 Using the Application

Open **http://localhost:8000** in your browser. You will see:

- **Welcome screen** with preset example queries
- **Chat window** — type a clinical question, optionally upload a radiology image
- **Settings panel** (left sidebar) — switch engines, adjust Top-K, α, max tokens, and paste API keys on the fly
- **RAG Context accordion** — expand each assistant reply to inspect the retrieved SLAKE examples that grounded the answer
- **Index status bar** — shows real-time download/indexing progress until the FAISS index is ready

### Conversational Multi-turn

The chatbot maintains full conversation history per `session_id`. Uploaded images are cached for follow-up questions — you only need to upload the image once.

---

## 🔌 REST API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/query` | Submit text + optional image, returns answer + retrieved contexts |
| `GET` | `/api/index-status` | Real-time FAISS build progress |
| `GET` | `/api/config` | Inspect active engine, alpha, top_k, token counts |
| `POST` | `/api/config` | Hot-swap engine, inject API keys, update hyperparameters |
| `POST` | `/api/rebuild-index` | Force a fresh SLAKE index rebuild |
| `POST` | `/api/session/clear` | Clear session history and cached image |
| `GET` | `/docs` | Interactive Swagger UI |

### Example curl

```bash
curl -X POST http://127.0.0.1:8000/api/query \
  -F "query_text=Is there any abnormality in this chest X-ray?" \
  -F "query_image=@chest_xray.jpg" \
  -F "session_id=demo-session-01"
```

---

## 🔧 Configuration Reference

All defaults are set in `backend/app/config.py` and can be overridden via environment variables or the `/api/config` endpoint at runtime.

| Variable | Default | Description |
|---|---|---|
| `GENERATIVE_ENGINE` | `gemini_api` | Active LLM backend |
| `CLIP_MODEL` | `microsoft/BiomedCLIP-...` | BiomedCLIP encoder |
| `TOP_K` | `5` | Retrieved SLAKE contexts per query |
| `ALPHA` | `0.6` | Image weight in fused embedding (0 = text-only, 1 = image-only) |
| `MAX_NEW_TOKENS` | `256` | Max tokens for generative response |
| `DIM` | `512` | BiomedCLIP embedding dimension |
| `DEVICE` | auto | `cuda` if available, else `cpu` |

---

## ⚡ Performance

The FAISS index is built with **batched BiomedCLIP inference** (`BATCH_SIZE=64`):

- Images and texts for each batch are stacked into a single tensor and passed through the encoder in one forward pass.
- This is **10–20× faster** than the naïve one-sample-at-a-time approach, especially on CPU.
- Index is saved to disk after the first build; subsequent server restarts load it instantly from cache.

---

## 📋 Notes & Limitations

- **CPU-only machines**: Use `gemini_api`, `huggingface_api`, or `local_moondream` engines. `local_llava` requires a CUDA GPU with ≥12 GB VRAM.
- **SLAKE images**: Downloaded automatically from Hugging Face (`imgs.zip`) on first run. The background thread shows real-time progress in the dashboard.
- **LLaVA-1.5-7B text-only queries**: A blank white placeholder image is used when no image is provided (LLaVA requires visual input).
- **Token API keys**: Never hardcoded. Injected via environment variables or the live `/api/config` endpoint — no server restart required.

---

## 📄 License

This project is intended for research and educational purposes. Please refer to the individual licenses of the SLAKE dataset, BiomedCLIP, and LLaVA-1.5 before any commercial use.