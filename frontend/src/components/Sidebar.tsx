import React, { useState } from 'react';
import { Plus, Sliders, MessageSquare, Trash2, CheckCircle2, Cpu, ChevronDown, PanelLeftClose, PanelLeftOpen, Sparkles, Box, Eye, LogOut } from 'lucide-react';
import { User } from '../types';
import { AVATAR_GRADIENTS } from './ProfileModal';

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
  currentUser: User | null;
  onLogout: () => void;
  onOpenProfile: () => void;
  isOpen?: boolean;
  onToggle?: () => void;
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
  onOpenProfile,
  isOpen = true,
  onToggle,
}) => {
  const [showHyper, setShowHyper] = useState(false);

  return (
    <aside className={`h-full flex flex-col shrink-0 font-sans z-30 transition-all duration-300 ease-in-out border-cyan-500/10 shadow-[inset_0_0_30px_rgba(6,182,212,0.03)] backdrop-blur-xl
      ${isOpen
        ? 'w-[380px] bg-white/[0.02] border-r'
        : 'w-[68px] bg-white/[0.01] border-r'
      }
      md:relative md:translate-x-0
      fixed top-0 bottom-0 left-0
      ${isOpen ? 'translate-x-0 bg-slate-950/95 z-50' : '-translate-x-full md:translate-x-0 z-30'}
      w-[320px] md:w-auto
    `}>
      {/* Sidebar Header / Toggle Row */}
      <div className={`p-4 border-b border-slate-800/50 flex items-center ${isOpen ? 'justify-between' : 'justify-center'} shrink-0`}>
        {isOpen && (
          <span className="text-[10px] font-bold font-mono tracking-widest text-slate-500 uppercase">
            MedVQA Config
          </span>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg border border-cyan-500/20 bg-cyan-950/40 text-cyan-400 hover:bg-cyan-500/30 hover:text-cyan-300 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500"
          aria-label={isOpen ? "Collapse configuration sidebar" : "Expand configuration sidebar"}
          title={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {isOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>
      </div>

      {isOpen ? (
        /* Expanded View */
        <div className="p-4 flex-1 space-y-5 overflow-y-auto scrollbar-thin min-h-0 animate-fade-in">
          {/* New Consultation CTA */}
          <button
            onClick={onNewChat}
            className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-xs text-cyan-100 bg-cyan-500/10 border border-cyan-500/50 hover:bg-cyan-500/20 transition-all shadow-md shadow-cyan-500/10 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            <span>New Consultation</span>
          </button>

          {/* Inference Engine Selection — Glassmorphism Card */}
          <div className="p-3.5 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-cyan-500/15 shadow-[0_0_20px_rgba(6,182,212,0.06)]">
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2.5 block font-mono">
              Inference Engine
            </label>
            <div className="space-y-1.5">
              <button
                onClick={() => onSelectEngine('gemini_api')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-medium transition-all cursor-pointer ${
                  activeEngine === 'gemini_api'
                    ? 'bg-cyan-500/10 border border-cyan-500/50 text-cyan-100 shadow-sm shadow-cyan-500/10'
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
                    ? 'bg-cyan-500/10 border border-cyan-500/50 text-cyan-100 shadow-sm shadow-cyan-500/10'
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
                    ? 'bg-cyan-500/10 border border-cyan-500/50 text-cyan-100 shadow-sm shadow-cyan-500/10'
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

              <button
                onClick={() => onSelectEngine('local_llava')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-medium transition-all cursor-pointer ${
                  activeEngine === 'local_llava'
                    ? 'bg-cyan-500/10 border border-cyan-500/50 text-cyan-100 shadow-sm shadow-cyan-500/10'
                    : 'bg-slate-800/40 border border-slate-700/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-200">Local LLaVA</span>
                  <span className="text-[9px] text-slate-500 font-mono">llava-1.5-7b · Vision LLM</span>
                </div>
                {activeEngine === 'local_llava' && (
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                )}
              </button>
            </div>
          </div>

          {/* Hyperparameters — Collapsible */}
          <div className="pt-3.5 border-t border-slate-800/50">
            <button
              onClick={() => setShowHyper(!showHyper)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-medium cursor-pointer bg-white/[0.04] backdrop-blur-xl border border-cyan-500/15 hover:border-cyan-500/30 transition-all shadow-[0_0_15px_rgba(6,182,212,0.04)]"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-mono">
                  Hyperparameters
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  onClick={(e) => { e.stopPropagation(); onOpenSettings(); }}
                  className="p-1 rounded text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                  title="Advanced Settings"
                >
                  <Sliders className="w-3 h-3" />
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${showHyper ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {showHyper && (
              <div className="mt-2 space-y-3.5 p-3 rounded-xl bg-white/[0.03] backdrop-blur-lg border border-cyan-500/10 animate-fade-in">
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
            )}
          </div>

          {/* Environment Status */}
          <div className="pt-3.5 border-t border-slate-800/50">
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
          <div className="pt-3.5 border-t border-slate-800/50 space-y-2">
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
      ) : (
        /* Collapsed View */
        <div className="flex-1 py-5 flex flex-col items-center gap-6 overflow-y-auto scrollbar-none min-h-0 animate-fade-in">
          {/* New Chat Icon Button */}
          <button
            onClick={onNewChat}
            className="p-3 rounded-xl flex items-center justify-center text-cyan-400 bg-cyan-500/10 border border-cyan-500/50 hover:bg-cyan-500/25 transition-all shadow-md shadow-cyan-500/10 cursor-pointer"
            title="New Consultation"
            aria-label="New Consultation"
          >
            <Plus className="w-4.5 h-4.5" />
          </button>

          {/* Engine Stack */}
          <div className="flex flex-col items-center gap-2.5 p-2 rounded-2xl bg-white/[0.04] border border-cyan-500/15 shadow-[0_0_15px_rgba(6,182,212,0.05)]">
            <button
              onClick={() => onSelectEngine('gemini_api')}
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                activeEngine === 'gemini_api'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Gemini 3.6 Flash"
              aria-label="Select Gemini Engine"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSelectEngine('huggingface_api')}
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                activeEngine === 'huggingface_api'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="HuggingFace Qwen2.5"
              aria-label="Select HuggingFace Engine"
            >
              <Box className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSelectEngine('local_moondream')}
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                activeEngine === 'local_moondream'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Local Moondream (v2)"
              aria-label="Select Moondream Engine"
            >
              <Cpu className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSelectEngine('local_llava')}
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                activeEngine === 'local_llava'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Local LLaVA"
              aria-label="Select LLaVA Engine"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          {/* Hyperparameters Config */}
          <button
            onClick={onOpenSettings}
            className="p-2.5 rounded-xl border border-slate-800 hover:border-cyan-500 bg-slate-900/40 text-slate-400 hover:text-cyan-400 transition-all cursor-pointer"
            title="Hyperparameters & Settings"
            aria-label="Hyperparameters & Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Recent Cases Count Badge */}
          <div className="relative">
            <button
              onClick={onToggle}
              className="p-2.5 rounded-xl border border-slate-800 hover:border-cyan-500 bg-slate-900/40 text-slate-400 hover:text-cyan-400 transition-all cursor-pointer"
              title="View Recent Cases"
              aria-label="View Recent Cases"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            {sessions.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 text-[9px] font-black bg-cyan-500 text-slate-950 w-4 h-4 rounded-full flex items-center justify-center font-mono">
                {sessions.length}
              </span>
            )}
          </div>
        </div>
      )}

      {/* User profile & footer */}
      {isOpen ? (
        <>
          {currentUser && (
            <div className="p-3.5 border-t border-slate-800/85 flex items-center justify-between gap-3 bg-slate-900/10 shrink-0">
              <div
                onClick={onOpenProfile}
                className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-80 hover:bg-slate-800/20 p-1.5 -ml-1.5 rounded-xl transition-all flex-1"
                title="Edit Profile Settings"
              >
                {currentUser.profileImage ? (
                  <img src={currentUser.profileImage} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 shadow-sm border border-cyan-500/20" />
                ) : (
                  <div className={`w-8 h-8 rounded-lg ${AVATAR_GRADIENTS[currentUser.avatarColor || 'teal-sky'] || AVATAR_GRADIENTS['teal-sky']} flex items-center justify-center font-bold text-xs text-slate-950 uppercase shrink-0 shadow-sm`}>
                    {(currentUser.firstName[0] || '') + (currentUser.lastName[0] || '')}
                  </div>
                )}
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
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="p-4 border-t border-slate-800 text-[10px] text-slate-600 font-mono shrink-0 flex items-center justify-between">
            <span>SLAKE Dataset v1.0</span>
            <span className="text-slate-500">Build 8A2F9</span>
          </div>
        </>
      ) : (
        currentUser && (
          <div className="p-3 border-t border-slate-800/50 flex flex-col items-center gap-3 shrink-0">
            {currentUser.profileImage ? (
              <img
                src={currentUser.profileImage}
                alt=""
                onClick={onOpenProfile}
                className="w-8 h-8 rounded-lg object-cover shrink-0 cursor-pointer hover:scale-105 hover:shadow-lg transition-all shadow-sm border border-cyan-500/20"
                title={`${currentUser.firstName} ${currentUser.lastName} - Click to edit`}
              />
            ) : (
              <div
                onClick={onOpenProfile}
                className={`w-8 h-8 rounded-lg ${AVATAR_GRADIENTS[currentUser.avatarColor || 'teal-sky'] || AVATAR_GRADIENTS['teal-sky']} flex items-center justify-center font-bold text-xs text-slate-950 uppercase shrink-0 cursor-pointer hover:scale-105 hover:shadow-lg transition-all shadow-sm`}
                title={`${currentUser.firstName} ${currentUser.lastName} - Click to edit`}
              >
                {(currentUser.firstName[0] || '') + (currentUser.lastName[0] || '')}
              </div>
            )}
            <button
              onClick={onLogout}
              className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800/40 transition-all cursor-pointer shrink-0"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )
      )}
    </aside>
  );
};

