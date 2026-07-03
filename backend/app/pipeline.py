"""
pipeline.py
──────────
Multimodal RAG pipeline for Medical VQA.
Supports two vector store backends (auto-selected via config.USE_PINECONE):

  • Pinecone (cloud) — vectors stored permanently; instant startup after first build.
  • FAISS   (local)  — fallback when no Pinecone API key is configured.

Flow:
  1.  BiomedCLIP encodes image + text queries into 512-d unit vectors.
  2.  The index (Pinecone or FAISS) retrieves the top-K matching SLAKE examples.
  3.  A generative LLM (LLaVA / Gemini / Moondream) produces the final answer.
"""

import os
import sys
import json
import base64
import zipfile
import threading
import time
from pathlib import Path
from io import BytesIO
from typing import Optional, List, Dict, Any, Tuple

import numpy as np
import torch
import faiss
from PIL import Image
from tqdm import tqdm

from app import config

# ── Global model placeholders (lazy-loaded) ───────────────────────────────────
_biomedclip_model       = None
_biomedclip_preprocess  = None
_biomedclip_tokenizer   = None

_local_gen_model        = None
_local_gen_processor    = None
_local_gen_tokenizer    = None

# ── Global index placeholders ─────────────────────────────────────────────────
faiss_index    = None          # FAISS fallback index
index_metadata = []            # FAISS metadata list (Pinecone stores metadata in-index)
_pinecone_idx  = None          # Pinecone Index object (lazy-connected)


# ── Index status tracker ──────────────────────────────────────────────────────

class IndexStatusManager:
    def __init__(self):
        self.status   = "not_started"
        self.progress = 0.0
        self.message  = "Idle"
        self.error    = None
        self._lock    = threading.Lock()

    def update(self, status: str, progress: float, message: str, error: str = None):
        with self._lock:
            self.status   = status
            self.progress = progress
            self.message  = message
            if error:
                self.error = error

index_status = IndexStatusManager()


def is_index_ready() -> bool:
    """Return True when the active vector store is ready to serve queries."""
    if config.USE_PINECONE:
        return _pinecone_idx is not None and index_status.status == "ready"
    return faiss_index is not None and index_status.status == "ready"


# ── BiomedCLIP loading & inference ────────────────────────────────────────────

def load_biomedclip():
    """Load BiomedCLIP model and preprocessing components (cached after first load)."""
    global _biomedclip_model, _biomedclip_preprocess, _biomedclip_tokenizer
    if _biomedclip_model is not None:
        return _biomedclip_model, _biomedclip_preprocess, _biomedclip_tokenizer

    import open_clip
    print(f"Loading BiomedCLIP onto {config.DEVICE}...")
    model, _, preprocess = open_clip.create_model_and_transforms(
        f"hf-hub:{config.CLIP_MODEL}"
    )
    tokenizer = open_clip.get_tokenizer(f"hf-hub:{config.CLIP_MODEL}")

    _biomedclip_model      = model.to(config.DEVICE).eval()
    _biomedclip_preprocess = preprocess
    _biomedclip_tokenizer  = tokenizer

    print("BiomedCLIP loaded successfully.")
    return _biomedclip_model, _biomedclip_preprocess, _biomedclip_tokenizer


def embed_image(pil_img: Image.Image) -> np.ndarray:
    """Encode a PIL image to a unit-norm BiomedCLIP vector (shape: 1×512)."""
    model, preprocess, _ = load_biomedclip()
    with torch.no_grad():
        img_tensor = preprocess(pil_img.convert("RGB")).unsqueeze(0).to(config.DEVICE)
        vec = model.encode_image(img_tensor)
        vec = vec / vec.norm(dim=-1, keepdim=True)
        return vec.cpu().numpy().astype("float32")


def embed_text(text: str) -> np.ndarray:
    """Encode a text string to a unit-norm BiomedCLIP vector (shape: 1×512)."""
    model, _, tokenizer = load_biomedclip()
    with torch.no_grad():
        tokens = tokenizer([text]).to(config.DEVICE)
        vec = model.encode_text(tokens)
        vec = vec / vec.norm(dim=-1, keepdim=True)
        return vec.cpu().numpy().astype("float32")


