# 🏥 Medical Image VQA — Multimodal RAG Web Application

A production-ready **Retrieval-Augmented Generation (RAG)** system for medical image Visual Question Answering (VQA). Combines **BiomedCLIP** embeddings, a **Pinecone cloud vector index (with local FAISS fallback)** built from the **SLAKE** dataset, and a choice of four LLM backends — all wrapped in a premium dark-themed chatbot UI served by **FastAPI** with **MongoDB Atlas** for secure user management and persistence.

---

## 📌 Overview

The system answers clinical questions about radiology images (X-rays, MRIs, CT scans) by first retrieving the most relevant question-answer pairs from the SLAKE knowledge base and then generating a grounded, anti-hallucination answer using the configured LLM engine. It features full user authentication, session persistence, profile customization, and automated clinical report generation.

**Full pipeline:**

```
Query (text + optional medical image)
        │
        ▼
BiomedCLIP Encoder  ←  fused image + text embedding (α-blend)
        │
        ▼
Pinecone / FAISS    ←  top-K nearest neighbors from SLAKE
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
├── diagram.md                      # Architecture and flow diagrams
├── System_Architecture.png         # Architecture diagram
├── Capstone_B.ipynb                # Original research notebook (reference only)
│
├── backend/
│   ├── requirements.txt            # All Python dependencies
│   └── app/
│       ├── __init__.py
│       ├── config.py               # Device detection, paths, engine defaults
│       ├── db.py                   # MongoDB Atlas & local JSON persistence manager
│       ├── pipeline.py             # BiomedCLIP, FAISS indexing, retrieval, VQA
│       ├── main.py                 # FastAPI app: REST endpoints, auth, and static serving
│       ├── test_pipeline.py        # Smoke test for imports and hardware config
│       └── static/                 # (reserved for future static assets)
│
└── frontend/
    ├── index.html                  # Single-page application entry point
    ├── package.json                # Frontend dependencies and scripts
    ├── vite.config.ts              # Vite bundler configuration
    └── src/
        ├── App.tsx                 # Main React component, routing & state
        ├── index.css               # Tailwind & custom CSS, clinical dark theme
        ├── types.ts                # TypeScript interfaces (User, Session, etc.)
        └── components/             # Reusable UI components (Sidebar, Chat, ProfileModal, ReportModal, etc.)
```

---

## 🧠 Models & Components

This system uses a **multi-model architecture** where two distinct types of AI models work together in a pipeline:

