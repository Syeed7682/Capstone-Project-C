// ═══════════════════════════════════════════════════════════════
//  ClinicaRAG — Frontend Application Logic
// ═══════════════════════════════════════════════════════════════

// ── Global State ────────────────────────────────────────────────
let selectedImageFile = null;
let currentConfig = {};
let pollingInterval = null;
let sessionId = crypto.randomUUID();

// ── DOM Refs ─────────────────────────────────────────────────────
const engineSelect       = document.getElementById('engine-select');
const hfTokenGroup       = document.getElementById('hf-token-group');
const hfTokenInput       = document.getElementById('hf-token-input');
const geminiKeyGroup     = document.getElementById('gemini-key-group');
const geminiKeyInput     = document.getElementById('gemini-key-input');

const topKSlider         = document.getElementById('top-k-slider');
const topKVal            = document.getElementById('top-k-val');
const alphaSlider        = document.getElementById('alpha-slider');
const alphaVal           = document.getElementById('alpha-val');
const tokensSlider       = document.getElementById('tokens-slider');
const tokensVal          = document.getElementById('tokens-val');
const saveConfigBtn      = document.getElementById('save-config-btn');
const deviceInfo         = document.getElementById('device-info');
const encoderInfo        = document.getElementById('encoder-info');

const imageFileInput     = document.getElementById('image-file-input');
const attachImgBtn       = document.getElementById('attach-img-btn');
const attachmentBar      = document.getElementById('attachment-bar');
const attachmentImg      = document.getElementById('attachment-img');
const attachmentFilename = document.getElementById('attachment-filename');
const clearAttachmentBtn = document.getElementById('clear-attachment-btn');

const chatInputText      = document.getElementById('chat-input-text');
const sendChatBtn        = document.getElementById('send-chat-btn');
const welcomeView        = document.getElementById('welcome-view');
const chatMessages       = document.getElementById('chat-messages');

const indexStatusCard          = document.getElementById('index-status-card');
const statusText               = document.getElementById('status-text');
const statusProgressContainer  = document.getElementById('status-progress-container');
const statusProgressBar        = document.getElementById('status-progress-bar');
const statusPercentage         = document.getElementById('status-percentage');
const rebuildIndexBtn          = document.getElementById('rebuild-index-btn');
const newChatBtn               = document.getElementById('new-chat-btn');

// New sidebar & modal elements
const settingsModal      = document.getElementById('settings-modal');
const openSettingsBtn    = document.getElementById('open-settings-btn');
const closeSettingsBtn   = document.getElementById('close-settings-btn');
const historyList        = document.getElementById('history-list');
const newChatSidebarBtn  = document.getElementById('new-chat-sidebar-btn');

// ── Boot ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    fetchConfig();
    startIndexStatusPolling();
    initAttachmentHandlers();
    initPresetHandlers();
    initPasswordToggles();
    initEngineCards();

    // Slider listeners
    topKSlider.addEventListener('input', () => topKVal.textContent = topKSlider.value);
    alphaSlider.addEventListener('input', () => alphaVal.textContent = parseFloat(alphaSlider.value).toFixed(2));
    tokensSlider.addEventListener('input', () => tokensVal.textContent = tokensSlider.value);

    saveConfigBtn.addEventListener('click', applyConfig);
    rebuildIndexBtn.addEventListener('click', rebuildIndex);
    if (newChatBtn) newChatBtn.addEventListener('click', startNewChat);

    // Modal
    openSettingsBtn.addEventListener('click', openModal);
    closeSettingsBtn.addEventListener('click', closeModal);
    settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    // Sidebar new chat
    newChatSidebarBtn.addEventListener('click', startNewChat);

    // Chat send
    sendChatBtn.addEventListener('click', sendMessage);
    chatInputText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    chatInputText.addEventListener('input', () => {
        chatInputText.style.height = 'auto';
        chatInputText.style.height = `${chatInputText.scrollHeight}px`;
    });

    // Load history sidebar
    fetchSessionsList();
});

// ── Modal Helpers ────────────────────────────────────────────────
function openModal() {
    settingsModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}
function closeModal() {
    settingsModal.classList.add('hidden');
    document.body.style.overflow = '';
}

// ── Engine Card Radio Sync ────────────────────────────────────────
function initEngineCards() {
    const radios = document.querySelectorAll('.engine-option input[type="radio"]');
    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            // sync hidden select
            engineSelect.value = radio.value;
            handleEngineChange();
        });
    });
}

function syncEngineCards(engine) {
    document.querySelectorAll('.engine-option input[type="radio"]').forEach(r => {
        r.checked = (r.value === engine);
    });
    engineSelect.value = engine;
}