def embed_image_batch(pil_imgs: list) -> np.ndarray:
    """Encode a batch of PIL images to unit-norm BiomedCLIP vectors."""
    model, preprocess, _ = load_biomedclip()
    with torch.no_grad():
        tensors = torch.stack(
            [preprocess(img.convert("RGB")) for img in pil_imgs]
        ).to(config.DEVICE)
        vecs = model.encode_image(tensors)
        vecs = vecs / vecs.norm(dim=-1, keepdim=True)
        return vecs.cpu().numpy().astype("float32")


def embed_text_batch(texts: list) -> np.ndarray:
    """Encode a batch of text strings to unit-norm BiomedCLIP vectors."""
    model, _, tokenizer = load_biomedclip()
    with torch.no_grad():
        tokens = tokenizer(texts).to(config.DEVICE)
        vecs = model.encode_text(tokens)
        vecs = vecs / vecs.norm(dim=-1, keepdim=True)
        return vecs.cpu().numpy().astype("float32")


# ── Pinecone helpers ──────────────────────────────────────────────────────────

def _get_pinecone_index():
    """
    Lazily connect to the Pinecone index and cache the client.
    Uses the host URL directly for the fastest possible connection.
    """
    global _pinecone_idx
    if _pinecone_idx is not None:
        return _pinecone_idx

    from pinecone import Pinecone
    pc = Pinecone(api_key=config.PINECONE_API_KEY)

    # Connect via the index host URL (avoids extra DNS lookup)
    if config.PINECONE_HOST:
        _pinecone_idx = pc.Index(
            name=config.PINECONE_INDEX_NAME,
            host=config.PINECONE_HOST,
        )
    else:
        _pinecone_idx = pc.Index(name=config.PINECONE_INDEX_NAME)

    print(f"Connected to Pinecone index: '{config.PINECONE_INDEX_NAME}'")
    return _pinecone_idx


def _init_pinecone_index():
    """Connect to Pinecone and check whether vectors are already present."""
    global _pinecone_idx
    try:
        index_status.update("connecting", 5.0, "Connecting to Pinecone cloud index...")
        pc_idx = _get_pinecone_index()

        stats         = pc_idx.describe_index_stats()
        ns_stats      = stats.get("namespaces", {}) if isinstance(stats, dict) else {}
        total_vectors = 0

        # Sum vectors across all namespaces (handles both dict and object response)
        if hasattr(stats, "total_vector_count"):
            total_vectors = stats.total_vector_count
        elif isinstance(stats, dict):
            total_vectors = stats.get("total_vector_count", 0)

        if total_vectors > 0:
            index_status.update(
                "ready", 100.0,
                f"✅ Pinecone index ready — {total_vectors:,} vectors loaded instantly."
            )
            print(f"Pinecone index ready with {total_vectors:,} vectors.")
        else:
            print("Pinecone index is empty. Starting background upsert...")
            index_status.update(
                "not_started", 0.0,
                "Pinecone index is empty. Building embeddings and uploading..."
            )
            thread = threading.Thread(target=build_slake_index_sync, daemon=True)
            thread.start()

    except Exception as exc:
        import traceback
        err = traceback.format_exc()
        index_status.update("failed", 0.0, f"Pinecone connection failed: {exc}", error=err)
        print(f"Pinecone init error:\n{err}")


