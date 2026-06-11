import sys
import os
from pathlib import Path

# Add backend to Python path
sys.path.append(str(Path(__file__).resolve().parent / "backend"))

if __name__ == "__main__":
    try:
        import uvicorn
    except ImportError:
        print("\n[ERROR] 'uvicorn' is not installed in the active environment.")
        print("Please install dependencies first by running:")
        print("    pip install -r backend/requirements.txt")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("Starting Medical VQA RAG FastAPI Server...")
    print("Dashboard available at: http://127.0.0.1:8000")
    print("API Documentation at:  http://127.0.0.1:8000/docs")
    print("=" * 60 + "\n")
    
    # Start uvicorn
    uvicorn.run(
        "app.main:app", 
        host="127.0.0.1", 
        port=8000, 
        reload=True
    )
