// ═══════════════════════════════════════════════════════════════
//  ClinicaRAG — Vanilla JS Logic mapped to Tailwind UI
// ═══════════════════════════════════════════════════════════════

let sessionId = localStorage.getItem('clinicarag_active_session') || crypto.randomUUID();
let currentConfig = {};
let pollingInterval = null;
let selectedImageFile = null;

// DOM Refs
const historyList = document.getElementById('history-list');
const newChatSidebarBtn = document.getElementById('new-chat-sidebar-btn');
const openSettingsBtn = document.getElementById('open-settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const settingsBackdrop = document.getElementById('settings-backdrop');

const engineSelect = document.getElementById('engine-select');
const engineRadios = document.querySelectorAll('input[name="engine"]');
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

const chatInputText = document.getElementById('chat-input-text');
const sendChatBtn = document.getElementById('send-chat-btn');
const imageFileInput = document.getElementById('image-file-input');
const attachImgBtn = document.getElementById('attach-img-btn');
const attachmentBar = document.getElementById('attachment-bar');
const attachmentImg = document.getElementById('attachment-img');
const attachmentFilename = document.getElementById('attachment-filename');
const clearAttachmentBtn = document.getElementById('clear-attachment-btn');

const welcomeView = document.getElementById('welcome-view');
const chatMessages = document.getElementById('chat-messages');

const indexStatusCard = document.getElementById('index-status-card');
const statusText = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');
const statusProgressContainer = document.getElementById('status-progress-container');
const statusProgressBar = document.getElementById('status-progress-bar');
const statusPercentage = document.getElementById('status-percentage');
const rebuildIndexBtn = document.getElementById('rebuild-index-btn');
const rebuildIcon = document.getElementById('rebuild-icon');

// Preset Tabs
const presetTabBtns = document.querySelectorAll('.preset-tab-btn');
const presetQueryBtns = document.querySelectorAll('.preset-query-btn');

document.addEventListener('DOMContentLoaded', () => {
    fetchConfig();
    fetchSessionsList();
    loadSessionDetails(sessionId);
    startIndexStatusPolling();

    // Modal
    openSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    settingsBackdrop.addEventListener('click', () => settingsModal.classList.add('hidden'));

    // Engine cards sync
    engineRadios.forEach(r => {
        r.addEventListener('change', () => {
            engineSelect.value = r.value;
            handleEngineChange();
        });
    });

    // Sliders
    topKSlider.addEventListener('input', () => topKVal.textContent = topKSlider.value);
    alphaSlider.addEventListener('input', () => alphaVal.textContent = parseFloat(alphaSlider.value).toFixed(2));
    tokensSlider.addEventListener('input', () => tokensVal.textContent = tokensSlider.value);
    saveConfigBtn.addEventListener('click', applyConfig);

    // Sidebar & Chat
    newChatSidebarBtn.addEventListener('click', startNewChat);
    sendChatBtn.addEventListener('click', sendMessage);
    
    // Auto-resize textarea
    chatInputText.addEventListener('input', () => {
        chatInputText.style.height = 'auto';
        chatInputText.style.height = (chatInputText.scrollHeight) + 'px';
    });
    chatInputText.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    // Attachment
    attachImgBtn.addEventListener('click', () => imageFileInput.click());
    imageFileInput.addEventListener('change', handleAttachment);
    clearAttachmentBtn.addEventListener('click', clearAttachment);

    // Preset Tabs
    presetTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            presetTabBtns.forEach(b => {
                b.className = "preset-tab-btn text-slate-500 hover:text-slate-300 border border-transparent flex items-center gap-2 py-1.5 px-4 rounded-lg font-display font-bold text-xs transition-all cursor-pointer";
            });
            btn.className = "preset-tab-btn bg-cyan-500/10 text-cyan-400 shadow-md border border-cyan-500/15 flex items-center gap-2 py-1.5 px-4 rounded-lg font-display font-bold text-xs transition-all cursor-pointer";
            
            document.querySelectorAll('.preset-grid').forEach(g => g.classList.add('hidden'));
            document.getElementById(`tab-content-${btn.getAttribute('data-tab')}`).classList.remove('hidden');
        });
    });

    presetQueryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            chatInputText.value = btn.getAttribute('data-q');
            sendMessage();
        });
    });

    rebuildIndexBtn.addEventListener('click', rebuildIndex);
});

