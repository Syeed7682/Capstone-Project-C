import os
from pathlib import Path
from dotenv import load_dotenv

# Always load .env from the backend directory (where this config.py lives)
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Hardware Config
import torch
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Embedding Model (BiomedCLIP)
CLIP_MODEL = "microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224"
DIM = 512

# Generative Engine Settings
# Available engines: 'huggingface_api', 'gemini_api', 'local_moondream', 'local_llava'
HF_TOKEN = os.getenv("HF_TOKEN", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

if HF_TOKEN:
    DEFAULT_ENGINE = "huggingface_api"
elif GEMINI_API_KEY:
    DEFAULT_ENGINE = "gemini_api"
else:
    DEFAULT_ENGINE = "local_moondream"

GENERATIVE_ENGINE = os.getenv("GENERATIVE_ENGINE", DEFAULT_ENGINE)

# Model IDs
GEN_MODEL_LLAVA = "Qwen/Qwen2.5-VL-72B-Instruct"  # Cloud VLM via HF Inference API
GEN_MODEL_MOONDREAM = "vikhyatk/moondream2"

# Dataset and FAISS paths (used as local fallback when Pinecone is not configured)
SLAKE_IMG_DIR = DATA_DIR / "slake_images"
INDEX_PATH = DATA_DIR / "slake_index.faiss"
META_PATH = DATA_DIR / "slake_meta.json"

# ── Pinecone Cloud Vector Store ──────────────────────────────────────────────
# Set PINECONE_API_KEY in your .env file to enable cloud vector storage.
# When enabled, vectors are stored permanently in Pinecone — no local rebuild needed.
# Falls back to local FAISS if the key is not set.
PINECONE_API_KEY   = os.getenv("PINECONE_API_KEY", "")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "slake-index")
PINECONE_HOST      = os.getenv("PINECONE_HOST", "https://slake-index-gmci4oc.svc.aped-4627-b74a.pinecone.io")
PINECONE_NAMESPACE = os.getenv("PINECONE_NAMESPACE", "slake-vqa")

# Auto-detect which vector store to use
USE_PINECONE = bool(PINECONE_API_KEY)

# RAG Hyperparameters
TOP_K = 5
ALPHA = 0.6  # Fusion weight: alpha * image_embedding + (1 - alpha) * text_embedding
MAX_NEW_TOKENS = 128
