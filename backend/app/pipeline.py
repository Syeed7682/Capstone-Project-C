import os
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

# Global model placeholders (lazy loaded)
_biomedclip_model = None
_biomedclip_preprocess = None
_biomedclip_tokenizer = None

_local_gen_model = None
_local_gen_processor = None
_local_gen_tokenizer = None

# Global index and metadata placeholders
faiss_index = None
index_metadata = []

# Index status tracker
class IndexStatusManager:
    def __init__(self):
        self.status = "not_started"  # not_started, downloading, extracting, indexing, ready, failed
        self.progress = 0.0          # percentage (0.0 to 100.0)
        self.message = "Idle"
        self.error = None
        self._lock = threading.Lock()

    def update(self, status: str, progress: float, message: str, error: str = None):
        with self._lock:
            self.status = status
            self.progress = progress
            self.message = message
            if error:
                self.error = error

index_status = IndexStatusManager()


# ── BiomedCLIP Loading & Inference ──────────────────────────────────────────

def load_biomedclip():
    """Load BiomedCLIP model and preprocessing components."""
    global _biomedclip_model, _biomedclip_preprocess, _biomedclip_tokenizer
    if _biomedclip_model is not None:
        return _biomedclip_model, _biomedclip_preprocess, _biomedclip_tokenizer

    import open_clip
    print(f"Loading BiomedCLIP onto {config.DEVICE}...")
    model, _, preprocess = open_clip.create_model_and_transforms(
        f"hf-hub:{config.CLIP_MODEL}"
    )
    tokenizer = open_clip.get_tokenizer(f"hf-hub:{config.CLIP_MODEL}")
    
    _biomedclip_model = model.to(config.DEVICE).eval()
    _biomedclip_preprocess = preprocess
    _biomedclip_tokenizer = tokenizer
    
    print("BiomedCLIP loaded successfully.")
    return _biomedclip_model, _biomedclip_preprocess, _biomedclip_tokenizer


def embed_image(pil_img: Image.Image) -> np.ndarray:
    """Encode a PIL image to a unit-norm BiomedCLIP vector."""
    model, preprocess, _ = load_biomedclip()
    with torch.no_grad():
        img_tensor = preprocess(pil_img.convert("RGB")).unsqueeze(0).to(config.DEVICE)
        vec = model.encode_image(img_tensor)
        vec = vec / vec.norm(dim=-1, keepdim=True)
        return vec.cpu().numpy().astype("float32")


def embed_text(text: str) -> np.ndarray:
    """Encode a text string to a unit-norm BiomedCLIP vector."""
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
        tensors = torch.stack([preprocess(img.convert("RGB")) for img in pil_imgs]).to(config.DEVICE)
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


# ── FAISS Index Manager (Background Build) ───────────────────────────────────

def load_slake_image(img_name: str) -> Optional[Image.Image]:
    """Load a SLAKE image by its img_name field from the downloaded directory."""
    path = config.SLAKE_IMG_DIR / img_name
    if path.exists():
        return Image.open(path).convert("RGB")

    # Try matching by filename inside the directories recursively
    basename = os.path.basename(img_name)
    for root, _, files in os.walk(config.SLAKE_IMG_DIR):
        if basename in files:
            return Image.open(os.path.join(root, basename)).convert("RGB")
    return None


