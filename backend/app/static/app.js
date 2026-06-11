// Global State
let selectedImageFile = null;
let currentConfig = {};
let pollingInterval = null;

// DOM Elements
const engineSelect = document.getElementById('engine-select');
const hfTokenGroup = document.getElementById('hf-token-group');
const hfTokenInput = document.getElementById('hf-token-input');
const geminiKeyGroup = document.getElementById('gemini-key-group');
const geminiKeyInput = document.getElementById('gemini-key-input');

const topKSlider = document.getElementById('top-k-slider');
const topKVal = document.getElementById('top-k-val');
const alphaSlider = document.getElementById('alpha-slider');
const alphaVal = document.getElementById('alpha-val');
const tokensSlider = document.getElementById('tokens-slider');
const tokensVal = document.getElementById('tokens-val');
const saveConfigBtn = document.getElementById('save-config-btn');

const deviceInfo = document.getElementById('device-info');
const encoderInfo = document.getElementById('encoder-info');

const imageDropZone = document.getElementById('image-drop-zone');
const imageFileInput = document.getElementById('image-file-input');
const dropZonePrompt = document.getElementById('drop-zone-prompt');
const dropZonePreview = document.getElementById('drop-zone-preview');
const previewImg = document.getElementById('preview-img');
const removeImgBtn = document.getElementById('remove-img-btn');

const questionText = document.getElementById('question-text');
const runQueryBtn = document.getElementById('run-query-btn');

const indexStatusCard = document.getElementById('index-status-card');
const statusText = document.getElementById('status-text');
const statusProgressContainer = document.getElementById('status-progress-container');
const statusProgressBar = document.getElementById('status-progress-bar');
const statusPercentage = document.getElementById('status-percentage');
const rebuildIndexBtn = document.getElementById('rebuild-index-btn');

const resultsLayout = document.getElementById('results-layout');
const outputEngine = document.getElementById('output-engine');
const generatedAnswerText = document.getElementById('generated-answer-text');
const retrievedCardsContainer = document.getElementById('retrieved-cards-container');

const loadingOverlay = document.getElementById('loading-overlay');
const loadingMessage = document.getElementById('loading-message');

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    fetchConfig();
    startIndexStatusPolling();
    initDropZone();
    initPresetTabs();
    initPasswordToggles();

    // Event Listeners
    engineSelect.addEventListener('change', handleEngineChange);
    topKSlider.addEventListener('input', () => topKVal.textContent = topKSlider.value);
    alphaSlider.addEventListener('input', () => alphaVal.textContent = parseFloat(alphaSlider.value).toFixed(2));
    tokensSlider.addEventListener('input', () => tokensVal.textContent = tokensSlider.value);
    saveConfigBtn.addEventListener('click', applyConfig);
    runQueryBtn.addEventListener('click', runInference);
    rebuildIndexBtn.addEventListener('click', rebuildIndex);
});

// ── Password Visibility Toggles ─────────────────────────────────────────────
function initPasswordToggles() {
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const input = btn.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
            } else {
                input.type = 'password';
                btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
            }
        });
    });
}

// ── Config Management ────────────────────────────────────────────────────────
async function fetchConfig() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        currentConfig = data;
        
        // Bind UI
        engineSelect.value = data.active_engine;
        topKSlider.value = data.top_k;
        topKVal.textContent = data.top_k;
        alphaSlider.value = data.alpha;
        alphaVal.textContent = data.alpha.toFixed(2);
        tokensSlider.value = data.max_new_tokens;
        tokensVal.textContent = data.max_new_tokens;
        
        deviceInfo.textContent = data.device.toUpperCase();
        
        // Setup API key field displays
        handleEngineChange();

        // Bind existing credentials indicators (do not overwrite typing)
        if (data.has_hf_token) hfTokenInput.placeholder = "Saved in config (••••••••••••)";
        if (data.has_gemini_key) geminiKeyInput.placeholder = "Saved in config (••••••••••••)";
        
    } catch (error) {
        console.error("Error fetching config:", error);
    }
}