def _build_and_upsert_to_pinecone():
    """Download SLAKE, embed all samples, and upsert vectors to Pinecone."""
    global _pinecone_idx
    try:
        # ── 1. Load SLAKE metadata from HuggingFace ──────────────────────────
        index_status.update("downloading", 0.0, "Downloading SLAKE dataset metadata from HuggingFace...")
        from datasets import load_dataset
        slake      = load_dataset("BoKelvin/SLAKE", trust_remote_code=True)
        train_split = slake["train"]

        # ── 2. Download & extract image zip if needed ─────────────────────────
        if not config.SLAKE_IMG_DIR.exists():
            index_status.update("downloading", 20.0, "Downloading SLAKE images (imgs.zip)...")
            from huggingface_hub import hf_hub_download
            zip_path = hf_hub_download(
                repo_id="BoKelvin/SLAKE",
                filename="imgs.zip",
                repo_type="dataset",
            )
            index_status.update("extracting", 50.0, "Extracting images...")
            with zipfile.ZipFile(zip_path, "r") as z:
                z.extractall(config.DATA_DIR)

            extracted = config.DATA_DIR / "imgs"
            if extracted.exists() and not config.SLAKE_IMG_DIR.exists():
                os.rename(extracted, config.SLAKE_IMG_DIR)

            index_status.update("extracting", 70.0, "Extraction complete.")
        else:
            index_status.update("extracting", 70.0, "Images already present — skipping download.")

        # ── 3. Filter valid English samples ───────────────────────────────────
        index_status.update("indexing", 72.0, "Filtering valid English samples...")

        def is_valid_sample(s):
            if s.get("q_lang") != "en":
                return False
            if not str(s.get("answer", "")).strip():
                return False
            if not str(s.get("question", "")).strip():
                return False
            return load_slake_image(s.get("img_name", "")) is not None

        valid_samples = [s for s in train_split if is_valid_sample(s)]
        total         = len(valid_samples)
        if total == 0:
            raise ValueError("No valid English samples found in SLAKE train split.")

        index_status.update("indexing", 75.0, f"Found {total:,} samples. Loading BiomedCLIP...")

        # ── 4. Load embedding model ────────────────────────────────────────────
        load_biomedclip()

        # ── 5. Embed in batches & upsert to Pinecone ──────────────────────────
        pc_idx     = _get_pinecone_index()
        EMBED_BATCH = 64    # BiomedCLIP embedding batch size
        UPSERT_BATCH = 100  # Pinecone upsert batch size (recommended max)
        processed  = 0
        upsert_buf = []     # buffer of (id, vector, metadata) tuples

        for batch_start in range(0, total, EMBED_BATCH):
            batch = valid_samples[batch_start: batch_start + EMBED_BATCH]

            imgs  = [load_slake_image(s["img_name"]) for s in batch]
            texts = [s["question"] for s in batch]

            img_vecs = embed_image_batch(imgs)
            txt_vecs = embed_text_batch(texts)

            fused = config.ALPHA * img_vecs + (1.0 - config.ALPHA) * txt_vecs
            norms = np.linalg.norm(fused, axis=-1, keepdims=True)
            fused /= np.where(norms == 0, 1.0, norms)

            for i, s in enumerate(batch):
                kbase_str = ""
                if s.get("base") and isinstance(s["base"], dict):
                    kbase_str = "; ".join(
                        f"{k}: {v}" for k, v in s["base"].items()
                        if v and str(v).strip()
                    )[:400]

                vec_id   = str(batch_start + i)
                metadata = {
                    "question":    s["question"],
                    "answer":      str(s["answer"]),
                    "answer_type": s.get("answer_type", ""),
                    "content_type": s.get("content_type", ""),
                    "img_organ":   s.get("img_organ", ""),
                    "kbase":       kbase_str,
                }
                upsert_buf.append({
                    "id":       vec_id,
                    "values":   fused[i].tolist(),
                    "metadata": metadata,
                })

                # Flush when buffer reaches UPSERT_BATCH
                if len(upsert_buf) >= UPSERT_BATCH:
                    pc_idx.upsert(vectors=upsert_buf, namespace=config.PINECONE_NAMESPACE)
                    upsert_buf.clear()

            processed += len(batch)
            pct = 75.0 + (22.0 * processed / total)
            index_status.update(
                "indexing", pct,
                f"Embedding & uploading: {processed:,}/{total:,} ({pct:.1f}%)"
            )

        # Flush any remaining vectors
        if upsert_buf:
            pc_idx.upsert(vectors=upsert_buf, namespace=config.PINECONE_NAMESPACE)

        # ── 6. Finalize ────────────────────────────────────────────────────────
        index_status.update(
            "ready", 100.0,
            f"✅ Pinecone index ready — {total:,} vectors uploaded successfully!"
        )
        print(f"Pinecone upsert complete. {total:,} vectors in namespace '{config.PINECONE_NAMESPACE}'.")

    except Exception as exc:
        import traceback
        err = traceback.format_exc()
        index_status.update("failed", 0.0, f"Pinecone build failed: {exc}", error=err)
        print(f"Error building Pinecone index:\n{err}")