// ── Password Toggles ─────────────────────────────────────────────
function initPasswordToggles() {
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            btn.innerHTML = isPassword
                ? '<i class="fa-solid fa-eye-slash"></i>'
                : '<i class="fa-solid fa-eye"></i>';
        });
    });
}

// ── Config ───────────────────────────────────────────────────────
async function fetchConfig() {
    try {
        const r = await fetch('/api/config');
        const data = await r.json();
        currentConfig = data;

        syncEngineCards(data.active_engine);
        topKSlider.value   = data.top_k;       topKVal.textContent   = data.top_k;
        alphaSlider.value  = data.alpha;        alphaVal.textContent  = data.alpha.toFixed(2);
        tokensSlider.value = data.max_new_tokens; tokensVal.textContent = data.max_new_tokens;

        if (deviceInfo)  deviceInfo.textContent  = data.device.toUpperCase();
        if (encoderInfo) encoderInfo.textContent = 'BiomedCLIP';

        handleEngineChange();
        if (data.has_hf_token)    hfTokenInput.placeholder   = '●●●●●● Saved';
        if (data.has_gemini_key)  geminiKeyInput.placeholder  = '●●●●●● Saved';
    } catch (e) { console.error('Config fetch error:', e); }
}

function handleEngineChange() {
    const engine = engineSelect.value;
    hfTokenGroup.classList.toggle('hidden', engine !== 'huggingface_api');
    geminiKeyGroup.classList.toggle('hidden', engine !== 'gemini_api');
}

async function applyConfig() {
    const payload = {
        engine:         engineSelect.value,
        top_k:          parseInt(topKSlider.value),
        alpha:          parseFloat(alphaSlider.value),
        max_new_tokens: parseInt(tokensSlider.value),
    };
    if (hfTokenInput.value.trim())    payload.hf_token       = hfTokenInput.value.trim();
    if (geminiKeyInput.value.trim())  payload.gemini_api_key = geminiKeyInput.value.trim();

    try {
        const r = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Failed to update'); }

        showToast('✓ Configuration applied!', 'success');
        hfTokenInput.value = '';
        geminiKeyInput.value = '';
        fetchConfig();
        closeModal();
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

// ── Index Status Polling ──────────────────────────────────────────
function startIndexStatusPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollIndexStatus();
    pollingInterval = setInterval(pollIndexStatus, 2000);
}

async function pollIndexStatus() {
    try {
        const r = await fetch('/api/index-status');
        const data = await r.json();
        indexStatusCard.className = `index-status-bar status-${data.status}`;

        if (data.status === 'ready') {
            statusText.textContent = 'RAG Index: Ready';
            statusProgressContainer.classList.add('hidden');
            statusPercentage.classList.add('hidden');
            clearInterval(pollingInterval);
        } else if (data.status === 'failed') {
            statusText.textContent = 'Index Build Failed';
            statusProgressContainer.classList.add('hidden');
            statusPercentage.classList.add('hidden');
            clearInterval(pollingInterval);
        } else {
            statusText.textContent = data.message || 'Building…';
            statusProgressContainer.classList.remove('hidden');
            statusPercentage.classList.remove('hidden');
            statusProgressBar.style.width   = `${data.progress}%`;
            statusPercentage.textContent    = `${Math.round(data.progress)}%`;
        }
    } catch (e) { console.error('Index status error:', e); }
}

async function rebuildIndex() {
    if (!confirm('Force rebuild the SLAKE FAISS index? This may take several minutes.')) return;
    try {
        const r = await fetch('/api/rebuild-index', { method: 'POST' });
        if (r.ok) { startIndexStatusPolling(); showToast('Index rebuild started…', 'info'); }
        else { const e = await r.json(); showToast('Error: ' + e.detail, 'error'); }
    } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

// ── Attachment ────────────────────────────────────────────────────
function initAttachmentHandlers() {
    attachImgBtn.addEventListener('click', () => imageFileInput.click());
    imageFileInput.addEventListener('change', () => {
        if (imageFileInput.files.length > 0) handleAttachment(imageFileInput.files[0]);
    });
    clearAttachmentBtn.addEventListener('click', clearAttachment);
}

function handleAttachment(file) {
    if (!file.type.startsWith('image/')) { showToast('Please select a valid image file.', 'error'); return; }
    selectedImageFile = file;
    attachmentFilename.textContent = file.name;
    attachImgBtn.classList.add('attached');
    const reader = new FileReader();
    reader.onload = (e) => { attachmentImg.src = e.target.result; attachmentBar.classList.remove('hidden'); };
    reader.readAsDataURL(file);
}

function clearAttachment() {
    selectedImageFile = null;
    imageFileInput.value = '';
    attachmentImg.src = '';
    attachmentBar.classList.add('hidden');
    attachImgBtn.classList.remove('attached');
}

// ── Presets ───────────────────────────────────────────────────────
function initPresetHandlers() {
    const tabs     = document.querySelectorAll('.preset-tab-btn');
    const contents = document.querySelectorAll('.preset-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.getAttribute('data-tab')}`).classList.add('active');
        });
    });
    document.querySelectorAll('.preset-query-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            chatInputText.value = btn.getAttribute('data-q');
            sendMessage();
        });
    });
}

