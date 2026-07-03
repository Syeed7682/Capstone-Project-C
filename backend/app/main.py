import os
import json
from io import BytesIO
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from PIL import Image

from app import config, pipeline

app = FastAPI(
    title="Medical Image VQA Multimodal RAG Backend",
    description="FastAPI backend for medical VQA grounded on the SLAKE dataset using BiomedCLIP + Pinecone/FAISS + LLMs",
    version="2.0.0"
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event to load/initialize FAISS index
@app.on_event("startup")
async def startup_event():
    # Initializes index (loads cached or builds in background thread)
    pipeline.init_rag_index()


# ── API Models ──────────────────────────────────────────────────────────────

class ConfigUpdateRequest(BaseModel):
    engine: Optional[str] = None
    hf_token: Optional[str] = None
    gemini_api_key: Optional[str] = None
    top_k: Optional[int] = None
    alpha: Optional[float] = None
    max_new_tokens: Optional[int] = None


# ── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/api/index-status")
def get_index_status():
    """Get the current compilation/download status of the SLAKE RAG index."""
    return {
        "status": pipeline.index_status.status,
        "progress": pipeline.index_status.progress,
        "message": pipeline.index_status.message,
        "error": pipeline.index_status.error,
    }


@app.get("/api/config")
def get_server_config():
    """Get the active backend configurations."""
    return {
        "device": config.DEVICE,
        "clip_model": config.CLIP_MODEL,
        "active_engine": config.GENERATIVE_ENGINE,
        "has_hf_token": bool(config.HF_TOKEN),
        "has_gemini_key": bool(config.GEMINI_API_KEY),
        "top_k": config.TOP_K,
        "alpha": config.ALPHA,
        "max_new_tokens": config.MAX_NEW_TOKENS,
        "available_engines": ["huggingface_api", "gemini_api", "local_moondream", "local_llava"],
        # Vector store info
        "vector_store": "pinecone" if config.USE_PINECONE else "faiss",
        "pinecone_index": config.PINECONE_INDEX_NAME if config.USE_PINECONE else None,
        "has_pinecone_key": bool(config.PINECONE_API_KEY),
    }


@app.post("/api/config")
def update_server_config(req: ConfigUpdateRequest):
    """Update configurations on-the-fly without restarting the server."""
    if req.engine is not None:
        if req.engine not in ["huggingface_api", "gemini_api", "local_moondream", "local_llava"]:
            raise HTTPException(status_code=400, detail="Invalid engine choice.")
        config.GENERATIVE_ENGINE = req.engine
        
    if req.hf_token is not None:
        config.HF_TOKEN = req.hf_token
        # Update OS env just in case
        os.environ["HF_TOKEN"] = req.hf_token
        
    if req.gemini_api_key is not None:
        config.GEMINI_API_KEY = req.gemini_api_key
        # Update OS env just in case
        os.environ["GEMINI_API_KEY"] = req.gemini_api_key
        
    if req.top_k is not None:
        if req.top_k < 1 or req.top_k > 20:
            raise HTTPException(status_code=400, detail="top_k must be between 1 and 20.")
        config.TOP_K = req.top_k
        
    if req.alpha is not None:
        if req.alpha < 0.0 or req.alpha > 1.0:
            raise HTTPException(status_code=400, detail="alpha must be between 0.0 and 1.0.")
        config.ALPHA = req.alpha
        
    if req.max_new_tokens is not None:
        config.MAX_NEW_TOKENS = req.max_new_tokens

    # Dynamically select engine if active engine has dependencies not fulfilled
    # and update credentials
    return get_server_config()


# Sessions data directory
SESSIONS_DIR = config.DATA_DIR / "sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


@app.post("/api/query")
def run_vqa_query(
    query_text: str = Form(...),
    query_image: Optional[UploadFile] = File(None),
    session_id: Optional[str] = Form(None),
    engine: Optional[str] = Form(None),
    top_k: Optional[int] = Form(None),
    alpha: Optional[float] = Form(None),
    max_new_tokens: Optional[int] = Form(None),
):
    """
    Submit a text query and optional medical image.
    Retrieves contexts from SLAKE and generates a medical VQA answer, supporting conversational history.
    """
    # Verify the active vector store (Pinecone or FAISS) is ready
    if not pipeline.is_index_ready():
        store = "Pinecone" if config.USE_PINECONE else "FAISS"
        raise HTTPException(
            status_code=503,
            detail=(
                f"{store} index is not ready. "
                f"Status: {pipeline.index_status.status} — {pipeline.index_status.message}"
            )
        )

    pil_image = None
    session_dir = None
    history = []

    # 1. Manage Session State (Chat History & Active Image Cache)
    if session_id:
        session_dir = SESSIONS_DIR / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        
        # Load conversation history
        history_path = session_dir / "history.json"
        if history_path.exists():
            try:
                with open(history_path, "r") as f:
                    history = json.load(f)
            except Exception as e:
                print(f"Error loading session history: {e}")
                history = []

        # Load/Save active image
        active_image_path = session_dir / "active_image.jpg"
        if query_image is not None and query_image.filename:
            try:
                content = query_image.file.read()
                pil_image = Image.open(BytesIO(content)).convert("RGB")
                # Cache uploaded image for follow-up turns
                pil_image.save(active_image_path, "JPEG")
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")
        else:
            # Check if there is a cached active image from a previous turn
            if active_image_path.exists():
                try:
                    pil_image = Image.open(active_image_path).convert("RGB")
                except Exception as e:
                    print(f"Error loading cached active image: {e}")
    else:
        # Standard stateless logic if no session_id provided
        if query_image is not None and query_image.filename:
            try:
                content = query_image.file.read()
                pil_image = Image.open(BytesIO(content)).convert("RGB")
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

    # Handle parameters defaults
    active_engine = engine if engine else config.GENERATIVE_ENGINE
    k = top_k if top_k is not None else config.TOP_K
    a = alpha if alpha is not None else config.ALPHA
    tokens = max_new_tokens if max_new_tokens is not None else config.MAX_NEW_TOKENS

    try:
        # Generate answer using chat history if available
        answer, retrieved, used_engine = pipeline.generate_answer(
            query_text=query_text,
            query_image=pil_image,
            engine=active_engine,
            top_k=k,
            alpha=a,
            max_new_tokens=tokens,
            history=history if session_id else None
        )
        
        # 2. Save Session state updates
        if session_id and session_dir:
            history.append({"role": "user", "text": query_text})
            history.append({"role": "assistant", "text": answer})
            with open(session_dir / "history.json", "w") as f:
                json.dump(history, f)

        return {
            "query_text": query_text,
            "answer": answer,
            "retrieved": retrieved,
            "engine": used_engine,
        }
    except Exception as e:
        import traceback
        print(f"Error handling /api/query: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")


@app.post("/api/session/clear")
def clear_session(session_id: str = Form(...)):
    """Clear the session's chat history and active image cache."""
    session_dir = SESSIONS_DIR / session_id
    if session_dir.exists():
        import shutil
        try:
            shutil.rmtree(session_dir)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error clearing session folder: {str(e)}")
    return {"message": f"Session {session_id} cleared successfully."}


@app.post("/api/rebuild-index")
def rebuild_index(background_tasks: BackgroundTasks):
    """Force rebuilding the FAISS index from the SLAKE dataset."""
    if pipeline.index_status.status == "indexing" or pipeline.index_status.status == "downloading":
        raise HTTPException(status_code=400, detail="Indexing is already in progress.")
        
    pipeline.index_status.update("not_started", 0.0, "Starting manual index rebuild...")
    background_tasks.add_task(pipeline.build_slake_index_sync)
    return {"message": "Rebuilding index in background."}


# ── Frontend Routes ─────────────────────────────────────────────────────────

# Mount the static files folder
STATIC_DIR = config.BASE_DIR.parent / "frontend"

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
def get_index_page():
    """Serve the single-page application dashboard."""
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return JSONResponse(
        status_code=404,
        content={"message": "Frontend static file index.html is missing. Place it in frontend/"}
    )