# ── FAISS index manager (local fallback) ──────────────────────────────────────

def load_slake_image(img_name: str) -> Optional[Image.Image]:
    """Load a SLAKE image by its img_name field."""
    path = config.SLAKE_IMG_DIR / img_name
    if path.exists():
        return Image.open(path).convert("RGB")
    basename = os.path.basename(img_name)
    for root, _, files in os.walk(config.SLAKE_IMG_DIR):
        if basename in files:
            return Image.open(os.path.join(root, basename)).convert("RGB")
    return None


def _build_local_faiss():
    """Original FAISS index builder — used when Pinecone is not configured."""
    global faiss_index, index_metadata
    try:
        index_status.update("downloading", 0.0, "Downloading SLAKE dataset metadata...")
        from datasets import load_dataset
        slake      = load_dataset("BoKelvin/SLAKE", trust_remote_code=True)
        train_split = slake["train"]

        if not config.SLAKE_IMG_DIR.exists():
            index_status.update("downloading", 20.0, "Downloading SLAKE images zip...")
            from huggingface_hub import hf_hub_download
            zip_path = hf_hub_download(
                repo_id="BoKelvin/SLAKE",
                filename="imgs.zip",
                repo_type="dataset",
            )
            index_status.update("extracting", 50.0, "Extracting images...")
            with zipfile.ZipFile(zip_path, "r") as z:
                z.extractall(config.DATA_DIR)
            extracted = config.DATA_DIR / "imgs"
            if extracted.exists() and not config.SLAKE_IMG_DIR.exists():
                os.rename(extracted, config.SLAKE_IMG_DIR)
            index_status.update("extracting", 70.0, "Extraction complete.")
        else:
            index_status.update("extracting", 70.0, "Images already present.")

        index_status.update("indexing", 75.0, "Filtering valid English samples...")

        def is_valid_sample(s):
            if s.get("q_lang") != "en":
                return False
            if not str(s.get("answer", "")).strip():
                return False
            if not str(s.get("question", "")).strip():
                return False
            return load_slake_image(s.get("img_name", "")) is not None

        valid_samples = [s for s in train_split if is_valid_sample(s)]
        total         = len(valid_samples)
        if total == 0:
            raise ValueError("No valid English samples found in SLAKE train split.")

        index_status.update("indexing", 80.0, f"Found {total:,} samples. Building FAISS index...")
        load_biomedclip()

        BATCH_SIZE = 64
        index      = faiss.IndexFlatIP(config.DIM)
        metadata   = []
        processed  = 0

        for batch_start in range(0, total, BATCH_SIZE):
            batch = valid_samples[batch_start: batch_start + BATCH_SIZE]
            imgs  = [load_slake_image(s["img_name"]) for s in batch]
            texts = [s["question"] for s in batch]

            img_vecs = embed_image_batch(imgs)
            txt_vecs = embed_text_batch(texts)

            fused = config.ALPHA * img_vecs + (1.0 - config.ALPHA) * txt_vecs
            norms = np.linalg.norm(fused, axis=-1, keepdims=True)
            fused /= np.where(norms == 0, 1.0, norms)

            index.add(fused)

            for s in batch:
                kbase_str = ""
                if s.get("base") and isinstance(s["base"], dict):
                    kbase_str = "; ".join(
                        f"{k}: {v}" for k, v in s["base"].items()
                        if v and str(v).strip()
                    )[:400]
                metadata.append({
                    "question":     s["question"],
                    "answer":       str(s["answer"]),
                    "answer_type":  s.get("answer_type", ""),
                    "content_type": s.get("content_type", ""),
                    "img_organ":    s.get("img_organ", ""),
                    "kbase":        kbase_str,
                })

            processed += len(batch)
            pct = 80.0 + (15.0 * processed / total)
            index_status.update(
                "indexing", pct,
                f"Indexing: {processed:,}/{total:,} ({pct:.1f}%)"
            )

        index_status.update("indexing", 98.0, "Saving FAISS index to disk...")
        faiss.write_index(index, str(config.INDEX_PATH))
        with open(config.META_PATH, "w") as f:
            json.dump(metadata, f)

        faiss_index    = index
        index_metadata = metadata
        index_status.update("ready", 100.0, f"✅ FAISS index ready — {index.ntotal:,} vectors.")
        print(f"FAISS index saved to {config.INDEX_PATH}.")

    except Exception as exc:
        import traceback
        err = traceback.format_exc()
        index_status.update("failed", 0.0, f"FAISS build failed: {exc}", error=err)
        print(f"Error building FAISS index:\n{err}")


