import React, { useState } from 'react';
import { HeartPulse, CheckCircle2, Search, ShieldAlert, Activity, Heart, FileText, User, Pill } from 'lucide-react';

interface WelcomeViewProps {
  onSelectQuery: (query: string) => void;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({ onSelectQuery }) => {
  const [activeTab, setActiveTab] = useState<'closed' | 'open' | 'ood'>('closed');

  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-center max-w-3xl mx-auto w-full my-auto">
      {/* Animated ClinicaRAG Core Shield */}
      <div className="relative mb-6 shrink-0">
        <div className="absolute inset-[-16px] rounded-full bg-cyan-500/10 blur-[24px]" />
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-xl shadow-cyan-500/10">
          <HeartPulse className="w-8 h-8 animate-pulse" />
        </div>
      </div>

      <h2 className="font-display font-extrabold text-2xl md:text-3xl text-slate-100 tracking-tight leading-tight mb-2">
        How can I assist your diagnostics today?
      </h2>
      <p className="text-slate-400 text-xs md:text-sm max-w-lg mb-8 leading-relaxed">
        Attach a medical scan (MRI, CT, X-ray) and submit a clinical question. Answers are grounded on the <strong class="text-cyan-400 font-semibold">SLAKE</strong> multimodal VQA database to eliminate hallucinations.
      </p>

      {/* Preset Tabs Container */}
      <div className="w-full space-y-4">
        <div className="flex justify-center p-1 bg-slate-950/80 border border-slate-900 rounded-xl w-fit mx-auto">
          <button
            onClick={() => setActiveTab('closed')}
            className={`flex items-center gap-2 py-1.5 px-4 rounded-lg font-display font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'closed'
                ? 'bg-cyan-500/15 text-cyan-400 shadow-md border border-cyan-500/20'
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> <span>Yes / No (Closed)</span>
          </button>
          <button
            onClick={() => setActiveTab('open')}
            className={`flex items-center gap-2 py-1.5 px-4 rounded-lg font-display font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'open'
                ? 'bg-cyan-500/15 text-cyan-400 shadow-md border border-cyan-500/20'
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}
          >
            <Search className="w-3.5 h-3.5" /> <span>Factual (Open)</span>
          </button>
          <button
            onClick={() => setActiveTab('ood')}
            className={`flex items-center gap-2 py-1.5 px-4 rounded-lg font-display font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'ood'
                ? 'bg-cyan-500/15 text-cyan-400 shadow-md border border-cyan-500/20'
                : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" /> <span>OOD Checker</span>
          </button>
        </div>

        {/* Closed Tab Grid */}
        {activeTab === 'closed' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 animate-fade-in">
            <button
              onClick={() => onSelectQuery('Is there any abnormality visible in the lung area?')}
              className="group p-3.5 text-left rounded-xl bg-slate-900/40 border border-slate-900 hover:border-cyan-500/30 hover:bg-cyan-950/10 transition-all cursor-pointer flex gap-3.5 shadow-sm"
            >
              <div className="p-2.5 rounded-lg bg-slate-950 text-cyan-400 group-hover:bg-cyan-950 group-hover:text-cyan-300 transition-all shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-slate-200 leading-snug truncate group-hover:text-slate-100">
                  Is there any abnormality visible in the lung area?
                </h4>
                <span className="text-[10px] text-slate-500 mt-1 block leading-none font-mono">
                  Bilateral lung field screening
                </span>
              </div>
            </button>

            <button
              onClick={() => onSelectQuery('Is this a chest X-ray?')}
              className="group p-3.5 text-left rounded-xl bg-slate-900/40 border border-slate-900 hover:border-cyan-500/30 hover:bg-cyan-950/10 transition-all cursor-pointer flex gap-3.5 shadow-sm"
            >
              <div className="p-2.5 rounded-lg bg-slate-950 text-cyan-400 group-hover:bg-cyan-950 group-hover:text-cyan-300 transition-all shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-slate-200 leading-snug truncate group-hover:text-slate-100">
                  Is this a chest X-ray?
                </h4>
                <span className="text-[10px] text-slate-500 mt-1 block leading-none font-mono">
                  Radiographic modality verification
                </span>
              </div>
            </button>
          </div>
        )}

        {/* Open Tab Grid */}
        {activeTab === 'open' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 animate-fade-in">
            <button
              onClick={() => onSelectQuery('What organ is shown in this medical image?')}
              className="group p-3.5 text-left rounded-xl bg-slate-900/40 border border-slate-900 hover:border-cyan-500/30 hover:bg-cyan-950/10 transition-all cursor-pointer flex gap-3.5 shadow-sm"
            >
              <div className="p-2.5 rounded-lg bg-slate-950 text-cyan-400 group-hover:bg-cyan-950 group-hover:text-cyan-300 transition-all shrink-0">
                <Heart className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-slate-200 leading-snug truncate group-hover:text-slate-100">
                  What organ is shown in this medical image?
                </h4>
                <span className="text-[10px] text-slate-500 mt-1 block leading-none font-mono">
                  Anatomical organ classification
                </span>
              </div>
            </button>

            <button
              onClick={() => onSelectQuery('What type of scan is this?')}
              className="group p-3.5 text-left rounded-xl bg-slate-900/40 border border-slate-900 hover:border-cyan-500/30 hover:bg-cyan-950/10 transition-all cursor-pointer flex gap-3.5 shadow-sm"
            >
              <div className="p-2.5 rounded-lg bg-slate-950 text-cyan-400 group-hover:bg-cyan-950 group-hover:text-cyan-300 transition-all shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-slate-200 leading-snug truncate group-hover:text-slate-100">
                  What type of scan is this?
                </h4>
                <span className="text-[10px] text-slate-500 mt-1 block leading-none font-mono">
                  CT / MRI contrast sequence identification
                </span>
              </div>
            </button>
          </div>
        )}

        {/* OOD Tab Grid */}
        {activeTab === 'ood' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 animate-fade-in">
            <button
              onClick={() => onSelectQuery("What is the patient's age?")}
              className="group p-3.5 text-left rounded-xl bg-slate-900/40 border border-slate-900 hover:border-cyan-500/30 hover:bg-cyan-950/10 transition-all cursor-pointer flex gap-3.5 shadow-sm"
            >
              <div className="p-2.5 rounded-lg bg-slate-950 text-cyan-400 group-hover:bg-cyan-950 group-hover:text-cyan-300 transition-all shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-slate-200 leading-snug truncate group-hover:text-slate-100">
                  What is the patient's age?
                </h4>
                <span className="text-[10px] text-slate-500 mt-1 block leading-none font-mono">
                  Demographic hallucination guard test
                </span>
              </div>
            </button>

            <button
              onClick={() => onSelectQuery('What medication is the patient taking?')}
              className="group p-3.5 text-left rounded-xl bg-slate-900/40 border border-slate-900 hover:border-cyan-500/30 hover:bg-cyan-950/10 transition-all cursor-pointer flex gap-3.5 shadow-sm"
            >
              <div className="p-2.5 rounded-lg bg-slate-950 text-cyan-400 group-hover:bg-cyan-950 group-hover:text-cyan-300 transition-all shrink-0">
                <Pill className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-slate-200 leading-snug truncate group-hover:text-slate-100">
                  What medication is the patient taking?
                </h4>
                <span className="text-[10px] text-slate-500 mt-1 block leading-none font-mono">
                  EHR / Prescription OOD filter test
                </span>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