def build_slake_index_sync():
    """Sync thread method to download dataset, images, and compile FAISS index."""
    global faiss_index, index_metadata
    try:
        index_status.update("downloading", 0.0, "Downloading SLAKE dataset metadata...")
        
        # 1. Load HF SLAKE metadata
        from datasets import load_dataset
        slake = load_dataset("BoKelvin/SLAKE", trust_remote_code=True)
        train_split = slake["train"]
        
        # 2. Download and extract image zip file
        if not config.SLAKE_IMG_DIR.exists():
            index_status.update("downloading", 20.0, "Downloading SLAKE images zip (imgs.zip) from Hugging Face...")
            from huggingface_hub import hf_hub_download
            zip_path = hf_hub_download(
                repo_id="BoKelvin/SLAKE",
                filename="imgs.zip",
                repo_type="dataset",
            )
            
            index_status.update("extracting", 50.0, "Extracting images to dataset folder...")
            extract_dir = config.DATA_DIR
            with zipfile.ZipFile(zip_path, "r") as z:
                z.extractall(extract_dir)
            
            extracted_imgs_path = extract_dir / "imgs"
            if extracted_imgs_path.exists() and not config.SLAKE_IMG_DIR.exists():
                os.rename(extracted_imgs_path, config.SLAKE_IMG_DIR)
                
            index_status.update("extracting", 70.0, "Dataset extraction completed.")
        else:
            index_status.update("extracting", 70.0, "Images already exist. Verifying...")

        # 3. Filter train split for valid english samples
        index_status.update("indexing", 75.0, "Filtering valid English dataset entries...")
        
        def is_valid_sample(sample):
            if sample.get("q_lang") != "en":
                return False
            if not str(sample.get("answer", "")).strip():
                return False
            if not str(sample.get("question", "")).strip():
                return False
            img = load_slake_image(sample.get("img_name", ""))
            return img is not None

        valid_samples = [s for s in train_split if is_valid_sample(s)]
        total_samples = len(valid_samples)
        
        if total_samples == 0:
            raise ValueError("No valid English samples found in the SLAKE train split.")
            
        index_status.update("indexing", 80.0, f"Found {total_samples} samples. Building embeddings...")

        # 4. Load BiomedCLIP model
        load_biomedclip()

        # 5. Build FAISS index using batched embedding (10-20x faster than one-by-one)
        BATCH_SIZE = 64
        index = faiss.IndexFlatIP(config.DIM)
        metadata = []
        processed = 0

        for batch_start in range(0, total_samples, BATCH_SIZE):
            batch = valid_samples[batch_start: batch_start + BATCH_SIZE]

            # Load images for this batch
            imgs = [load_slake_image(s["img_name"]) for s in batch]
            texts = [s["question"] for s in batch]

            # Batch encode
            img_vecs = embed_image_batch(imgs)   # (B, DIM)
            txt_vecs = embed_text_batch(texts)   # (B, DIM)

            # Fuse and normalise
            fused = config.ALPHA * img_vecs + (1.0 - config.ALPHA) * txt_vecs
            norms = np.linalg.norm(fused, axis=-1, keepdims=True)
            fused /= np.where(norms == 0, 1.0, norms)

            index.add(fused)

            for s in batch:
                # Format kbase
                kbase_str = ""
                if s.get("base") and isinstance(s["base"], dict):
                    kbase_str = "; ".join(
                        f"{k}: {v}" for k, v in s["base"].items()
                        if v and str(v).strip()
                    )[:400]

                metadata.append({
                    "question": s["question"],
                    "answer": str(s["answer"]),
                    "answer_type": s.get("answer_type", ""),
                    "content_type": s.get("content_type", ""),
                    "img_organ": s.get("img_organ", ""),
                    "kbase": kbase_str,
                })

            processed += len(batch)
            progress_pct = 80.0 + (15.0 * processed / total_samples)
            index_status.update(
                "indexing",
                progress_pct,
                f"Indexing samples: {processed}/{total_samples} ({progress_pct:.1f}%)"
            )

        # 6. Save FAISS index
        index_status.update("indexing", 98.0, "Saving FAISS index and metadata to disk...")
        faiss.write_index(index, str(config.INDEX_PATH))
        with open(config.META_PATH, "w") as f:
            json.dump(metadata, f)
            
        faiss_index = index
        index_metadata = metadata
        
        index_status.update("ready", 100.0, f"FAISS Index compiled and loaded! Loaded {index.ntotal} samples.")
        print(f"FAISS Index ready. Saved to {config.INDEX_PATH}.")
        
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        index_status.update("failed", 0.0, f"Index construction failed: {str(e)}", error=err_msg)
        print(f"Error building FAISS index: {err_msg}")