def _init_faiss_index():
    """Load FAISS index from disk if it exists, otherwise build in background."""
    global faiss_index, index_metadata
    if config.INDEX_PATH.exists() and config.META_PATH.exists():
        try:
            print("Loading existing FAISS index from disk...")
            faiss_index = faiss.read_index(str(config.INDEX_PATH))
            with open(config.META_PATH, "r") as f:
                index_metadata = json.load(f)
            index_status.update(
                "ready", 100.0,
                f"✅ FAISS index loaded — {faiss_index.ntotal:,} vectors."
            )
            print(f"FAISS index loaded: {faiss_index.ntotal:,} vectors.")
        except Exception as exc:
            print(f"Failed to load FAISS index ({exc}). Rebuilding...")
            thread = threading.Thread(target=build_slake_index_sync, daemon=True)
            thread.start()
    else:
        print("No FAISS index found. Starting background build...")
        thread = threading.Thread(target=build_slake_index_sync, daemon=True)
        thread.start()


# ── Public entry points ───────────────────────────────────────────────────────

def build_slake_index_sync():
    """
    Public entry point for building/uploading the index.
    Routes to Pinecone or FAISS based on config.USE_PINECONE.
    Called by init_rag_index() and the /api/rebuild-index endpoint.
    """
    if config.USE_PINECONE:
        _build_and_upsert_to_pinecone()
    else:
        _build_local_faiss()


def init_rag_index():
    """
    Initialize the vector store on server startup.
    • Pinecone: connects instantly; starts background upsert only if index is empty.
    • FAISS:    loads from disk if found; otherwise starts background build.
    """
    if config.USE_PINECONE:
        _init_pinecone_index()
    else:
        _init_faiss_index()


# ── Retrieval ─────────────────────────────────────────────────────────────────

def _retrieve_from_pinecone(
    query_vec: np.ndarray,
    top_k: int,
) -> List[Dict[str, Any]]:
    """Query Pinecone and return top-K results with metadata."""
    pc_idx = _get_pinecone_index()
    response = pc_idx.query(
        vector=query_vec[0].tolist(),
        top_k=top_k,
        include_metadata=True,
        namespace=config.PINECONE_NAMESPACE,
    )
    results = []
    for match in response.get("matches", []) if isinstance(response, dict) else response.matches:
        meta  = match.get("metadata", {}) if isinstance(match, dict) else match.metadata
        score = match.get("score", 0.0)   if isinstance(match, dict) else match.score
        entry = dict(meta)
        entry["score"] = float(score)
        results.append(entry)
    return results


def _retrieve_from_faiss(
    query_vec: np.ndarray,
    top_k: int,
) -> List[Dict[str, Any]]:
    """Search local FAISS index and return top-K results."""
    distances, indices = faiss_index.search(query_vec, top_k)
    results = []
    for dist, idx in zip(distances[0], indices[0]):
        if idx < 0 or idx >= len(index_metadata):
            continue
        entry = index_metadata[idx].copy()
        entry["score"] = float(dist)
        results.append(entry)
    return results


def retrieve(
    query_text: str,
    query_image: Optional[Image.Image] = None,
    top_k: int = config.TOP_K,
    alpha: float = config.ALPHA,
) -> List[Dict[str, Any]]:
    """
    Retrieve top-K matching SLAKE contexts using fused image+text embeddings.
    Automatically routes to Pinecone or FAISS based on configuration.
    """
    if config.USE_PINECONE and _pinecone_idx is None:
        raise RuntimeError(
            f"Pinecone index is not connected. "
            f"Status: {index_status.status} — {index_status.message}"
        )
    if not config.USE_PINECONE and faiss_index is None:
        raise RuntimeError(
            f"FAISS index is not loaded. "
            f"Status: {index_status.status} — {index_status.message}"
        )

    # Build fused query vector
    if query_image is not None and query_text:
        img_vec   = embed_image(query_image.convert("RGB"))
        txt_vec   = embed_text(query_text)
        query_vec = alpha * img_vec + (1.0 - alpha) * txt_vec
        query_vec /= np.linalg.norm(query_vec, axis=-1, keepdims=True)
    elif query_image is not None:
        query_vec = embed_image(query_image.convert("RGB"))
    else:
        query_vec = embed_text(query_text)

    if config.USE_PINECONE:
        return _retrieve_from_pinecone(query_vec, top_k)
    return _retrieve_from_faiss(query_vec, top_k)


