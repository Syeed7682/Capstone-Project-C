import os
from pathlib import Path
from dotenv import load_dotenv


def normalize_secret_value(value):
    """Trim whitespace and optional surrounding quotes from secrets."""
    if value is None:
        return ""
    if isinstance(value, str):
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1].strip()
        return value
    return str(value).strip()


# Load .env from the backend directory first, then the project root.
_ENV_CANDIDATES = [
    Path(__file__).resolve().parent.parent / ".env",  # backend/.env
    Path(__file__).resolve().parents[2] / ".env",     # project root/.env
]
for _env_path in _ENV_CANDIDATES:
    if _env_path.exists():
        load_dotenv(dotenv_path=_env_path, override=True)
        break

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
# Available engines: 'gemini_api', 'huggingface_api', 'local_moondream', 'local_llava'
HF_TOKEN = normalize_secret_value(os.getenv("HF_TOKEN", ""))
GEMINI_API_KEY = normalize_secret_value(os.getenv("GEMINI_API_KEY", ""))
HF_ENDPOINT = os.getenv("HF_ENDPOINT", "")

# Debug prints (mask secrets)
print("[DEBUG] HF_TOKEN loaded:", "present" if HF_TOKEN else "missing")
print("[DEBUG] GEMINI_API_KEY loaded:", "present" if GEMINI_API_KEY else "missing")
print("[DEBUG] HF_ENDPOINT:", HF_ENDPOINT if HF_ENDPOINT else "default")

if GEMINI_API_KEY:
    DEFAULT_ENGINE = "gemini_api"
elif HF_TOKEN:
    DEFAULT_ENGINE = "huggingface_api"
else:
    DEFAULT_ENGINE = "local_moondream"

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash-001")
USE_CUSTOM_HF_ENDPOINT = os.getenv("USE_CUSTOM_HF_ENDPOINT", "false").lower() in ("true", "1", "yes")
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
PINECONE_HOST = os.getenv("PINECONE_HOST", "https://slake-index-gmci4oc.svc.aped-4627-b74a.pinecone.io")
PINECONE_NAMESPACE = os.getenv("PINECONE_NAMESPACE", "slake-vqa")
PINECONE_ENVIRONMENT = os.getenv("PINECONE_ENVIRONMENT", "")
PINECONE_FALLBACK = os.getenv("PINECONE_FALLBACK", "true").lower() in ("true","1","yes")
USE_PINECONE = bool(PINECONE_API_KEY) and (bool(PINECONE_HOST) or bool(PINECONE_ENVIRONMENT))
TOP_K = 5
ALPHA = 0.6  # Fusion weight: alpha * image_embedding + (1 - alpha) * text_embedding
MAX_NEW_TOKENS = 128

# ── MongoDB Atlas Database ──────────────────────────────────────────────────
MONGODB_API_KEY = os.getenv("MONGODB_API_KEY", "")
MONGODB_URI     = os.getenv("MONGODB_URI", "")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "medvqa_db")

