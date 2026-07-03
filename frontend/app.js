// Global State
let selectedImageFile = null;
let currentConfig = {};
let pollingInterval = null;
let sessionId = crypto.randomUUID();

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

const imageFileInput = document.getElementById('image-file-input');
const attachImgBtn = document.getElementById('attach-img-btn');
const attachmentBar = document.getElementById('attachment-bar');
const attachmentImg = document.getElementById('attachment-img');
const attachmentFilename = document.getElementById('attachment-filename');
const clearAttachmentBtn = document.getElementById('clear-attachment-btn');

const chatInputText = document.getElementById('chat-input-text');
const sendChatBtn = document.getElementById('send-chat-btn');
const welcomeView = document.getElementById('welcome-view');
const chatMessages = document.getElementById('chat-messages');

const indexStatusCard = document.getElementById('index-status-card');
const statusText = document.getElementById('status-text');
const statusProgressContainer = document.getElementById('status-progress-container');
const statusProgressBar = document.getElementById('status-progress-bar');
const statusPercentage = document.getElementById('status-percentage');
const rebuildIndexBtn = document.getElementById('rebuild-index-btn');
const newChatBtn = document.getElementById('new-chat-btn');

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    fetchConfig();
    startIndexStatusPolling();
    initAttachmentHandlers();
    initPresetHandlers();
    initPasswordToggles();

    // Event Listeners
    engineSelect.addEventListener('change', handleEngineChange);
    topKSlider.addEventListener('input', () => topKVal.textContent = topKSlider.value);
    alphaSlider.addEventListener('input', () => alphaVal.textContent = parseFloat(alphaSlider.value).toFixed(2));
    tokensSlider.addEventListener('input', () => tokensVal.textContent = tokensSlider.value);
    saveConfigBtn.addEventListener('click', applyConfig);
    rebuildIndexBtn.addEventListener('click', rebuildIndex);
    newChatBtn.addEventListener('click', startNewChat);
    
    // Send message events
    sendChatBtn.addEventListener('click', sendMessage);
    chatInputText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-expand input height as user types
    chatInputText.addEventListener('input', () => {
        chatInputText.style.height = 'auto';
        chatInputText.style.height = `${chatInputText.scrollHeight}px`;
    });
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

        // Bind existing credentials indicators
        if (data.has_hf_token) hfTokenInput.placeholder = "Saved in config (••••••••••••)";
        if (data.has_gemini_key) geminiKeyInput.placeholder = "Saved in config (••••••••••••)";
        
    } catch (error) {
        console.error("Error fetching config:", error);
    }
}

function handleEngineChange() {
    const engine = engineSelect.value;
    
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
        alert("Configuration applied successfully!");
        
        hfTokenInput.value = "";
        geminiKeyInput.value = "";
        fetchConfig();
    } catch (error) {
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
        
        indexStatusCard.className = `index-status-bar status-${data.status}`;
        
        if (data.status === 'ready') {
            statusText.textContent = "FAISS RAG Index: Ready";
            statusProgressContainer.classList.add('hidden');
            statusPercentage.classList.add('hidden');
            clearInterval(pollingInterval);
        } else if (data.status === 'failed') {
            statusText.textContent = "FAISS Index Build Failed";
            statusProgressContainer.classList.add('hidden');
            statusPercentage.classList.add('hidden');
            clearInterval(pollingInterval);
            console.error("Index compilation error:", data.error);
        } else {
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

// ── Attachment Handling ─────────────────────────────────────────────────────
function initAttachmentHandlers() {
    // Attach click triggers file upload
    attachImgBtn.addEventListener('click', () => {
        imageFileInput.click();
    });

    imageFileInput.addEventListener('change', () => {
        if (imageFileInput.files.length > 0) {
            handleAttachment(imageFileInput.files[0]);
        }
    });

    // Remove Attachment
    clearAttachmentBtn.addEventListener('click', () => {
        selectedImageFile = null;
        imageFileInput.value = "";
        attachmentImg.src = "";
        attachmentBar.classList.add('hidden');
        attachImgBtn.classList.remove('attached');
    });
}

function handleAttachment(file) {
    if (!file.type.startsWith('image/')) {
        alert("Please select a valid image file.");
        return;
    }

    selectedImageFile = file;
    attachmentFilename.textContent = file.name;
    attachImgBtn.classList.add('attached');

    const reader = new FileReader();
    reader.onload = (e) => {
        attachmentImg.src = e.target.result;
        attachmentBar.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

// ── Presets tabs ────────────────────────────────────────────────────────────
function initPresetHandlers() {
    const tabs = document.querySelectorAll('.preset-tab-btn');
    const contents = document.querySelectorAll('.preset-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            const targetId = `tab-${tab.getAttribute('data-tab')}`;
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Preset clicks copy query and execute send automatically
    document.querySelectorAll('.preset-query-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            chatInputText.value = btn.getAttribute('data-q');
            sendMessage();
        });
    });
}

// ── Chat Bot Logic ──────────────────────────────────────────────────────────
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
    const text = chatInputText.value.trim();
    const image = selectedImageFile;

    if (!text) return;

    // Clear UI inputs immediately
    chatInputText.value = "";
    chatInputText.style.height = 'auto';
    
    selectedImageFile = null;
    imageFileInput.value = "";
    attachmentImg.src = "";
    attachmentBar.classList.add('hidden');
    attachImgBtn.classList.remove('attached');

    // Hide welcome, show chat
    welcomeView.classList.add('hidden');
    chatMessages.classList.remove('hidden');

    // 1. Render User Message
    const userMsgDiv = document.createElement('div');
    userMsgDiv.className = 'message message-user';
    
    let imgHtml = '';
    if (image) {
        // Create quick base64 data-url for local user rendering
        const base64Url = await fileToDataUrl(image);
        imgHtml = `<img src="${base64Url}" class="user-msg-image" alt="user uploaded image">`;
    }

    userMsgDiv.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-user"></i></div>
        <div class="message-bubble">
            ${imgHtml}
            <div class="text-content">${escapeHtml(text)}</div>
        </div>
    `;
    chatMessages.appendChild(userMsgDiv);
    scrollToBottom();

    // 2. Render Assistant Loading/Typing message
    const botLoadingDiv = document.createElement('div');
    botLoadingDiv.className = 'message message-assistant';
    botLoadingDiv.id = 'typing-indicator-bubble';
    botLoadingDiv.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-user-doctor"></i></div>
        <div class="message-bubble">
            <div class="typing-indicator">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        </div>
    `;
    chatMessages.appendChild(botLoadingDiv);
    scrollToBottom();

    // 3. Dispatch backend request
    const formData = new FormData();
    formData.append('query_text', text);
    if (image) {
        formData.append('query_image', image);
    }
    
    // Add configurations parameters overrides
    formData.append('session_id', sessionId);
    formData.append('engine', engineSelect.value);
    formData.append('top_k', topKSlider.value);
    formData.append('alpha', alphaSlider.value);
    formData.append('max_new_tokens', tokensSlider.value);

    try {
        const response = await fetch('/api/query', {
            method: 'POST',
            body: formData
        });

        // Remove loading indicator
        botLoadingDiv.remove();

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Server error running query");
        }

        const data = await response.json();
        
        // 4. Render Assistant Answer
        renderAssistantMessage(data);
    } catch (error) {
        botLoadingDiv.remove();
        renderErrorMessage(error.message);
    }
}