# ── Prompt builders ───────────────────────────────────────────────────────────

def build_medical_prompt(query_text: str, retrieved: List[Dict[str, Any]]) -> str:
    """Builds a grounded radiological prompt from retrieved SLAKE examples."""
    context_lines = []
    for i, r in enumerate(retrieved[:3], 1):
        line = (
            f"[{i}] Related question : {r['question']}\n"
            f"     Known answer     : {r['answer']}\n"
            f"     Organ            : {r.get('img_organ', 'N/A')} | "
            f"Category: {r.get('content_type', 'N/A')}\n"
        )
        if r.get("kbase"):
            line += f"     Medical facts    : {r['kbase'][:200]}\n"
        context_lines.append(line)

    prompt = (
        "You are a medical AI assistant trained in radiology.\n"
        "Use the retrieved context below to answer the question.\n"
        "Give a concise, direct answer. "
        "If it is a yes/no question, answer Yes or No first.\n\n"
        "══ RETRIEVED CONTEXT ══\n"
        f"{''.join(context_lines)}\n"
        "══ QUESTION ══\n"
        f"{query_text}\n\n"
        "══ ANSWER ══\n"
    )
    return prompt


def build_medical_prompt_with_history(
    query_text: str,
    retrieved: List[Dict[str, Any]],
    history: List[Dict[str, str]],
) -> str:
    """Builds a clinical prompt with retrieved context, conversation history, and new query."""
    context_lines = []
    for i, r in enumerate(retrieved[:3], 1):
        line = (
            f"[{i}] Related question : {r['question']}\n"
            f"     Known answer     : {r['answer']}\n"
            f"     Organ            : {r.get('img_organ', 'N/A')} | "
            f"Category: {r.get('content_type', 'N/A')}\n"
        )
        if r.get("kbase"):
            line += f"     Medical facts    : {r['kbase'][:200]}\n"
        context_lines.append(line)

    history_str = ""
    if history:
        history_lines = []
        for turn in history[-6:]:
            role  = "User" if turn.get("role") == "user" else "Assistant"
            text  = turn.get("text", turn.get("content", ""))
            history_lines.append(f"{role}: {text}")
        history_str = "\n".join(history_lines)

    prompt = (
        "You are a medical AI assistant trained in radiology.\n"
        "Use the retrieved context below to answer the user's new question.\n"
        "Be concise and direct. If it is a yes/no question, answer Yes or No first.\n\n"
        "══ RETRIEVED CONTEXT ══\n"
        f"{''.join(context_lines)}\n\n"
    )
    if history_str:
        prompt += f"══ CONVERSATION HISTORY ══\n{history_str}\n\n"
    prompt += f"══ NEW QUESTION ══\n{query_text}\n\n══ ANSWER ══\n"
    return prompt


# ── Generative VQA engines ────────────────────────────────────────────────────

def _generate_via_hf_api(prompt: str, pil_image: Optional[Image.Image], max_tokens: int) -> str:
    """Uses Hugging Face Serverless Inference API to call LLaVA 1.5 7B."""
    if not config.HF_TOKEN:
        raise ValueError("HF_TOKEN environment variable is missing for the huggingface_api engine.")

    from huggingface_hub import InferenceClient
    client = InferenceClient(token=config.HF_TOKEN)

    if pil_image is None:
        pil_image = Image.new("RGB", (336, 336), color=(255, 255, 255))

    buffered = BytesIO()
    pil_image.save(buffered, format="JPEG")
    img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

    try:
        messages = [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}},
            ],
        }]
        response = client.chat.completions.create(
            model=config.GEN_MODEL_LLAVA,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"HuggingFace API Chat Completion error: {e}. Trying raw text-generation fallback...")
        try:
            llava_prompt = f"USER: <image>\n{prompt}\nASSISTANT:"
            response = client.text_generation(
                prompt=llava_prompt,
                model=config.GEN_MODEL_LLAVA,
                max_new_tokens=max_tokens,
                temperature=0.3,
            )
            return response.strip()
        except Exception as e2:
            return f"Error calling Hugging Face Inference API: {str(e2)}"