function handleEngineChange() {
    const engine = engineSelect.value;
    
    // Show/Hide api key inputs based on engine selection
    if (engine === 'huggingface_api') {
        hfTokenGroup.classList.remove('hidden');
        geminiKeyGroup.classList.add('hidden');
    } else if (engine === 'gemini_api') {
        hfTokenGroup.classList.add('hidden');
        geminiKeyGroup.classList.remove('hidden');
    } else {
        hfTokenGroup.classList.add('hidden');
        geminiKeyGroup.classList.add('hidden');
    }
}

async function applyConfig() {
    const payload = {
        engine: engineSelect.value,
        top_k: parseInt(topKSlider.value),
        alpha: parseFloat(alphaSlider.value),
        max_new_tokens: parseInt(tokensSlider.value)
    };

    if (hfTokenInput.value.trim()) {
        payload.hf_token = hfTokenInput.value.trim();
    }
    if (geminiKeyInput.value.trim()) {
        payload.gemini_api_key = geminiKeyInput.value.trim();
    }

    try {
        showLoading("Updating backend config...");
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to update configuration");
        }

        const data = await response.json();
        hideLoading();
        
        // Alert success
        alert("Configuration applied successfully!");
        
        // Reset inputs
        hfTokenInput.value = "";
        geminiKeyInput.value = "";
        fetchConfig(); // reload
    } catch (error) {
        hideLoading();
        alert("Error: " + error.message);
    }
}

// ── Index Status Polling ───────────────────────────────────────────────────
function startIndexStatusPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    pollIndexStatus();
    pollingInterval = setInterval(pollIndexStatus, 2000);
}

async function pollIndexStatus() {
    try {
        const response = await fetch('/api/index-status');
        const data = await response.json();
        
        // Update indicator class
        indexStatusCard.className = `index-status-bar status-${data.status}`;
        
        // Update texts
        if (data.status === 'ready') {
            statusText.textContent = "FAISS RAG Index: Ready";
            statusProgressContainer.classList.add('hidden');
            statusPercentage.classList.add('hidden');
            clearInterval(pollingInterval); // Stop polling when ready
        } else if (data.status === 'failed') {
            statusText.textContent = "FAISS Index Build Failed";
            statusProgressContainer.classList.add('hidden');
            statusPercentage.classList.add('hidden');
            clearInterval(pollingInterval); // Stop polling on failure
            console.error("Index compilation error:", data.error);
        } else {
            // Downloading, Extracting, Indexing
            statusText.textContent = `${data.message}`;
            statusProgressContainer.classList.remove('hidden');
            statusPercentage.classList.remove('hidden');
            statusProgressBar.style.width = `${data.progress}%`;
            statusPercentage.textContent = `${Math.round(data.progress)}%`;
        }
    } catch (error) {
        console.error("Error polling index status:", error);
    }
}

async function rebuildIndex() {
    if (!confirm("Are you sure you want to force rebuild the SLAKE FAISS index? This will re-download files if needed and compute embeddings.")) {
        return;
    }
    
    try {
        const response = await fetch('/api/rebuild-index', { method: 'POST' });
        if (response.ok) {
            startIndexStatusPolling();
        } else {
            const err = await response.json();
            alert("Error: " + err.detail);
        }
    } catch (error) {
        alert("Error: " + error.message);
    }
}

// ── Dropzone & Upload ──────────────────────────────────────────────────────
function initDropZone() {
    const dropZone = imageDropZone;
    const fileInput = imageFileInput;
    
    // Browse button click triggers file selection
    dropZone.addEventListener('click', (e) => {
        if (e.target.closest('#remove-img-btn')) return; // ignore delete click
        fileInput.click();
    });

    // File input changes
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleSelectedImage(fileInput.files[0]);
        }
    });

    // Drag-n-drop event listeners
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleSelectedImage(files[0]);
        }
    });

    // Remove Image button
    removeImgBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedImageFile = null;
        fileInput.value = "";
        previewImg.src = "";
        dropZonePreview.classList.add('hidden');
        dropZonePrompt.classList.remove('hidden');
    });
}