async function fetchConfig() {
    try {
        const res = await fetch('/api/config');
        if (!res.ok) return;
        const data = await res.json();
        currentConfig = data;

        engineSelect.value = data.active_engine;
        engineRadios.forEach(r => r.checked = (r.value === data.active_engine));
        handleEngineChange();

        topKSlider.value = data.top_k; topKVal.textContent = data.top_k;
        alphaSlider.value = data.alpha; alphaVal.textContent = data.alpha.toFixed(2);
        tokensSlider.value = data.max_new_tokens; tokensVal.textContent = data.max_new_tokens;

        if(data.has_hf_token) hfTokenInput.placeholder = "●●●●●● Saved";
        if(data.has_gemini_key) geminiKeyInput.placeholder = "●●●●●● Saved";
        
        deviceInfo.textContent = data.device.toUpperCase();

    } catch (err) { console.error(err); }
}

function handleEngineChange() {
    const val = engineSelect.value;
    if(val === 'huggingface_api') {
        hfTokenGroup.classList.remove('hidden');
        geminiKeyGroup.classList.add('hidden');
    } else if (val === 'gemini_api') {
        geminiKeyGroup.classList.remove('hidden');
        hfTokenGroup.classList.add('hidden');
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
        max_new_tokens: parseInt(tokensSlider.value),
    };
    if (hfTokenInput.value.trim()) payload.hf_token = hfTokenInput.value.trim();
    if (geminiKeyInput.value.trim()) payload.gemini_api_key = geminiKeyInput.value.trim();

    saveConfigBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Applying...';
    lucide.createIcons();

    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            triggerToast("Configuration applied successfully!", "success");
            fetchConfig();
            settingsModal.classList.add('hidden');
        } else {
            const err = await res.json();
            triggerToast(err.detail || "Failed to save", "error");
        }
    } catch(e) { triggerToast("Network error", "error"); }
    
    saveConfigBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Apply Configuration';
    lucide.createIcons();
}

async function fetchSessionsList() {
    try {
        const res = await fetch('/api/sessions');
        if (!res.ok) return;
        const data = await res.json();
        
        historyList.innerHTML = '';
        if (data.sessions.length === 0) {
            historyList.innerHTML = `
                <div class="text-center py-8 px-2 text-slate-600">
                    <i data-lucide="message-square" class="w-8 h-8 mx-auto mb-2 opacity-20"></i>
                    <p class="text-[11px] leading-relaxed">No past diagnostics.<br>Start a consultation!</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        data.sessions.forEach(session => {
            const isActive = session.session_id === sessionId;
            const d = new Date(session.timestamp * 1000);
            const dateStr = d.toLocaleDateString(undefined, {month:'short', day:'numeric'}) + ' ' + d.toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit', hour12:false});
            
            const btn = document.createElement('div');
            btn.className = `group relative w-full p-2.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                isActive ? 'bg-gradient-to-r from-cyan-950/20 to-slate-900/10 border-cyan-500/30 text-slate-200' : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-900/30 hover:text-slate-200'
            }`;
            
            let activeLine = isActive ? '<div class="absolute top-2.5 bottom-2.5 left-0 w-0.5 bg-cyan-400 rounded-r"></div>' : '';
            let iconColor = isActive ? 'text-cyan-400' : 'text-slate-500';
            
            btn.innerHTML = `
                ${activeLine}
                <i data-lucide="message-square" class="w-3.5 h-3.5 mt-0.5 shrink-0 ${iconColor}"></i>
                <div class="flex-1 min-w-0 pr-6">
                    <h4 class="text-xs font-semibold truncate leading-tight">${escapeHtml(session.title)}</h4>
                    <span class="text-[9px] text-slate-500 mt-1 block font-mono">${dateStr}</span>
                </div>
                <button class="delete-session-btn absolute right-2 top-2.5 p-1 rounded-md text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            `;
            
            btn.addEventListener('click', () => loadSessionDetails(session.session_id));
            
            const delBtn = btn.querySelector('.delete-session-btn');
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if(!confirm("Permanently delete this session?")) return;
                try {
                    await fetch('/api/session/clear', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({session_id: session.session_id})
                    });
                    triggerToast("Session deleted", "success");
                    fetchSessionsList();
                    if (session.session_id === sessionId) startNewChat();
                } catch(err){}
            });

            historyList.appendChild(btn);
        });
        lucide.createIcons();
    } catch (err) {}
}