def init_rag_index():
    """Initialize index. Load from disk if files exist, otherwise start background build thread."""
    global faiss_index, index_metadata
    if config.INDEX_PATH.exists() and config.META_PATH.exists():
        try:
            print("Loading existing FAISS index from disk...")
            faiss_index = faiss.read_index(str(config.INDEX_PATH))
            with open(config.META_PATH, "r") as f:
                index_metadata = json.load(f)
            index_status.update("ready", 100.0, f"Loaded existing index with {faiss_index.ntotal} vectors.")
            print(f"Loaded existing index with {faiss_index.ntotal} vectors.")
        except Exception as e:
            print(f"Failed to load existing index: {str(e)}. Rebuilding...")
            thread = threading.Thread(target=build_slake_index_sync)
            thread.start()
    else:
        print("No index found. Starting background indexing thread...")
        thread = threading.Thread(target=build_slake_index_sync)
        thread.start()


# ── Retrieval Logic ──────────────────────────────────────────────────────────

def retrieve(
    query_text: str,
    query_image: Optional[Image.Image] = None,
    top_k: int = config.TOP_K,
    alpha: float = config.ALPHA,
) -> List[Dict[str, Any]]:
    """Retrieve top-K matching contexts using fused image+text embeddings."""
    global faiss_index, index_metadata
    
    if faiss_index is None:
        # Provide a clear error indicating the index is not ready
        raise RuntimeError(f"FAISS index is not loaded. Current status: {index_status.status} ({index_status.progress:.1f}% - {index_status.message})")
        
    if query_image is not None and query_text:
        img_vec = embed_image(query_image.convert("RGB"))
        txt_vec = embed_text(query_text)
        query_vec = alpha * img_vec + (1.0 - alpha) * txt_vec
        query_vec /= np.linalg.norm(query_vec, axis=-1, keepdims=True)
    elif query_image is not None:
        query_vec = embed_image(query_image.convert("RGB"))
    else:
        query_vec = embed_text(query_text)

    distances, indices = faiss_index.search(query_vec, top_k)

    results = []
    for dist, idx in zip(distances[0], indices[0]):
        if idx < 0 or idx >= len(index_metadata):
            continue
        entry = index_metadata[idx].copy()
        entry["score"] = float(dist)
        results.append(entry)

    return results


def build_medical_prompt(query_text: str, retrieved: List[Dict[str, Any]]) -> str:
    """Builds a grounded radiological prompt from retrieved SLAKE examples."""
    context_lines = []
    # Take top 3 to prevent LLaVA prompt length issues
    for i, r in enumerate(retrieved[:3], 1):
        organ = r.get("img_organ", "N/A")
        ctype = r.get("content_type", "N/A")
        kbase = r.get("kbase", "")

        line = (
            f"[{i}] Related question : {r['question']}\n"
            f"     Known answer     : {r['answer']}\n"
            f"     Organ            : {organ} | Category: {ctype}\n"
        )
        if kbase:
            line += f"     Medical facts    : {kbase[:200]}\n"

        context_lines.append(line)

    context_str = "\n".join(context_lines)

    prompt = (
        "You are a medical AI assistant trained in radiology.\n"
        "Use the retrieved context below to answer the question.\n"
        "Give a concise, direct answer. "
        "If it is a yes/no question, answer Yes or No first.\n\n"
        "══ RETRIEVED CONTEXT ══\n"
        f"{context_str}\n"
        "══ QUESTION ══\n"
        f"{query_text}\n\n"
        "══ ANSWER ══\n"
    )
    return prompt


# ── Generative VQA Engines ───────────────────────────────────────────────────

def _generate_via_hf_api(prompt: str, pil_image: Optional[Image.Image], max_tokens: int) -> str:
    """Uses Hugging Face Serverless Inference API to call LLaVA 1.5 7B."""
    if not config.HF_TOKEN:
        raise ValueError("HF_TOKEN environment variable is missing for the huggingface_api engine.")
        
    from huggingface_hub import InferenceClient
    
    # Standard inference endpoint for LLaVA-1.5-7B
    client = InferenceClient(token=config.HF_TOKEN)
    
    # If no image, create a white placeholder as LLaVA requires visual input
    if pil_image is None:
        pil_image = Image.new("RGB", (336, 336), color=(255, 255, 255))
        
    # Convert image to base64
    buffered = BytesIO()
    pil_image.save(buffered, format="JPEG")
    img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    
    # Query via Chat Completion API (which handles vision models)
    try:
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{img_b64}"
                        }
                    }
                ]
            }
        ]
        
        response = client.chat.completions.create(
            model=config.GEN_MODEL_LLAVA,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"HuggingFace API Chat Completion error: {e}. Trying raw text-generation fallback...")
        # Fallback to direct prompt endpoint
        try:
            # Format LLaVA prompt
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
            # Pass image + text list to Gemini
            response = model.generate_content([prompt, pil_image])
        else:
            response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"Error calling Gemini API: {str(e)}"


