import React from 'react';
import { Plus, Sliders, MessageSquare, Trash2, CheckCircle2, Cpu } from 'lucide-react';

interface SidebarSession {
  session_id: string;
  title: string;
  timestamp: number;
}

interface SidebarProps {
  sessions: SidebarSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onOpenSettings: () => void;
  activeEngine: string;
  onSelectEngine: (engine: string) => void;
  alpha: number;
  onAlphaChange: (alpha: number) => void;
  topK: number;
  onTopKChange: (topK: number) => void;
  hasGeminiKey: boolean;
  hasHfToken: boolean;
  currentUser: { firstName: string; lastName: string; email: string } | null;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onOpenSettings,
  activeEngine,
  onSelectEngine,
  alpha,
  onAlphaChange,
  topK,
  onTopKChange,
  hasGeminiKey,
  hasHfToken,
  currentUser,
  onLogout,
}) => {
  return (
    <aside className="w-72 border-r border-slate-800 bg-slate-900/30 flex flex-col h-full shrink-0 z-30 font-sans">
      <div className="p-4 flex-1 space-y-5 overflow-y-auto scrollbar-thin min-h-0">
        {/* New Consultation CTA */}
        <button
          onClick={onNewChat}
          className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-xs text-cyan-100 bg-cyan-500/10 border border-cyan-500/50 hover:bg-cyan-500/20 transition-all shadow-md shadow-cyan-500/10 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-cyan-400" />
          <span>New Consultation</span>
        </button>

        {/* Inference Engine Selection */}
        <div>
          <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2.5 block font-mono">
            Inference Engine
          </label>
          <div className="space-y-1.5">
            <button
              onClick={() => onSelectEngine('gemini_api')}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-medium transition-all cursor-pointer ${
                activeEngine === 'gemini_api'
                  ? 'bg-cyan-500/10 border border-cyan-500/50 text-cyan-100 shadow-sm'
                  : 'bg-slate-800/40 border border-slate-700/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              <div className="flex flex-col">
                <span className="font-semibold text-slate-200">Gemini 3.6 Flash</span>
                <span className="text-[9px] text-slate-500 font-mono">Cloud Vision API</span>
              </div>
              {activeEngine === 'gemini_api' && (
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              )}
            </button>

            <button
              onClick={() => onSelectEngine('huggingface_api')}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-medium transition-all cursor-pointer ${
                activeEngine === 'huggingface_api'
                  ? 'bg-cyan-500/10 border border-cyan-500/50 text-cyan-100 shadow-sm'
                  : 'bg-slate-800/40 border border-slate-700/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              <div className="flex flex-col">
                <span className="font-semibold text-slate-200">HuggingFace Qwen2.5</span>
                <span className="text-[9px] text-slate-500 font-mono">72B Vision LLM</span>
              </div>
              {activeEngine === 'huggingface_api' && (
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              )}
            </button>

            <button
              onClick={() => onSelectEngine('local_moondream')}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-medium transition-all cursor-pointer ${
                activeEngine === 'local_moondream'
                  ? 'bg-cyan-500/10 border border-cyan-500/50 text-cyan-100 shadow-sm'
                  : 'bg-slate-800/40 border border-slate-700/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              <div className="flex flex-col">
                <span className="font-semibold text-slate-200">Local Moondream (v2)</span>
                <span className="text-[9px] text-slate-500 font-mono">Fast CPU Inference</span>
              </div>
              {activeEngine === 'local_moondream' && (
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              )}
            </button>
          </div>
        </div>

        {/* Hyperparameters */}
        <div className="space-y-3.5 pt-3.5 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block font-mono">
              Hyperparameters
            </label>
            <button
              onClick={onOpenSettings}
              className="p-1 rounded text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
              title="Advanced Settings"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-400">α (Fusion Alpha)</span>
              <span className="text-cyan-400 font-mono font-bold">{alpha.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={alpha}
              onChange={(e) => onAlphaChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-400">Top-K Contexts</span>
              <span className="text-cyan-400 font-mono font-bold">{topK}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={topK}
              onChange={(e) => onTopKChange(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-cyan-500"
            />
          </div>
        </div>

        {/* Environment Status */}
        <div className="pt-3.5 border-t border-slate-800">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-2.5 font-mono">
            Environment
          </label>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono space-y-1">
            <p className={hasGeminiKey ? 'text-emerald-500' : 'text-slate-500'}>
              GEMINI_API_KEY: {hasGeminiKey ? '•••••••• (SET)' : '(UNSET)'}
            </p>
            <p className={hasHfToken ? 'text-emerald-500' : 'text-slate-500'}>
              HF_TOKEN: {hasHfToken ? '•••••••• (SET)' : '(UNSET)'}
            </p>
          </div>
        </div>

        {/* Recent Cases / Sessions */}
        <div className="pt-3.5 border-t border-slate-800 space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block font-mono">
            Recent Cases ({sessions.length})
          </label>
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {sessions.length === 0 ? (
              <p className="text-[11px] text-slate-600 py-2 italic text-center">No cases logged</p>
            ) : (
              sessions.map((s) => {
                const isActive = s.session_id === activeSessionId;
                return (
                  <div
                    key={s.session_id}
                    onClick={() => onSelectSession(s.session_id)}
                    className={`group relative p-2 rounded-lg border text-left flex items-center gap-2 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-slate-800/80 border-slate-700 text-slate-100 shadow-sm'
                        : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-800/30 hover:text-slate-200'
                    }`}
                  >
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-medium truncate flex-1 min-w-0">{s.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(s.session_id);
                      }}
                      className="p-1 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* User profile section */}
      {currentUser && (
        <div className="p-3.5 border-t border-slate-800/85 flex items-center justify-between gap-3 bg-slate-900/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-sky-500 flex items-center justify-center font-bold text-xs text-slate-950 uppercase shrink-0">
              {(currentUser.firstName[0] || '') + (currentUser.lastName[0] || '')}
            </div>
            <div className="min-w-0 flex flex-col">
              <span className="text-xs font-semibold text-slate-200 truncate leading-tight">
                {currentUser.firstName} {currentUser.lastName}
              </span>
              <span className="text-[10px] text-slate-500 truncate font-mono mt-0.5">
                {currentUser.email}
              </span>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800/40 transition-all cursor-pointer shrink-0"
            title="Sign Out"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </div>
      )}

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-slate-800 text-[10px] text-slate-600 font-mono shrink-0 flex items-center justify-between">
        <span>SLAKE Dataset v1.0</span>
        <span className="text-slate-500">Build 8A2F9</span>
      </div>
    </aside>
  );
};