async function loadSessionDetails(id) {
    sessionId = id;
    localStorage.setItem('clinicarag_active_session', sessionId);
    fetchSessionsList();
    
    try {
        const res = await fetch(`/api/session/${id}`);
        if(res.ok) {
            const data = await res.json();
            chatMessages.innerHTML = '';
            
            if(data.history && data.history.length > 0) {
                welcomeView.classList.add('hidden');
                chatMessages.classList.remove('hidden');
                
                data.history.forEach(msg => {
                    if (msg.role === 'user') appendUserMessage(msg.text, msg.imageUrl, false);
                    else appendAssistantMessage(msg.text, msg.engine, msg.retrieved, false);
                });
                scrollToBottom();
            } else {
                welcomeView.classList.remove('hidden');
                chatMessages.classList.add('hidden');
            }
        } else {
            welcomeView.classList.remove('hidden');
            chatMessages.classList.add('hidden');
        }
    } catch (err) {
        welcomeView.classList.remove('hidden');
        chatMessages.classList.add('hidden');
    }
}

function startNewChat() {
    sessionId = crypto.randomUUID();
    localStorage.setItem('clinicarag_active_session', sessionId);
    chatMessages.innerHTML = '';
    welcomeView.classList.remove('hidden');
    chatMessages.classList.add('hidden');
    clearAttachment();
    chatInputText.value = '';
    fetchSessionsList();
    triggerToast("Started new consultation", "info");
}

function handleAttachment(e) {
    const file = e.target.files[0];
    if(!file) return;
    selectedImageFile = file;
    attachmentFilename.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (ev) => {
        attachmentImg.src = ev.target.result;
        attachmentBar.classList.remove('hidden');
        attachmentBar.classList.add('flex');
    };
    reader.readAsDataURL(file);
}

function clearAttachment() {
    selectedImageFile = null;
    imageFileInput.value = '';
    attachmentBar.classList.add('hidden');
    attachmentBar.classList.remove('flex');
}

