import sys
import os
from pathlib import Path

# Add backend directory to path
backend_path = Path(__file__).resolve().parent
sys.path.append(str(backend_path))

def test_imports():
    print("Testing module imports...")
    try:
        from app import config
        from app import pipeline
        print("SUCCESS: Config and Pipeline modules imported successfully!")
    except Exception as e:
        print(f"FAILED: Import error: {str(e)}")
        sys.exit(1)

def test_config():
    print("\nVerifying configurations...")
    from app import config
    print(f"Device configured: {config.DEVICE}")
    print(f"Embedding model: {config.CLIP_MODEL}")
    print(f"Active generative engine: {config.GENERATIVE_ENGINE}")
    print(f"Data directory: {config.DATA_DIR}")
    print(f"FAISS Index Path: {config.INDEX_PATH}")
    print(f"Metadata Path: {config.META_PATH}")
    print("SUCCESS: Config checks passed.")

def test_device_capabilities():
    print("\nChecking device capabilities...")
    import torch
    import faiss
    print(f"PyTorch version: {torch.__version__}")
    print(f"FAISS module: {faiss.__file__}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"CUDA device: {torch.cuda.get_device_name(0)}")
    else:
        print("Running in CPU mode. (Optimized local engines like 'huggingface_api', 'gemini_api' or 'local_moondream' should be used.)")
    print("SUCCESS: Library dependencies verified.")

if __name__ == "__main__":
    print("=== RUNNING PIPELINE VERIFICATION ===")
    test_imports()
    test_config()
    test_device_capabilities()
    print("\n=== VERIFICATION COMPLETED SUCCESSFULLY ===")