// ── Session History ───────────────────────────────────────────────
async function fetchSessionsList() {
    try {
        const r = await fetch('/api/sessions');
        if (!r.ok) return;
        const data = await r.json();

        historyList.innerHTML = '';

        if (data.sessions.length === 0) {
            historyList.innerHTML = `
                <div class="history-empty-state">
                    <i class="fa-regular fa-comment-dots"></i>
                    No past sessions yet.<br>Start a conversation!
                </div>`;
            return;
        }

        data.sessions.forEach(session => {
            const date = new Date(session.timestamp * 1000);
            const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                          + ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

            const item = document.createElement('button');
            item.className = 'history-item' + (session.session_id === sessionId ? ' active' : '');
            item.innerHTML = `
                <div class="history-item-title">${escapeHtml(session.title)}</div>
                <div class="history-item-date">${dateStr}</div>
            `;
            item.addEventListener('click', () => loadSession(session.session_id));
            historyList.appendChild(item);
        });
    } catch (e) { console.error('Sessions fetch error:', e); }
}

async function loadSession(targetId) {
    if (targetId === sessionId) return;
    try {
        const r = await fetch(`/api/session/${targetId}`);
        if (!r.ok) throw new Error('Session not found');
        const data = await r.json();

        sessionId = data.session_id;

        // Reset chat UI
        chatMessages.innerHTML = '';
        clearAttachment();
        chatInputText.value = '';

        welcomeView.classList.add('hidden');
        chatMessages.classList.remove('hidden');

        // Rebuild messages
        data.history.forEach(msg => {
            const div = document.createElement('div');
            div.className = `message message-${msg.role}`;

            const avatarIcon = msg.role === 'user' ? 'fa-user' : 'fa-stethoscope';
            div.innerHTML = `
                <div class="avatar"><i class="fa-solid ${avatarIcon}"></i></div>
                <div class="message-bubble">
                    <div class="text-content">${escapeHtml(msg.text)}</div>
                </div>`;
            chatMessages.appendChild(div);
        });

        scrollToBottom();
        fetchSessionsList();
    } catch (e) { showToast(e.message, 'error'); }
}

// ── Chat Send ────────────────────────────────────────────────────
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
    const text  = chatInputText.value.trim();
    const image = selectedImageFile;
    if (!text) return;

    chatInputText.value = '';
    chatInputText.style.height = 'auto';
    clearAttachment();

    welcomeView.classList.add('hidden');
    chatMessages.classList.remove('hidden');

    // Render user message
    const userDiv = document.createElement('div');
    userDiv.className = 'message message-user';
    let imgHtml = '';
    if (image) {
        const url = await fileToDataUrl(image);
        imgHtml = `<img src="${url}" class="user-msg-image" alt="uploaded scan">`;
    }
    userDiv.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-user"></i></div>
        <div class="message-bubble">
            ${imgHtml}
            <div class="text-content">${escapeHtml(text)}</div>
        </div>`;
    chatMessages.appendChild(userDiv);
    scrollToBottom();

    // Typing indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message message-assistant';
    loadingDiv.id = 'typing-indicator-bubble';
    loadingDiv.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-stethoscope"></i></div>
        <div class="message-bubble">
            <div class="typing-indicator">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        </div>`;
    chatMessages.appendChild(loadingDiv);
    scrollToBottom();

    // API request
    const formData = new FormData();
    formData.append('query_text', text);
    if (image) formData.append('query_image', image);
    formData.append('session_id', sessionId);
    formData.append('engine', engineSelect.value);
    formData.append('top_k', topKSlider.value);
    formData.append('alpha', alphaSlider.value);
    formData.append('max_new_tokens', tokensSlider.value);

    try {
        const r = await fetch('/api/query', { method: 'POST', body: formData });
        loadingDiv.remove();
        if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Server error'); }
        const data = await r.json();
        renderAssistantMessage(data);
        fetchSessionsList();
    } catch (e) {
        loadingDiv.remove();
        renderErrorMessage(e.message);
    }
}