async function sendMessage() {
    const text = chatInputText.value.trim();
    if(!text && !selectedImageFile) return;

    let imgDataUrl = attachmentImg.src && attachmentImg.src.startsWith('data:') ? attachmentImg.src : null;
    const fileToUpload = selectedImageFile;

    chatInputText.value = '';
    chatInputText.style.height = 'auto';
    clearAttachment();

    welcomeView.classList.add('hidden');
    chatMessages.classList.remove('hidden');

    appendUserMessage(text, imgDataUrl, true);
    
    // Add loading typing indicator
    const loadingId = 'typing-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.className = "flex gap-3 max-w-[85%] items-start animate-fade-in";
    loadingDiv.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-slate-900/50 border border-slate-800 flex items-center justify-center text-slate-500 shrink-0">
            <i data-lucide="stethoscope" class="w-4 h-4"></i>
        </div>
        <div class="p-3 rounded-2xl rounded-tl-sm bg-slate-900/30 border border-slate-800 text-slate-100 flex gap-1">
            <div class="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-typing-1"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-typing-2"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-typing-3"></div>
        </div>
    `;
    chatMessages.appendChild(loadingDiv);
    lucide.createIcons();
    scrollToBottom();

    // Send to API
    const fd = new FormData();
    fd.append('query_text', text);
    if(fileToUpload) fd.append('query_image', fileToUpload);
    fd.append('session_id', sessionId);
    fd.append('engine', engineSelect.value);
    fd.append('top_k', topKSlider.value);
    fd.append('alpha', alphaSlider.value);
    fd.append('max_new_tokens', tokensSlider.value);

    try {
        const res = await fetch('/api/query', { method: 'POST', body: fd });
        document.getElementById(loadingId).remove();
        if(!res.ok) {
            const err = await res.json();
            appendAssistantMessage(`⚠️ **[Clinical Retrieval Failure]**\n\n${err.detail || "Error computing RAG matrix."}`, "Error", null, true);
        } else {
            const data = await res.json();
            appendAssistantMessage(data.answer, data.engine, data.retrieved, true);
            fetchSessionsList(); // update title
        }
    } catch(e) {
        document.getElementById(loadingId).remove();
        appendAssistantMessage("⚠️ Network error occurred", "Error", null, true);
    }
}

function appendUserMessage(text, imgUrl, scroll) {
    const div = document.createElement('div');
    div.className = "flex gap-3 max-w-[85%] self-end items-start flex-row-reverse animate-fade-in";
    let imgHtml = imgUrl ? `<img src="${imgUrl}" class="max-w-[200px] rounded-lg border border-cyan-500/20 mb-2 shadow-lg">` : '';
    div.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <i data-lucide="user" class="w-4 h-4"></i>
        </div>
        <div class="p-3 rounded-2xl rounded-tr-sm bg-gradient-to-br from-cyan-950/80 to-blue-900/50 border border-cyan-500/20 text-slate-100 shadow-md">
            ${imgHtml}
            <p class="text-[13px] leading-relaxed whitespace-pre-wrap">${escapeHtml(text)}</p>
        </div>
    `;
    chatMessages.appendChild(div);
    lucide.createIcons();
    if(scroll) scrollToBottom();
}

