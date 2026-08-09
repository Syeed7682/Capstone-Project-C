import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { WelcomeView } from './components/WelcomeView';
import { ChatMessages } from './components/ChatMessages';
import { ChatInput } from './components/ChatInput';
import { RagInspector } from './components/RagInspector';
import { SettingsModal } from './components/SettingsModal';
import { ProfileModal } from './components/ProfileModal';
import { ToastNotification, ToastProps } from './components/Toast';
import { LandingPage } from './components/LandingPage';
import { ReportModal } from './components/ReportModal';
import { AppConfig, IndexStatus, Session, ChatMessage, RetrievedContext, User } from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('mvqa_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [sessionId, setSessionId] = useState<string>(() => {
    return localStorage.getItem('clinicarag_active_session') || 'demo-session-01';
  });

  const [sessions, setSessions] = useState<{ session_id: string; title: string; timestamp: number }[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);

  const [config, setConfig] = useState<AppConfig>({
    active_engine: 'gemini_api',
    top_k: 5,
    alpha: 0.65,
    max_new_tokens: 256,
    device: 'CUDA 12.1',
    has_gemini_key: false,
    has_hf_token: false,
  });

  const [indexStatus, setIndexStatus] = useState<IndexStatus>({
    status: 'ready',
    progress: 100,
    message: 'Pinecone Cloud: Connected',
    vector_count: 4918,
    index_name: 'slake-index',
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRebuilding, setIsRebuilding] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isReportsOpen, setIsReportsOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Omit<ToastProps, 'onClose'>[]>([]);

  const [leftSidebarOpen, setLeftSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('mvqa_left_sidebar_open');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  });

  const [rightSidebarOpen, setRightSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('mvqa_right_sidebar_open');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  });

  const toggleLeftSidebar = () => {
    setLeftSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('mvqa_left_sidebar_open', JSON.stringify(next));
      return next;
    });
  };

  const toggleRightSidebar = () => {
    setRightSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('mvqa_right_sidebar_open', JSON.stringify(next));
      return next;
    });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const addToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Initial Data Fetch
  useEffect(() => {
    fetchConfig();
    fetchSessions();
    pollIndexStatus();
  }, []);

  // Sync active session history when sessionId changes
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('clinicarag_active_session', sessionId);
      fetchSessionHistory(sessionId);
    }
  }, [sessionId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSessionHistory = async (id: string) => {
    try {
      const res = await fetch(`/api/session/${id}`);
      if (res.ok) {
        const data: Session = await res.json();
        setMessages(data.history || []);
      } else {
        setMessages([]);
      }
    } catch (e) {
      setMessages([]);
    }
  };

  const pollIndexStatus = async () => {
    try {
      const res = await fetch('/api/index-status');
      if (res.ok) {
        const data: IndexStatus = await res.json();
        setIndexStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectImage = (file: File) => {
    setSelectedImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
  };

  const handleNewChat = () => {
    const newId = 'session-' + Date.now();
    setSessionId(newId);
    setMessages([]);
    handleClearImage();
    setInputText('');
    fetchSessions();
    addToast('Started new consultation', 'info');
  };

  const handleDeleteSession = async (idToDelete: string) => {
    try {
      await fetch('/api/session/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: idToDelete }),
      });
      addToast('Session deleted', 'success');
      fetchSessions();
      if (idToDelete === sessionId) {
        handleNewChat();
      }
    } catch (e) {
      addToast('Failed to delete session', 'error');
    }
  };

  const handleSaveConfig = async (updated: Partial<AppConfig>) => {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: updated.active_engine ?? config.active_engine,
          top_k: updated.top_k ?? config.top_k,
          alpha: updated.alpha ?? config.alpha,
          max_new_tokens: updated.max_new_tokens ?? config.max_new_tokens,
          hf_token: updated.hf_token,
          gemini_api_key: updated.gemini_api_key,
        }),
      });

      if (res.ok) {
        addToast('Configuration applied successfully', 'success');
        fetchConfig();
      } else {
        addToast('Failed to save configuration', 'error');
      }
    } catch (e) {
      addToast('Network error saving configuration', 'error');
    }
  };

  const handleRebuildIndex = async () => {
    setIsRebuilding(true);
    try {
      const res = await fetch('/api/rebuild-index', { method: 'POST' });
      if (res.ok) {
        addToast('Index rebuild initiated...', 'info');
        const interval = setInterval(async () => {
          const statusRes = await fetch('/api/index-status');
          if (statusRes.ok) {
            const data: IndexStatus = await statusRes.json();
            setIndexStatus(data);
            if (data.status === 'ready') {
              clearInterval(interval);
              setIsRebuilding(false);
              addToast('Index rebuild complete', 'success');
            }
          }
        }, 800);
      }
    } catch (e) {
      setIsRebuilding(false);
      addToast('Failed to rebuild index', 'error');
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() && !selectedImageFile) return;

    const userQuery = inputText.trim();
    const imageToUpload = selectedImageFile;

    setInputText('');
    handleClearImage();
    setIsLoading(true);

    const tempUserMsg: ChatMessage = {
      id: 'temp-' + Date.now(),
      role: 'user',
      text: userQuery || '(Uploaded Scan)',
      imageUrl: selectedImagePreview || undefined,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const formData = new FormData();
      formData.append('query_text', userQuery);
      formData.append('session_id', sessionId);
      formData.append('engine', config.active_engine);
      formData.append('top_k', config.top_k.toString());
      formData.append('alpha', config.alpha.toString());
      formData.append('max_new_tokens', config.max_new_tokens.toString());

      if (imageToUpload) {
        formData.append('query_image', imageToUpload);
      }

      const res = await fetch('/api/query', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        // Append the real assistant response, replacing the temp user message
        const assistantMsg: ChatMessage = {
          id: 'assistant-' + Date.now(),
          role: 'assistant',
          text: data.answer || '(No response)',
          engine: data.engine,
          retrieved: data.retrieved || [],
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        fetchSessions();
        fetchConfig();
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast(errData.detail || 'Query execution failed', 'error');
        // Remove temp user message on error
        setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
      }
    } catch (e) {
      addToast('Network error processing clinical query', 'error');
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
    } finally {
      setIsLoading(false);
    }
  };

  // Find most recent retrieved contexts for RagInspector
  const latestRetrievedItems: RetrievedContext[] =
    [...messages]
      .reverse()
      .find((m) => m.retrieved && m.retrieved.length > 0)?.retrieved || [];

  const handleLogout = () => {
    localStorage.removeItem('mvqa_session');
    setCurrentUser(null);
    addToast('Signed out successfully', 'info');
  };

  const handleUpdateProfile = async (updated: { name: string; email: string; password?: string; avatarColor?: string; profileImage?: string | null }) => {
    if (!currentUser) return;
    const oldEmail = currentUser.email;

    // Split the single name into firstName/lastName
    const nameParts = updated.name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ');

    try {
      const res = await fetch('/api/auth/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentEmail: oldEmail,
          name: updated.name,
          newEmail: updated.email,
          password: updated.password || null,
          avatarColor: updated.avatarColor || null,
          profileImage: updated.profileImage !== undefined ? updated.profileImage : null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newUser: User = data.user;
        setCurrentUser(newUser);
        localStorage.setItem('mvqa_session', JSON.stringify(newUser));
        addToast('Profile updated successfully', 'success');
        return;
      } else if (res.status === 400) {
        const errData = await res.json().catch(() => ({}));
        if (errData.detail) {
          throw new Error(errData.detail);
        }
      }
      // Any other status (405, 500, etc.) — fall through to localStorage
    } catch (e: any) {
      // Re-throw only real validation errors (status 400 from the backend)
      if (e.message && !e.message.includes('Failed to fetch') && !e.message.includes('Method Not Allowed') && !e.message.includes('NetworkError')) {
        throw e;
      }
      console.warn('Backend update fallback to localStorage', e);
    }

    // LocalStorage fallback
    const newUser: User = {
      firstName,
      lastName,
      email: updated.email,
      avatarColor: updated.avatarColor,
      profileImage: updated.profileImage || undefined,
    };

    // Update mvqa_users store
    try {
      const users = JSON.parse(localStorage.getItem('mvqa_users') || '{}');
      if (oldEmail !== updated.email && users[updated.email]) {
        throw new Error('The new email is already registered by another user.');
      }
      const oldUserData = users[oldEmail] || {};
      delete users[oldEmail];
      users[updated.email] = {
        ...oldUserData,
        ...newUser,
        password: updated.password || oldUserData.password,
      };
      localStorage.setItem('mvqa_users', JSON.stringify(users));
    } catch (e: any) {
      if (e.message?.includes('already registered')) throw e;
    }

    setCurrentUser(newUser);
    localStorage.setItem('mvqa_session', JSON.stringify(newUser));
    addToast('Profile updated successfully', 'success');
  };

  if (!currentUser) {
    return (
      <>
        <LandingPage onAuthSuccess={(user) => {
          setCurrentUser(user);
          addToast(`Welcome back, ${user.firstName}!`, 'success');
        }} />
        {/* Toasts on landing page */}
        {toasts.map((toast) => (
          <ToastNotification
            key={toast.id}
            id={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={removeToast}
          />
        ))}
      </>
    );
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden select-none">
      {/* Header */}
      <Header
        indexStatus={indexStatus}
        onRebuildIndex={handleRebuildIndex}
        isRebuilding={isRebuilding}
        deviceInfo={config.device}
        onOpenReports={() => setIsReportsOpen(true)}
        leftSidebarOpen={leftSidebarOpen}
        onToggleLeftSidebar={toggleLeftSidebar}
        rightSidebarOpen={rightSidebarOpen}
        onToggleRightSidebar={toggleRightSidebar}
      />

      {/* Drawer Backdrops for Mobile */}
      {leftSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-950/60 backdrop-blur-sm md:hidden"
          onClick={toggleLeftSidebar}
        />
      )}
      {rightSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={toggleRightSidebar}
        />
      )}

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <Sidebar
          isOpen={leftSidebarOpen}
          onToggle={toggleLeftSidebar}
          sessions={sessions}
          activeSessionId={sessionId}
          onSelectSession={setSessionId}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          onOpenSettings={() => setIsSettingsOpen(true)}
          activeEngine={config.active_engine}
          onSelectEngine={(eng) => handleSaveConfig({ active_engine: eng })}
          alpha={config.alpha}
          onAlphaChange={(a) => handleSaveConfig({ alpha: a })}
          topK={config.top_k}
          onTopKChange={(k) => handleSaveConfig({ top_k: k })}
          hasGeminiKey={config.has_gemini_key}
          hasHfToken={config.has_hf_token}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenProfile={() => setIsProfileOpen(true)}
        />

        {/* Main Chat Feed */}
        <main className="flex-1 flex flex-col bg-slate-900/10 min-w-0 h-full">
          {messages.length === 0 ? (
            <WelcomeView onSelectQuery={(q) => setInputText(q)} />
          ) : (
            <ChatMessages
              messages={messages}
              isLoading={isLoading}
              messagesEndRef={messagesEndRef}
            />
          )}

          <ChatInput
            inputText={inputText}
            setInputText={setInputText}
            selectedImageFile={selectedImageFile}
            selectedImagePreview={selectedImagePreview}
            onSelectImage={handleSelectImage}
            onClearImage={handleClearImage}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
          />
        </main>

        {/* Right RAG Context Inspector */}
        <RagInspector
          isOpen={rightSidebarOpen}
          onToggle={toggleRightSidebar}
          retrievedItems={latestRetrievedItems}
          vectorCount={indexStatus.vector_count}
        />
      </div>

      {/* Bottom Status Bar Footer */}
      <footer className="h-8 bg-slate-950 border-t border-slate-800 flex items-center justify-between px-6 shrink-0 font-mono text-[9px] text-slate-600 uppercase tracking-widest z-20">
        <div className="flex gap-4">
          <span>API: v2.4.1</span>
          <span>Storage: SLAKE (imgs.zip) EXTRACTED</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 italic">
            System is grounded via Retrieval-Augmented Generation
          </span>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
      />

      {/* Profile Settings Modal */}
      {currentUser && (
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          user={currentUser}
          onSave={handleUpdateProfile}
        />
      )}

      {/* Clinical Reports Modal */}
      <ReportModal
        isOpen={isReportsOpen}
        onClose={() => setIsReportsOpen(false)}
        activeSessionId={sessionId}
        userEmail={currentUser?.email}
        onAddToast={addToast}
      />

      {/* Toasts */}
      {toasts.map((toast) => (
        <ToastNotification
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={removeToast}
        />
      ))}
    </div>
  );
}