def _generate_via_gemini_api(prompt: str, pil_image: Optional[Image.Image], max_tokens: int) -> str:
    """Uses Google's Gemini 1.5 Flash API."""
    if not config.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is missing for the gemini_api engine.")

    import google.generativeai as genai
    genai.configure(api_key=config.GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")

    try:
        if pil_image is not None:
            response = model.generate_content([prompt, pil_image])
        else:
            response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"Error calling Gemini API: {str(e)}"


def _generate_via_local_moondream(prompt: str, pil_image: Optional[Image.Image], max_tokens: int) -> str:
    """Loads and runs tiny Moondream2 model locally on CPU."""
    global _local_gen_model, _local_gen_tokenizer

    from transformers import AutoModelForCausalLM, AutoTokenizer, AutoConfig, PreTrainedModel

    # Monkey-patch PreTrainedModel to support older trust_remote_code models in newer transformers
    if not hasattr(PreTrainedModel, 'all_tied_weights_keys'):
        def _get_tied(self):
            val = getattr(self, '_tied_weights_keys', {})
            if val is None:
                return {}
            if isinstance(val, list):
                return {k: [] for k in val}
            return val
        def _set_tied(self, val):
            self._tied_weights_keys = val
        PreTrainedModel.all_tied_weights_keys = property(_get_tied, _set_tied)

    if _local_gen_model is None:
        print(f"Loading local Moondream2 model onto {config.DEVICE}...")
        _local_gen_tokenizer = AutoTokenizer.from_pretrained(
            config.GEN_MODEL_MOONDREAM, revision="2024-08-26"
        )
        moondream_config = AutoConfig.from_pretrained(
            config.GEN_MODEL_MOONDREAM,
            revision="2024-08-26",
            trust_remote_code=True,
        )
        moondream_config.pad_token_id = _local_gen_tokenizer.eos_token_id
        if hasattr(moondream_config, "rope_scaling") and isinstance(moondream_config.rope_scaling, dict):
            if "type" not in moondream_config.rope_scaling or moondream_config.rope_scaling["type"] == "default":
                moondream_config.rope_scaling["type"] = "linear"
            if "factor" not in moondream_config.rope_scaling:
                moondream_config.rope_scaling["factor"] = 1.0

        for sub_config_name in ["phi_config", "text_config"]:
            if hasattr(moondream_config, sub_config_name):
                sub = getattr(moondream_config, sub_config_name)
                if isinstance(sub, dict):
                    sub["pad_token_id"] = _local_gen_tokenizer.eos_token_id
                    r = sub.get("rope_scaling")
                    if isinstance(r, dict):
                        if "type" not in r or r["type"] == "default":
                            r["type"] = "linear"
                        if "factor" not in r:
                            r["factor"] = 1.0
                else:
                    sub.pad_token_id = _local_gen_tokenizer.eos_token_id
                    if hasattr(sub, "rope_scaling") and isinstance(sub.rope_scaling, dict):
                        if "type" not in sub.rope_scaling or sub.rope_scaling["type"] == "default":
                            sub.rope_scaling["type"] = "linear"
                        if "factor" not in sub.rope_scaling:
                            sub.rope_scaling["factor"] = 1.0

        moondream_config.update({"pad_token_id": _local_gen_tokenizer.eos_token_id})
        _local_gen_model = AutoModelForCausalLM.from_pretrained(
            config.GEN_MODEL_MOONDREAM,
            revision="2024-08-26",
            trust_remote_code=True,
            config=moondream_config,
            torch_dtype=torch.float32 if config.DEVICE == "cpu" else torch.float16,
        ).to(config.DEVICE)
        print("Moondream2 loaded successfully.")

    if pil_image is None:
        pil_image = Image.new("RGB", (250, 250), color=(255, 255, 255))

    try:
        with torch.no_grad():
            answer = _local_gen_model.answer_question(
                pil_image, prompt, _local_gen_tokenizer
            )
        return answer.strip()
    except Exception as e:
        return f"Error executing local Moondream2: {str(e)}"


def _generate_via_local_llava(prompt: str, pil_image: Optional[Image.Image], max_tokens: int) -> str:
    """Loads and runs LLaVA-1.5-7B locally (GPU only for reasonable performance)."""
    global _local_gen_model, _local_gen_processor

    from transformers import LlavaForConditionalGeneration, AutoProcessor, BitsAndBytesConfig

    if _local_gen_model is None:
        print(f"Loading local LLaVA-1.5-7B onto {config.DEVICE}...")
        if config.DEVICE == "cuda":
            quant_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
            )
            _local_gen_model = LlavaForConditionalGeneration.from_pretrained(
                config.GEN_MODEL_LLAVA,
                quantization_config=quant_config,
                device_map="auto",
                torch_dtype=torch.float16,
            )
        else:
            print("WARNING: Loading LLaVA-1.5-7B on CPU. This will consume 14GB+ RAM.")
            _local_gen_model = LlavaForConditionalGeneration.from_pretrained(
                config.GEN_MODEL_LLAVA, torch_dtype=torch.float32,
            ).to(config.DEVICE)

        _local_gen_processor = AutoProcessor.from_pretrained(config.GEN_MODEL_LLAVA)
        _local_gen_model.eval()
        print("LLaVA-1.5-7B loaded successfully.")

    if pil_image is None:
        pil_image = Image.new("RGB", (336, 336), color=(255, 255, 255))

    llava_prompt = f"USER: <image>\n{prompt}\nASSISTANT:"
    try:
        inputs = _local_gen_processor(
            images=pil_image.convert("RGB"),
            text=llava_prompt,
            return_tensors="pt",
        ).to(_local_gen_model.device)
        input_length = inputs["input_ids"].shape[1]
        with torch.no_grad():
            output_ids = _local_gen_model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                num_beams=4,
                length_penalty=1.0,
                early_stopping=True,
                no_repeat_ngram_size=3,
                temperature=0.3,
                do_sample=False,
            )
        new_tokens = output_ids[0][input_length:]
        return _local_gen_processor.decode(new_tokens, skip_special_tokens=True).strip()
    except Exception as e:
        return f"Error executing local LLaVA: {str(e)}"