### 1. The Retrieval Model (The "Search Engine")
Before answering, the system needs to find similar past medical cases from the SLAKE database to use as reference.
*   **Model Used:** [`microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224`](https://huggingface.co/microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224)
*   **What it does:** It takes the uploaded X-ray and text question, converts them both into numerical coordinates (vectors), and searches the FAISS or Pinecone database for the most similar past clinical cases. BiomedCLIP is pretrained on 15 M biomedical image-caption pairs from PubMed Central — far more suited for medical retrieval than generic CLIP.

### 2. The Generative Model (The "Doctor")
Once the similar past cases are retrieved, a Vision-Language Model (VLM) looks at the actual image, reads the question, reads the retrieved past cases, and writes out the final grounded answer. 

| Generative Engine | Model | Note |
|---|---|---|
| Hugging Face API | `Qwen/Qwen2.5-VL-72B-Instruct` | Default fallback. Can be unreliable with large images on the free tier. |
| **Gemini API** | `gemini-1.5-flash` | **Highly Recommended**. Extremely reliable, fast, and excellent at medical imaging. |
| Local Moondream | `vikhyatk/moondream2` | Runs locally on CPU (~2 GB RAM). High privacy, lower reasoning. |
| Local LLaVA | `llava-hf/llava-1.5-7b-hf` | Runs locally (4-bit NF4) but requires a dedicated GPU (≥12 GB VRAM). |

---

## ⚙️ Local Setup

### Requirements

- Python 3.9+
- Windows / Linux / macOS
- GPU optional (CPU works for Moondream2 and HF/Gemini API engines)

### 1. Clone & enter the project

```bash
git clone https://github.com/Syeed7682/Capstone-Project-C.git
cd /d "e:\New folder\Capstone_Project"
rmdir /s /q .venv
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r backend/requirements.txt
python run.py
```
```bash
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

> If activation fails because the virtual environment points to a missing Windows Store Python stub, delete `.venv`, install a real Python 3.9+ from python.org, and recreate it.

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
- **Pinecone Client** (for cloud vector storage)
- **Pymongo** (for MongoDB Atlas integration)
- **Python-Dotenv** (for managing environment variables)

### 4. Set API keys (Environment Variables)

You only need API keys if you plan to use the cloud engines (Hugging Face API or Gemini). 

**Option A: Using a `.env` file (Recommended)**
Create a file named `.env` in the root of the project and add your keys:
```env
# MongoDB Atlas (User Accounts & Chat History)
MONGO_URI=mongodb+srv://<username>:<password>@cluster0...

# Pinecone Vector Store (Recommended for fast startups)
PINECONE_API_KEY=pcsk_xxxxxxxxxxxxxxxxxxxx
PINECONE_INDEX_NAME=slake-index
PINECONE_HOST=https://your-host.pinecone.io

# Cloud LLM Engines
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

There are two recommended ways to start the server to ensure Python resolves the import paths correctly:

**Method 1: Using the automated script (Simplest)**
Double-click `run_all.bat` in the root folder, or run it from the terminal:
```bash
.\run_all.bat
```
*(This script automatically changes to the `backend` directory, starts the server, and opens your browser.)*

**Method 2: Manual terminal commands**
If you prefer to start it manually, ensure your terminal is inside the `backend` folder:
```bash
cd backend
uvicorn app.main:app --reload
```

The server will start locally on your machine. Open your web browser and navigate to:
**http://localhost:8000** (or **http://127.0.0.1:8000**)

> **Note:** On first run the server will automatically download the SLAKE dataset metadata and `imgs.zip` (~640 MB) from Hugging Face, extract images, and upload the vectors to Pinecone (or build the local FAISS index) in a background thread. Once Pinecone is populated, all future server restarts will be nearly instantaneous.

---

## 🚀 Using the Application

Open **http://localhost:8000** in your browser. You will see:

- **Welcome screen** with preset example queries and authentication (Login/Signup)
- **Chat window** — type a clinical question, optionally upload a radiology image
- **Settings panel** (left sidebar) — switch engines, adjust Top-K, α, max tokens, and paste API keys on the fly
- **Profile Settings** — click your avatar in the sidebar to update your name, email, password, and profile image (or avatar gradient theme)
- **RAG Context accordion** — expand each assistant reply to inspect the retrieved SLAKE examples that grounded the answer
- **Clinical Reports** — generate and download PDF/Markdown consultation reports based on session history
- **Index status bar** — shows real-time download/indexing progress until the Pinecone/FAISS index is ready

### Conversational Multi-turn

The chatbot maintains full conversation history per `session_id`. Uploaded images are cached for follow-up questions — you only need to upload the image once.

---

## 🔌 REST API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user in MongoDB |
| `POST` | `/api/auth/login` | Authenticate and login user |
| `POST` | `/api/auth/update` | Update user profile (name, email, password, avatar/image) |
| `POST` | `/api/query` | Submit text + optional image, returns answer + retrieved contexts |
| `GET` | `/api/index-status` | Real-time Pinecone/FAISS build progress |
| `GET` | `/api/config` | Inspect active engine, alpha, top_k, token counts |
| `POST` | `/api/config` | Hot-swap engine, inject API keys, update hyperparameters |
| `POST` | `/api/rebuild-index` | Force a fresh SLAKE index rebuild |
| `POST` | `/api/session/clear` | Clear session history and cached image |
| `GET` | `/api/session/history` | Fetch chat history for a given session ID |
| `GET` | `/api/reports/list` | List generated clinical reports |
| `POST` | `/api/reports/generate` | Generate a new clinical report from session history |
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
- When using Pinecone, vectors are permanently stored in the cloud. After the initial 10-15 minute upload, **subsequent server restarts load instantly in < 5 seconds**.

---

## 📋 Notes & Limitations

- **CPU-only machines**: Use `gemini_api`, `huggingface_api`, or `local_moondream` engines. `local_llava` requires a CUDA GPU with ≥12 GB VRAM.
- **SLAKE images**: Downloaded automatically from Hugging Face (`imgs.zip`) on first run. The background thread shows real-time progress in the dashboard.
- **LLaVA-1.5-7B text-only queries**: A blank white placeholder image is used when no image is provided (LLaVA requires visual input).
- **Token API keys**: Never hardcoded. Injected via environment variables or the live `/api/config` endpoint — no server restart required.

---

## 📄 License

This project is intended for research and educational purposes. Please refer to the individual licenses of the SLAKE dataset, BiomedCLIP, and LLaVA-1.5 before any commercial use.
