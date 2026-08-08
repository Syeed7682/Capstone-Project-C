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
from app.db import db_manager

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


class RegisterRequest(BaseModel):
    firstName: str
    lastName: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ReportGenerateRequest(BaseModel):
    session_id: str
    user_email: Optional[str] = None
    title: Optional[str] = "Clinical VQA Consultation Report"


# ── MongoDB Auth Endpoints ───────────────────────────────────────────────────

@app.post("/api/auth/register")
def register_user(req: RegisterRequest):
    """Register a new user account in MongoDB Atlas."""
    try:
        user = db_manager.register_user(
            first_name=req.firstName,
            last_name=req.lastName,
            email=req.email,
            password=req.password
        )
        db_manager.log_metadata("user_registered", {"email": req.email}, user_email=req.email)
        return {"user": user, "message": "User registered successfully."}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration error: {str(e)}")


@app.post("/api/auth/login")
def login_user(req: LoginRequest):
    """Authenticate user with MongoDB Atlas."""
    try:
        user = db_manager.authenticate_user(email=req.email, password=req.password)
        db_manager.log_metadata("user_login", {"email": req.email}, user_email=req.email)
        return {"user": user, "message": "Login successful."}
    except ValueError as ve:
        raise HTTPException(status_code=401, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication error: {str(e)}")


@app.get("/api/auth/me")
def get_current_user_info(email: str):
    """Fetch user profile from MongoDB."""
    user = db_manager.get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"user": user}


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
        config.HF_TOKEN = config.normalize_secret_value(req.hf_token)
        # Update OS env just in case
        os.environ["HF_TOKEN"] = config.HF_TOKEN
        
    if req.gemini_api_key is not None:
        config.GEMINI_API_KEY = config.normalize_secret_value(req.gemini_api_key)
        # Update OS env just in case
        os.environ["GEMINI_API_KEY"] = config.GEMINI_API_KEY
        
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

        # 3. Save to MongoDB Atlas (Messages, Sessions & System Metadata)
        active_sess_id = session_id if session_id else f"sess-{int(time.time()*1000)}"
        db_manager.save_message(session_id=active_sess_id, role="user", text=query_text)
        db_manager.save_message(
            session_id=active_sess_id,
            role="assistant",
            text=answer,
            engine=used_engine,
            retrieved=retrieved
        )
        db_manager.log_metadata(
            "vqa_query",
            {
                "query_length": len(query_text),
                "has_image": pil_image is not None,
                "engine": used_engine,
                "top_k": k,
                "alpha": a,
                "retrieved_count": len(retrieved or [])
            }
        )

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


class ClearSessionRequest(BaseModel):
    session_id: str

@app.post("/api/session/clear")
def clear_session(req: ClearSessionRequest):
    """Clear the session's chat history and active image cache."""
    session_dir = SESSIONS_DIR / req.session_id
    if session_dir.exists():
        import shutil
        try:
            shutil.rmtree(session_dir)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error clearing session folder: {str(e)}")
    return {"message": f"Session {req.session_id} cleared successfully."}


@app.get("/api/sessions")
def get_sessions():
    """List all past chat sessions and their previews."""
    sessions = []
    if SESSIONS_DIR.exists():
        for session_dir in SESSIONS_DIR.iterdir():
            if session_dir.is_dir():
                history_path = session_dir / "history.json"
                if history_path.exists():
                    try:
                        with open(history_path, "r") as f:
                            history = json.load(f)
                            if history and len(history) > 0:
                                # Use first user message as title, truncate to 40 chars
                                title = history[0].get("text", "New Chat")
                                if len(title) > 40:
                                    title = title[:37] + "..."
                                # Get modified time
                                mtime = history_path.stat().st_mtime
                                sessions.append({
                                    "session_id": session_dir.name,
                                    "title": title,
                                    "timestamp": mtime
                                })
                    except Exception:
                        pass
    # Sort by most recent first
    sessions.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"sessions": sessions}