function renderAssistantMessage(data) {
    const assistantMsgDiv = document.createElement('div');
    assistantMsgDiv.className = 'message message-assistant';

    // RAG retrieval content compilation
    let ragContextHtml = '';
    if (data.retrieved && data.retrieved.length > 0) {
        let cardsHtml = '';
        data.retrieved.forEach(item => {
            const scorePct = Math.max(0, Math.min(100, Math.round(item.score * 100)));
            cardsHtml += `
                <div class="retrieved-card-mini">
                    <div class="card-meta-mini">
                        <span>${item.img_organ || 'N/A'} | ${item.content_type || 'N/A'}</span>
                        <span class="match">${scorePct}% Match</span>
                    </div>
                    <div class="card-question-mini"><strong>Q:</strong> ${item.question}</div>
                    <div class="card-answer-mini"><strong>GT:</strong> ${item.answer}</div>
                    ${item.kbase ? `<div class="card-facts-mini"><strong>Facts:</strong> ${item.kbase}</div>` : ''}
                </div>
            `;
        });

        ragContextHtml = `
            <div class="rag-accordion">
                <details>
                    <summary class="rag-summary">
                        <i class="fa-solid fa-chevron-right"></i> View SLAKE Grounding (RAG Context)
                    </summary>
                    <div class="rag-details-content">
                        ${cardsHtml}
                    </div>
                </details>
            </div>
        `;
    }

    assistantMsgDiv.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-user-doctor"></i></div>
        <div class="message-bubble">
            <div class="engine-badge-wrapper" style="margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                <span class="engine-badge" style="font-size: 9px; padding: 1px 6px;">${data.engine}</span>
            </div>
            <div class="text-content">${escapeHtml(data.answer)}</div>
            ${ragContextHtml}
        </div>
    `;
    
    chatMessages.appendChild(assistantMsgDiv);
    scrollToBottom();
}

function renderErrorMessage(errorMsg) {
    const errorMsgDiv = document.createElement('div');
    errorMsgDiv.className = 'message message-assistant';
    errorMsgDiv.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-user-doctor"></i></div>
        <div class="message-bubble" style="border-color: var(--accent-red); background: rgba(239, 68, 68, 0.05);">
            <div class="text-content" style="color: #fda4af;">
                <i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i>
                <strong>Inference Error:</strong> ${escapeHtml(errorMsg)}
            </div>
        </div>
    `;
    chatMessages.appendChild(errorMsgDiv);
    scrollToBottom();
}

async function startNewChat() {
    try {
        const formData = new FormData();
        formData.append('session_id', sessionId);
        await fetch('/api/session/clear', {
            method: 'POST',
            body: formData
        });
    } catch (e) {
        console.error("Error clearing session on server", e);
    }
    
    // Generate new session ID
    sessionId = crypto.randomUUID();
    
    // Clear chat UI
    chatMessages.innerHTML = '';
    
    // Reset UI view
    chatMessages.classList.add('hidden');
    welcomeView.classList.remove('hidden');
    
    // Clear inputs
    chatInputText.value = "";
    selectedImageFile = null;
    imageFileInput.value = "";
    attachmentImg.src = "";
    attachmentBar.classList.add('hidden');
    attachImgBtn.classList.remove('attached');
}

// ── Utility Helpers ─────────────────────────────────────────────────────────
function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