def _generate_via_local_moondream(prompt: str, pil_image: Optional[Image.Image], max_tokens: int) -> str:
    """Loads and runs tiny Moondream2 model locally on CPU."""
    global _local_gen_model, _local_gen_tokenizer
    
    from transformers import AutoModelForCausalLM, AutoTokenizer, AutoConfig
    
    # Load model if not cached
    if _local_gen_model is None:
        print(f"Loading local Moondream2 model onto {config.DEVICE}...")
        
        # Load tokenizer first to get the correct EOS token ID
        _local_gen_tokenizer = AutoTokenizer.from_pretrained(config.GEN_MODEL_MOONDREAM, revision="2024-08-26")
        
        # Load configuration and patch the missing pad_token_id
        moondream_config = AutoConfig.from_pretrained(
            config.GEN_MODEL_MOONDREAM, 
            revision="2024-08-26", 
            trust_remote_code=True
        )
        
        # 1. Patch outer config
        moondream_config.pad_token_id = _local_gen_tokenizer.eos_token_id
        if hasattr(moondream_config, "rope_scaling") and isinstance(moondream_config.rope_scaling, dict):
            if "type" not in moondream_config.rope_scaling:
                moondream_config.rope_scaling["type"] = moondream_config.rope_scaling.get("rope_type", "linear")
        
        # 2. Patch nested text/phi configs
        for sub_config_name in ["phi_config", "text_config"]:
            if hasattr(moondream_config, sub_config_name):
                sub_config = getattr(moondream_config, sub_config_name)
                
                # pad_token_id fix
                if isinstance(sub_config, dict):
                    sub_config["pad_token_id"] = _local_gen_tokenizer.eos_token_id
                    r_scale = sub_config.get("rope_scaling")
                    if isinstance(r_scale, dict) and "type" not in r_scale:
                        r_scale["type"] = r_scale.get("rope_type", "linear")
                else:
                    sub_config.pad_token_id = _local_gen_tokenizer.eos_token_id
                    if hasattr(sub_config, "rope_scaling") and isinstance(sub_config.rope_scaling, dict):
                        if "type" not in sub_config.rope_scaling:
                            sub_config.rope_scaling["type"] = sub_config.rope_scaling.get("rope_type", "linear")
                    
        # 3. Just in case, inject it into kwargs to override during initialization
        moondream_config.update({"pad_token_id": _local_gen_tokenizer.eos_token_id})
            
        _local_gen_model = AutoModelForCausalLM.from_pretrained(
            config.GEN_MODEL_MOONDREAM,
            revision="2024-08-26",
            trust_remote_code=True,
            config=moondream_config,
            torch_dtype=torch.float32 if config.DEVICE == "cpu" else torch.float16
        ).to(config.DEVICE)
            
        print("Moondream2 loaded successfully.")

    if pil_image is None:
        # Create small placeholder image for Moondream
        pil_image = Image.new("RGB", (250, 250), color=(255, 255, 255))
        
    try:
        with torch.no_grad():
            # moondream2 has a built-in helper function answer_question
            # format the prompt to make it clear
            answer = _local_gen_model.answer_question(
                pil_image, 
                prompt, 
                _local_gen_tokenizer
            )
            return answer.strip()
    except Exception as e:
        return f"Error executing local Moondream2: {str(e)}"


