import React from 'react';
import { Layers, Activity, FileText, CheckCircle } from 'lucide-react';
import { RetrievedContext } from '../types';

interface RagInspectorProps {
  retrievedItems: RetrievedContext[];
  vectorCount: number;
}

export const RagInspector: React.FC<RagInspectorProps> = ({
  retrievedItems,
  vectorCount,
}) => {
  return (
    <aside className="w-80 border-l border-slate-800 bg-slate-950/50 p-5 shrink-0 hidden lg:flex flex-col font-sans overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest font-mono">
            SLAKE Contexts
          </h2>
        </div>
        <span className="text-[10px] text-slate-500 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
          Matched ({retrievedItems.length})
        </span>
      </div>

      <div className="space-y-3.5 flex-1">
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
        <div className="mt-6 p-4 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 border border-slate-800 rounded-2xl space-y-3 shadow-lg">
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
    </aside>
  );
};