@app.get("/api/session/{session_id}")
def get_session_history(session_id: str):
    """Fetch the full chat history for a specific session."""
    session_dir = SESSIONS_DIR / session_id
    history_path = session_dir / "history.json"
    
    if not history_path.exists():
        return {
            "session_id": session_id,
            "history": [],
            "has_image": False
        }
        
    try:
        with open(history_path, "r") as f:
            history = json.load(f)
            
        has_image = (session_dir / "active_image.jpg").exists()
        
        return {
            "session_id": session_id,
            "history": history,
            "has_image": has_image
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading history: {str(e)}")


@app.post("/api/rebuild-index")
def rebuild_index(background_tasks: BackgroundTasks):
    """Force rebuilding the FAISS index from the SLAKE dataset."""
    if pipeline.index_status.status == "indexing" or pipeline.index_status.status == "downloading":
        raise HTTPException(status_code=400, detail="Indexing is already in progress.")
        
    pipeline.index_status.update("not_started", 0.0, "Starting manual index rebuild...")
    background_tasks.add_task(pipeline.build_slake_index_sync)
    db_manager.log_metadata("rebuild_index", {"requested_by": "user"})
    return {"message": "Rebuilding index in background."}


# ── MongoDB Clinical Reports & Metadata Endpoints ───────────────────────────

@app.post("/api/reports/generate")
def generate_clinical_report(req: ReportGenerateRequest):
    """Generate and save a clinical VQA report in MongoDB."""
    messages = db_manager.get_session_messages(req.session_id)
    if not messages:
        # Check disk session history fallback
        session_dir = SESSIONS_DIR / req.session_id
        history_path = session_dir / "history.json"
        if history_path.exists():
            try:
                with open(history_path, "r") as f:
                    history = json.load(f)
                    messages = history
            except Exception:
                messages = []

    if not messages:
        raise HTTPException(status_code=404, detail="No session messages found to generate report.")

    # Formulate clinical summary & findings
    queries = [m.get("text", "") for m in messages if m.get("role") == "user"]
    answers = [m.get("text", "") for m in messages if m.get("role") == "assistant"]
    retrieved_items = []
    for m in messages:
        if m.get("retrieved"):
            retrieved_items.extend(m.get("retrieved"))

    summary = (
        f"Clinical Consultation session containing {len(queries)} user queries. "
        f"Key clinical topics evaluated: '{', '.join(queries[:3])}'."
    )
    
    findings = "\n\n".join(
        [f"Q: {q}\nA: {a}" for q, a in zip(queries, answers)]
    )

    report = db_manager.save_report(
        session_id=req.session_id,
        title=req.title or "Clinical VQA Consultation Report",
        summary=summary,
        findings=findings,
        user_email=req.user_email,
        retrieved_cases=retrieved_items[:5]
    )

    db_manager.log_metadata("report_generated", {"report_id": report["report_id"], "session_id": req.session_id}, user_email=req.user_email)
    return {"report": report}


@app.get("/api/reports")
def get_user_reports(user_email: Optional[str] = None):
    """Get all saved clinical reports from MongoDB."""
    reports = db_manager.get_reports(user_email)
    return {"reports": reports}


@app.get("/api/metadata")
def get_system_metadata_info():
    """Get system execution metadata and MongoDB Atlas storage statistics."""
    meta = db_manager.get_system_metadata()
    return {"metadata": meta}


# ── Frontend Routes ─────────────────────────────────────────────────────────

# Mount the static files folder (Vite build output)
STATIC_DIR = config.BASE_DIR.parent / "frontend" / "dist"
STATIC_DIR.mkdir(parents=True, exist_ok=True) # Ensure it exists to prevent startup crash

@app.get("/")
def get_index_page():
    """Serve the single-page application dashboard."""
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return JSONResponse(
        status_code=404,
        content={"message": "Frontend static file index.html is missing. Please run npm run build in frontend/"}
    )

# Mount the root to serve assets and other static files
app.mount("/", StaticFiles(directory=str(STATIC_DIR)), name="static")
