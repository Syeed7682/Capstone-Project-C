import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

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
# Default to 'huggingface_api' if HF_TOKEN is configured, else fallback to 'local_moondream' (CPU friendly)
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
GEN_MODEL_LLAVA = "llava-hf/llava-1.5-7b-hf"
GEN_MODEL_MOONDREAM = "vikhyatk/moondream2"

# Dataset and FAISS paths
SLAKE_IMG_DIR = DATA_DIR / "slake_images"
INDEX_PATH = DATA_DIR / "slake_index.faiss"
META_PATH = DATA_DIR / "slake_meta.json"

# RAG Hyperparameters
TOP_K = 5
ALPHA = 0.6  # Fusion weight: alpha * image_embedding + (1 - alpha) * text_embedding
MAX_NEW_TOKENS = 128