function appendAssistantMessage(text, engine, retrieved, scroll) {
    const div = document.createElement('div');
    div.className = "flex gap-3 max-w-[85%] items-start animate-fade-in";
    
    let ragHtml = '';
    if(retrieved && retrieved.length > 0) {
        let cards = '';
        retrieved.forEach(item => {
            const pct = Math.max(0, Math.min(100, Math.round(item.score * 100)));
            cards += `
                <div class="bg-slate-950/50 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-1.5 bg-emerald-500/10 rounded-bl-lg border-b border-l border-emerald-500/20">
                        <span class="text-[9px] font-black text-emerald-400">${pct}% MATCH</span>
                    </div>
                    <div class="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">${item.img_organ || 'N/A'} · ${item.content_type || 'N/A'}</div>
                    <div class="text-[11px] text-slate-300"><strong>Q:</strong> ${escapeHtml(item.question)}</div>
                    <div class="text-[11px] text-slate-100 border-l-2 border-cyan-500 pl-2"><strong>A:</strong> ${escapeHtml(item.answer)}</div>
                </div>
            `;
        });
        ragHtml = `
            <details class="group mt-3 border-t border-slate-800/80 pt-2">
                <summary class="flex items-center gap-2 cursor-pointer list-none text-[10px] font-bold text-cyan-500 hover:text-cyan-400 uppercase tracking-wider">
                    <i data-lucide="chevron-right" class="w-3.5 h-3.5 transition-transform group-open:rotate-90"></i>
                    View SLAKE Grounding Context (${retrieved.length} samples)
                </summary>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 animate-fade-in">${cards}</div>
            </details>
        `;
    }

    div.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-slate-900/80 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
            <i data-lucide="stethoscope" class="w-4 h-4"></i>
        </div>
        <div class="p-3.5 rounded-2xl rounded-tl-sm bg-slate-900/30 border border-slate-800/80 text-slate-200 shadow-sm flex-1 min-w-0">
            <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                <i data-lucide="cpu" class="w-3 h-3 text-cyan-500"></i> ${engine || 'system'}
            </div>
            <div class="text-[13px] leading-relaxed whitespace-pre-wrap">${escapeHtml(text)}</div>
            ${ragHtml}
        </div>
    `;
    chatMessages.appendChild(div);
    lucide.createIcons();
    if(scroll) scrollToBottom();
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Index polling
function startIndexStatusPolling() {
    if(pollingInterval) clearInterval(pollingInterval);
    pollIndexStatus();
    pollingInterval = setInterval(pollIndexStatus, 3000);
}

async function pollIndexStatus() {
    try {
        const res = await fetch('/api/index-status');
        if(res.ok) {
            const data = await res.json();
            
            if(data.status === 'ready') {
                indexStatusCard.className = "p-1.5 px-3 rounded-full border bg-slate-950/80 flex items-center gap-2.5 text-[10px] font-bold leading-none border-emerald-500/20 text-emerald-400";
                statusDot.className = "w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping";
                statusText.textContent = "RAG Index: Ready";
                statusProgressContainer.classList.add('hidden');
                rebuildIcon.classList.remove('animate-spin', 'text-cyan-400');
            } else if (data.status === 'failed') {
                indexStatusCard.className = "p-1.5 px-3 rounded-full border bg-slate-950/80 flex items-center gap-2.5 text-[10px] font-bold leading-none border-rose-500/20 text-rose-400";
                statusDot.className = "w-1.5 h-1.5 rounded-full bg-rose-400";
                statusText.textContent = "Index Build Failed";
                statusProgressContainer.classList.add('hidden');
                rebuildIcon.classList.remove('animate-spin', 'text-cyan-400');
            } else {
                indexStatusCard.className = "p-1.5 px-3 rounded-full border bg-slate-950/80 flex items-center gap-2.5 text-[10px] font-bold leading-none border-cyan-500/20 text-cyan-400";
                statusDot.className = "w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse";
                statusText.textContent = data.message || "Building...";
                statusProgressContainer.classList.remove('hidden');
                statusProgressBar.style.width = data.progress + '%';
                statusPercentage.textContent = data.progress + '%';
                rebuildIcon.classList.add('animate-spin', 'text-cyan-400');
            }
        }
    } catch(e){}
}

async function rebuildIndex() {
    if(!confirm("Rebuild FAISS index? This requires recalculating matching embeddings.")) return;
    try {
        const res = await fetch('/api/rebuild-index', { method:'POST' });
        if(res.ok) {
            triggerToast("Index rebuild started...", "info");
            startIndexStatusPolling();
        } else {
            triggerToast("Failed to initiate rebuild", "error");
        }
    } catch(e) {}
}

function triggerToast(message, type) {
    const existing = document.getElementById('clinica-toast');
    if(existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'clinica-toast';
    let styles = "";
    if(type === 'success') styles = "bg-emerald-950/80 border-emerald-500/20 text-emerald-400";
    else if(type === 'error') styles = "bg-rose-950/80 border-rose-500/20 text-rose-400";
    else styles = "bg-cyan-950/80 border-cyan-500/20 text-cyan-400";

    toast.className = `fixed bottom-24 right-6 z-50 p-4 rounded-xl border backdrop-blur-md shadow-2xl flex items-start gap-3 max-w-sm transition-all duration-300 transform translate-x-full ${styles}`;
    
    toast.innerHTML = `
        <i data-lucide="${type==='success'?'check-circle':type==='error'?'alert-circle':'info'}" class="w-5 h-5 shrink-0 mt-0.5"></i>
        <div>
            <h4 class="text-xs font-bold capitalize leading-none mb-1">${type}</h4>
            <p class="text-[11px] leading-relaxed text-slate-200">${message}</p>
        </div>
    `;
    document.body.appendChild(toast);
    lucide.createIcons();

    // Slide in
    setTimeout(() => { toast.classList.remove('translate-x-full'); }, 50);
    // Slide out
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function escapeHtml(str) {
    const tagsToReplace = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
    return String(str).replace(/[&<>]/g, function (tag) {
        return tagsToReplace[tag] || tag;
    });
}