function renderAssistantMessage(data) {
    const div = document.createElement('div');
    div.className = 'message message-assistant';

    let ragHtml = '';
    if (data.retrieved && data.retrieved.length > 0) {
        let cards = '';
        data.retrieved.forEach(item => {
            const pct = Math.max(0, Math.min(100, Math.round(item.score * 100)));
            cards += `
                <div class="retrieved-card-mini">
                    <div class="card-meta-mini">
                        <span>${item.img_organ || 'N/A'} · ${item.content_type || 'N/A'}</span>
                        <span class="match">${pct}% match</span>
                    </div>
                    <div class="card-question-mini"><strong>Q:</strong> ${escapeHtml(item.question)}</div>
                    <div class="card-answer-mini"><strong>A:</strong> ${escapeHtml(item.answer)}</div>
                    ${item.kbase ? `<div class="card-facts-mini"><strong>Facts:</strong> ${escapeHtml(item.kbase)}</div>` : ''}
                </div>`;
        });
        ragHtml = `
            <div class="rag-accordion">
                <details>
                    <summary class="rag-summary">
                        <i class="fa-solid fa-chevron-right"></i>
                        View SLAKE Grounding Context (${data.retrieved.length} samples)
                    </summary>
                    <div class="rag-details-content">${cards}</div>
                </details>
            </div>`;
    }

    div.innerHTML = `
        <div class="avatar"><i class="fa-solid fa-stethoscope"></i></div>
        <div class="message-bubble">
            <div class="engine-badge"><i class="fa-solid fa-microchip"></i>${data.engine}</div>
            <div class="text-content">${escapeHtml(data.answer)}</div>
            ${ragHtml}
        </div>`;
    chatMessages.appendChild(div);
    scrollToBottom();
}

function renderErrorMessage(msg) {
    const div = document.createElement('div');
    div.className = 'message message-assistant';
    div.innerHTML = `
        <div class="avatar" style="border-color: rgba(244,63,94,0.4); color: #f43f5e;">
            <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <div class="message-bubble" style="border-color: rgba(244,63,94,0.3); background: rgba(244,63,94,0.05);">
            <div class="text-content" style="color: #fda4af;">
                <strong>Error:</strong> ${escapeHtml(msg)}
            </div>
        </div>`;
    chatMessages.appendChild(div);
    scrollToBottom();
}

// ── New Chat ─────────────────────────────────────────────────────
async function startNewChat() {
    try {
        const fd = new FormData();
        fd.append('session_id', sessionId);
        await fetch('/api/session/clear', { method: 'POST', body: fd });
    } catch (e) { console.error('Session clear error:', e); }

    sessionId = crypto.randomUUID();
    chatMessages.innerHTML = '';
    chatMessages.classList.add('hidden');
    welcomeView.classList.remove('hidden');

    clearAttachment();
    chatInputText.value = '';
    fetchSessionsList();
}

// ── Toast Notification ────────────────────────────────────────────
function showToast(message, type = 'info') {
    const existing = document.getElementById('clinica-toast');
    if (existing) existing.remove();

    const colors = {
        success: 'rgba(15,212,184,0.15)',
        error:   'rgba(244,63,94,0.15)',
        info:    'rgba(0,220,255,0.12)'
    };
    const borders = {
        success: 'rgba(15,212,184,0.4)',
        error:   'rgba(244,63,94,0.4)',
        info:    'rgba(0,220,255,0.3)'
    };

    const toast = document.createElement('div');
    toast.id = 'clinica-toast';
    toast.style.cssText = `
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        background: ${colors[type]}; border: 1px solid ${borders[type]};
        backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
        color: #f0f6ff; padding: 12px 24px; border-radius: 30px;
        font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 600;
        z-index: 99999; animation: toast-in 0.35s cubic-bezier(0.18, 0.89, 0.32, 1.28);
        box-shadow: 0 8px 30px rgba(0,0,0,0.5);
    `;
    toast.textContent = message;

    const style = document.createElement('style');
    style.textContent = `@keyframes toast-in { from { opacity:0; transform:translateX(-50%) translateY(10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`;
    document.head.appendChild(style);

    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.4s'; setTimeout(() => toast.remove(), 400); }, 3000);
}

// ── Utilities ─────────────────────────────────────────────────────
function fileToDataUrl(file) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
    });
}

function escapeHtml(text) {
    const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}