function handleSelectedImage(file) {
    if (!file.type.startsWith('image/')) {
        alert("Please select a valid image file.");
        return;
    }
    
    selectedImageFile = file;
    
    // Show Preview
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        dropZonePrompt.classList.add('hidden');
        dropZonePreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

// ── Demo Presets Toggles & Queries ──────────────────────────────────────────
function initPresetTabs() {
    const tabs = document.querySelectorAll('.preset-tab-btn');
    const contents = document.querySelectorAll('.preset-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            // Add active
            tab.classList.add('active');
            const targetId = `tab-${tab.getAttribute('data-tab')}`;
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Query clicks
    document.querySelectorAll('.preset-query-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            questionText.value = btn.getAttribute('data-q');
            // Visual bounce feedback
            btn.style.transform = 'scale(0.97)';
            setTimeout(() => btn.style.transform = '', 150);
        });
    });
}

// ── Pipeline VQA Inference ──────────────────────────────────────────────────
async function runInference() {
    const textQuery = questionText.value.trim();
    
    if (!textQuery) {
        alert("Please enter a clinical question or select one of the demos.");
        return;
    }

    // Build form body
    const formData = new FormData();
    formData.append('query_text', textQuery);
    if (selectedImageFile) {
        formData.append('query_image', selectedImageFile);
    }
    
    // Explicit override parameters
    formData.append('engine', engineSelect.value);
    formData.append('top_k', topKSlider.value);
    formData.append('alpha', alphaSlider.value);
    formData.append('max_new_tokens', tokensSlider.value);

    try {
        showLoading("Retrieving relevant contexts & executing visual QA...");
        resultsLayout.classList.add('hidden');
        
        const response = await fetch('/api/query', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Server error running query");
        }

        const data = await response.json();
        hideLoading();
        renderResults(data);
    } catch (error) {
        hideLoading();
        alert("Inference Error: " + error.message);
    }
}

function renderResults(data) {
    // 1. Render Generated Answer
    outputEngine.textContent = data.engine;
    generatedAnswerText.textContent = data.answer;
    
    // 2. Render Retrieved Context Cards
    retrievedCardsContainer.innerHTML = "";
    
    if (data.retrieved && data.retrieved.length > 0) {
        data.retrieved.forEach(item => {
            const card = document.createElement('div');
            card.className = "retrieved-card";
            
            // Format score as match percentage
            const scorePct = Math.max(0, Math.min(100, Math.round(item.score * 100)));
            
            card.innerHTML = `
                <div class="card-header-meta">
                    <div class="meta-tags">
                        <span class="meta-tag">${item.img_organ || 'N/A'}</span>
                        <span class="meta-tag">${item.content_type || 'N/A'}</span>
                    </div>
                    <span class="score-badge">${scorePct}% Match</span>
                </div>
                <div class="card-qa">
                    <div class="card-question"><strong>Q:</strong> ${item.question}</div>
                    <div class="card-answer"><strong>GT Answer:</strong> ${item.answer}</div>
                </div>
                ${item.kbase ? `<div class="card-facts"><strong>Facts:</strong> ${item.kbase}</div>` : ''}
            `;
            retrievedCardsContainer.appendChild(card);
        });
    } else {
        retrievedCardsContainer.innerHTML = `<p class="help-text">No relevant Slake dataset examples retrieved.</p>`;
    }
    
    // Show results pane
    resultsLayout.classList.remove('hidden');
    
    // Smooth scroll down to results
    resultsLayout.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Loaders ────────────────────────────────────────────────────────────────
function showLoading(msg) {
    loadingMessage.textContent = msg;
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}
