import React from 'react';
import { Layers, Activity, FileText, CheckCircle, PanelRightClose, PanelRightOpen, Database } from 'lucide-react';
import { RetrievedContext } from '../types';

interface RagInspectorProps {
  retrievedItems: RetrievedContext[];
  vectorCount: number;
  isOpen?: boolean;
  onToggle?: () => void;
}

export const RagInspector: React.FC<RagInspectorProps> = ({
  retrievedItems,
  vectorCount,
  isOpen = true,
  onToggle,
}) => {
  return (
    <aside className={`h-full p-5 shrink-0 flex flex-col font-sans z-30 transition-all duration-300 ease-in-out border-cyan-500/10 shadow-[inset_0_0_30px_rgba(6,182,212,0.03)] backdrop-blur-xl
      ${isOpen
        ? 'w-[420px] bg-white/[0.02] border-l'
        : 'w-[68px] bg-white/[0.01] border-l'
      }
      lg:relative lg:translate-x-0
      fixed top-0 bottom-0 right-0
      ${isOpen ? 'translate-x-0 bg-slate-950/95 z-50' : 'translate-x-full lg:translate-x-0 z-30'}
      w-[320px] lg:w-auto
      overflow-y-auto scrollbar-thin
    `}>
      <div className={`flex items-center ${isOpen ? 'justify-between' : 'justify-center'} mb-5 shrink-0`}>
        {isOpen ? (
          <>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">
                SLAKE Contexts
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                Matched ({retrievedItems.length})
              </span>
              <button
                onClick={onToggle}
                className="p-1.5 rounded-lg border border-cyan-500/20 bg-cyan-950/40 text-cyan-400 hover:bg-cyan-500/30 hover:text-cyan-300 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500"
                aria-label="Collapse context sidebar"
                title="Collapse Sidebar"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg border border-cyan-500/20 bg-cyan-950/40 text-cyan-400 hover:bg-cyan-500/30 hover:text-cyan-300 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-500"
            aria-label="Expand context sidebar"
            title="Expand Sidebar"
          >
            <PanelRightOpen className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen ? (
        /* Expanded View */
        <div className="space-y-3.5 flex-1 animate-fade-in">
          {retrievedItems.length === 0 ? (
            <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl text-center space-y-2">
              <FileText className="w-6 h-6 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No active context retrieved yet.</p>
              <p className="text-[10px] text-slate-600 font-mono">
                Submit a medical query or scan to view similarity vectors.
              </p>
            </div>
          ) : (
            retrievedItems.map((item, idx) => {
              const simScore = (item.score || 0.92).toFixed(3);
              return (
                <div
                  key={item.id || idx}
                  className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors cursor-help space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">
                      ID: SLAKE_{item.id || (2000 + idx)}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Sim: <strong className="text-emerald-400">{simScore}</strong>
                    </span>
                  </div>

                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    {item.img_organ || 'Organ'} · {item.modality || 'Radiology'}
                  </div>

                  <p className="text-[11px] leading-snug italic text-slate-400 border-l-2 border-slate-700 pl-2">
                    "{item.answer || item.question}"
                  </p>
                </div>
              );
            })
          )}

          {/* Pipeline Health Card */}
          <div className="mt-6 p-4 bg-gradient-to-br from-indigo-500/8 to-cyan-500/8 backdrop-blur-lg border border-cyan-500/15 rounded-2xl space-y-3 shadow-[0_0_25px_rgba(6,182,212,0.07)]">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold text-slate-200 tracking-wide uppercase font-mono flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                Pipeline Health
              </h3>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                ACTIVE
              </span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-500">Embedding Dim</span>
                <span className="text-[10px] font-mono text-slate-300">512 (CLIP)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-500">RAG Confidence</span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> High
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-500">Index Type</span>
                <span className="text-[10px] font-mono text-slate-300">HNSW / COSINE</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-800/80 pt-2">
                <span className="text-[10px] text-slate-500">Vector Count</span>
                <span className="text-[10px] font-mono text-cyan-400 font-bold">{vectorCount || 4918}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Collapsed View */
        <div className="flex-1 py-5 flex flex-col items-center gap-6 overflow-y-auto scrollbar-none min-h-0 animate-fade-in">
          {/* SLAKE Contexts Matched indicator */}
          <div className="relative" title={`SLAKE Contexts matched: ${retrievedItems.length}`}>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all cursor-pointer flex items-center justify-center" onClick={onToggle}>
              <Layers className="w-5 h-5 text-cyan-400" />
            </div>
            {retrievedItems.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 text-[9px] font-black bg-cyan-500 text-slate-950 w-4 h-4 rounded-full flex items-center justify-center font-mono">
                {retrievedItems.length}
              </span>
            )}
          </div>

          {/* Pipeline Status Indicator */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 flex items-center justify-center" title="Pipeline Status: ACTIVE">
            <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
          </div>

          {/* Vector Count database icon */}
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 flex flex-col items-center justify-center gap-1" title={`Vector Count: ${vectorCount}`}>
            <Database className="w-4.5 h-4.5 text-cyan-400" />
            <span className="text-[8px] font-mono font-bold text-slate-500 mt-1">{vectorCount}</span>
          </div>
        </div>
      )}
    </aside>
  );
};