# ── Full RAG pipeline ─────────────────────────────────────────────────────────

def generate_answer(
    query_text: str,
    query_image: Optional[Image.Image] = None,
    engine: str = None,
    top_k: int = config.TOP_K,
    alpha: float = config.ALPHA,
    max_new_tokens: int = config.MAX_NEW_TOKENS,
    history: Optional[List[Dict[str, str]]] = None,
) -> Tuple[str, List[Dict[str, Any]], str]:
    """
    Retrieves context and generates an answer using the configured engine.
    Returns: (answer, retrieved_contexts, engine_used)
    """
    if engine is None:
        engine = config.GENERATIVE_ENGINE

    t0 = time.time()

    retrieved = retrieve(query_text, query_image, top_k=top_k, alpha=alpha)

    if history:
        prompt = build_medical_prompt_with_history(query_text, retrieved, history)
    else:
        prompt = build_medical_prompt(query_text, retrieved)

    print(f"Generating answer using engine: '{engine}'")

    if engine == "huggingface_api":
        answer = _generate_via_hf_api(prompt, query_image, max_new_tokens)
    elif engine == "gemini_api":
        answer = _generate_via_gemini_api(prompt, query_image, max_new_tokens)
    elif engine == "local_moondream":
        answer = _generate_via_local_moondream(prompt, query_image, max_new_tokens)
    elif engine == "local_llava":
        answer = _generate_via_local_llava(prompt, query_image, max_new_tokens)
    else:
        answer = f"Unknown generative engine: '{engine}'"

    print(f"VQA generated in {time.time() - t0:.2f}s using {engine}.")
    return answer, retrieved, engine