def _generate_via_local_llava(prompt: str, pil_image: Optional[Image.Image], max_tokens: int) -> str:
    """Loads and runs LLaVA-1.5-7B locally (original notebook logic - GPU only)."""
    global _local_gen_model, _local_gen_processor
    
    from transformers import LlavaForConditionalGeneration, AutoProcessor, BitsAndBytesConfig
    
    if _local_gen_model is None:
        print(f"Loading local LLaVA-1.5-7B onto {config.DEVICE}...")
        
        # Load quantization if CUDA is available, else float32 on CPU
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
            # Warning: this will load ~14GB weights on CPU!
            print("WARNING: Loading LLaVA-1.5-7B on CPU. This will consume 14GB+ RAM and run extremely slowly.")
            _local_gen_model = LlavaForConditionalGeneration.from_pretrained(
                config.GEN_MODEL_LLAVA,
                torch_dtype=torch.float32,
            ).to(config.DEVICE)
            
        _local_gen_processor = AutoProcessor.from_pretrained(config.GEN_MODEL_LLAVA)
        _local_gen_model.eval()
        print("LLaVA-1.5-7B loaded successfully.")
        
    if pil_image is None:
        pil_image = Image.new("RGB", (336, 336), color=(255, 255, 255))
        
    img_input = pil_image.convert("RGB")
    llava_prompt = f"USER: <image>\n{prompt}\nASSISTANT:"
    
    try:
        inputs = _local_gen_processor(
            images=img_input,
            text=llava_prompt,
            return_tensors="pt"
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
                do_sample=False
            )
            
        new_tokens = output_ids[0][input_length:]
        answer = _local_gen_processor.decode(new_tokens, skip_special_tokens=True).strip()
        return answer
    except Exception as e:
        return f"Error executing local LLaVA: {str(e)}"


def build_medical_prompt_with_history(query_text: str, retrieved: List[Dict[str, Any]], history: List[Dict[str, str]]) -> str:
    """Builds a clinical prompt containing retrieved context, conversation history, and the new query."""
    context_lines = []
    # Take top 3 to prevent LLaVA prompt length issues
    for i, r in enumerate(retrieved[:3], 1):
        organ = r.get("img_organ", "N/A")
        ctype = r.get("content_type", "N/A")
        kbase = r.get("kbase", "")

        line = (
            f"[{i}] Related question : {r['question']}\n"
            f"     Known answer     : {r['answer']}\n"
            f"     Organ            : {organ} | Category: {ctype}\n"
        )
        if kbase:
            line += f"     Medical facts    : {kbase[:200]}\n"

        context_lines.append(line)

    context_str = "\n".join(context_lines)

    # Format last 6 message turns for context window size safety
    history_str = ""
    if history:
        history_lines = []
        for turn in history[-6:]:
            role_label = "User" if turn.get("role") == "user" else "Assistant"
            text_val = turn.get("text", turn.get("content", ""))
            history_lines.append(f"{role_label}: {text_val}")
        history_str = "\n".join(history_lines)

    prompt = (
        "You are a medical AI assistant trained in radiology.\n"
        "Use the retrieved context below to answer the user's new question.\n"
        "Be concise and direct. If it is a yes/no question, answer Yes or No first.\n\n"
        "══ RETRIEVED CONTEXT ══\n"
        f"{context_str}\n\n"
    )

    if history_str:
        prompt += (
            "══ CONVERSATION HISTORY ══\n"
            f"{history_str}\n\n"
        )

    prompt += (
        "══ NEW QUESTION ══\n"
        f"{query_text}\n\n"
        "══ ANSWER ══\n"
    )
    return prompt


# ── Full RAG Pipeline Call ──────────────────────────────────────────────────

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
    Retrieves context and generates answer using the configured engine.
    Returns: (answer, retrieved_contexts, engine_used)
    """
    if engine is None:
        engine = config.GENERATIVE_ENGINE
        
    t0 = time.time()
    
    # 1. Retrieve related context
    retrieved = retrieve(query_text, query_image, top_k=top_k, alpha=alpha)
    
    # 2. Build clinical prompt (using history if available)
    if history:
        prompt = build_medical_prompt_with_history(query_text, retrieved, history)
    else:
        prompt = build_medical_prompt(query_text, retrieved)
    
    # 3. Generate response using selected engine
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
        
    duration = time.time() - t0
    print(f"VQA generated in {duration:.2f}s using {engine}.")
    
    return answer, retrieved, engine
