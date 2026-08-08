import React, { useState } from 'react';
import { Sliders, X, Cpu, Key, Database, ArrowLeftRight, AlignLeft, Check, Sparkles, Box, Eye } from 'lucide-react';
import { AppConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSaveConfig: (updated: Partial<AppConfig>) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [engine, setEngine] = useState<AppConfig['active_engine']>(config.active_engine);
  const [topK, setTopK] = useState<number>(config.top_k);
  const [alpha, setAlpha] = useState<number>(config.alpha);
  const [maxNewTokens, setMaxNewTokens] = useState<number>(config.max_new_tokens);
  const [hfToken, setHfToken] = useState<string>('');
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleApply = async () => {
    setIsSaving(true);
    await onSaveConfig({
      active_engine: engine,
      top_k: topK,
      alpha,
      max_new_tokens: maxNewTokens,
      hf_token: hfToken || undefined,
      gemini_api_key: geminiKey || undefined,
    });
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-slate-950 border border-cyan-500/20 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden z-10 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-100 text-lg leading-tight">
                Engine Configuration
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                Adjust VQA backends and retrieval hyper-parameters
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin space-y-5">
          {/* Engine Selection */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
              <Cpu className="w-4 h-4 text-cyan-400" /> Generative LLM Engine
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <label
                onClick={() => setEngine('gemini_api')}
                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                  engine === 'gemini_api'
                    ? 'border-cyan-500 bg-cyan-950/20 shadow-md'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                <Sparkles className={`w-5 h-5 ${engine === 'gemini_api' ? 'text-cyan-400' : 'text-slate-500'}`} />
                <div>
                  <strong className="block text-xs font-bold text-slate-200">Gemini Pro</strong>
                  <span className="text-[9px] text-slate-500 font-mono">3.6 Flash Vision</span>
                </div>
              </label>

              <label
                onClick={() => setEngine('huggingface_api')}
                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                  engine === 'huggingface_api'
                    ? 'border-cyan-500 bg-cyan-950/20 shadow-md'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                <Box className={`w-5 h-5 ${engine === 'huggingface_api' ? 'text-cyan-400' : 'text-slate-500'}`} />
                <div>
                  <strong className="block text-xs font-bold text-slate-200">HF Serverless</strong>
                  <span className="text-[9px] text-slate-500 font-mono">Qwen2.5-VL-72B</span>
                </div>
              </label>

              <label
                onClick={() => setEngine('local_moondream')}
                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                  engine === 'local_moondream'
                    ? 'border-cyan-500 bg-cyan-950/20 shadow-md'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                <Cpu className={`w-5 h-5 ${engine === 'local_moondream' ? 'text-cyan-400' : 'text-slate-500'}`} />
                <div>
                  <strong className="block text-xs font-bold text-slate-200">Local Moondream</strong>
                  <span className="text-[9px] text-slate-500 font-mono">vikhyatk/moondream2</span>
                </div>
              </label>

              <label
                onClick={() => setEngine('local_llava')}
                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                  engine === 'local_llava'
                    ? 'border-cyan-500 bg-cyan-950/20 shadow-md'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                <Eye className={`w-5 h-5 ${engine === 'local_llava' ? 'text-cyan-400' : 'text-slate-500'}`} />
                <div>
                  <strong className="block text-xs font-bold text-slate-200">Local LLaVA</strong>
                  <span className="text-[9px] text-slate-500 font-mono">llava-1.5-7b-hf</span>
                </div>
              </label>
            </div>
          </div>

          {/* Key Configuration — always visible */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              <Key className="w-3.5 h-3.5 text-cyan-400" /> API Key Configuration
            </span>

            {/* Gemini Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">Gemini API Key</label>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                  config.has_gemini_key
                    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/30'
                    : 'text-rose-400 border-rose-500/30 bg-rose-950/30'
                }`}>
                  {config.has_gemini_key ? '✓ SET' : '✗ UNSET'}
                </span>
              </div>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={config.has_gemini_key ? '●●●●●● (leave blank to keep current)' : 'AIzaSyxxxxxxxxxx'}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:outline-none rounded-xl py-2 px-3.5 text-xs text-slate-200 font-mono"
              />
            </div>

            {/* HuggingFace Token */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">HuggingFace API Token</label>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                  config.has_hf_token
                    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/30'
                    : 'text-rose-400 border-rose-500/30 bg-rose-950/30'
                }`}>
                  {config.has_hf_token ? '✓ SET' : '✗ UNSET'}
                </span>
              </div>
              <input
                type="password"
                value={hfToken}
                onChange={(e) => setHfToken(e.target.value)}
                placeholder={config.has_hf_token ? '●●●●●● (leave blank to keep current)' : 'hf_xxxxxxxxxxxxxxxx'}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:outline-none rounded-xl py-2 px-3.5 text-xs text-slate-200 font-mono"
              />
              <p className="text-[9.5px] text-slate-500">
                Needed for HuggingFace Serverless engine. Get a token at <span className="text-cyan-400 font-mono">huggingface.co/settings/tokens</span>
              </p>
            </div>
          </div>

          <div className="border-t border-slate-900 my-2" />

          {/* Sliders */}
          <div className="space-y-4">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Retrieval & Grounding Parameters
            </span>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Database className="w-3.5 h-3.5 text-cyan-400" /> Context Top-K
                </label>
                <span className="text-xs font-black px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/20 font-mono">
                  {topK}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" /> Embedding Fusion Weight (α)
                </label>
                <span className="text-xs font-black px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/20 font-mono">
                  {alpha.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={alpha}
                onChange={(e) => setAlpha(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <span className="text-[9.5px] text-slate-500 block">
                α controls balance between visual feature vectors and question text keywords.
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <AlignLeft className="w-3.5 h-3.5 text-cyan-400" /> Max Response Tokens
                </label>
                <span className="text-xs font-black px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/20 font-mono">
                  {maxNewTokens}
                </span>
              </div>
              <input
                type="range"
                min="32"
                max="512"
                step="16"
                value={maxNewTokens}
                onChange={(e) => setMaxNewTokens(parseInt(e.target.value, 10))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-900 flex items-center justify-between">
          <div className="text-[10px] text-slate-500 font-mono">
            Hardware: <strong className="text-slate-300">{config.device}</strong>
          </div>

          <button
            onClick={handleApply}
            disabled={isSaving}
            className="py-2.5 px-5 rounded-xl font-display font-semibold text-xs text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/15 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? 'Applying...' : 'Apply Configuration'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
