import React from 'react';
import { RotateCw, ShieldCheck, Database, Cpu, FileText } from 'lucide-react';
import { IndexStatus } from '../types';

interface HeaderProps {
  indexStatus: IndexStatus;
  onRebuildIndex: () => void;
  isRebuilding: boolean;
  deviceInfo: string;
  onOpenReports: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  indexStatus,
  onRebuildIndex,
  isRebuilding,
  deviceInfo,
  onOpenReports,
}) => {
  const isReady = indexStatus.status === 'ready';
  const isIndexing = indexStatus.status === 'indexing' || isRebuilding;

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-20">
      {/* Left Logo / Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-bold">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-100">
          MedVQA <span className="text-slate-500 font-normal">| RAG Multi-Engine</span>
        </h1>
      </div>

      {/* Right Indicators & Actions */}
      <div className="flex items-center gap-4">
        {/* Reports Modal Trigger */}
        <button
          onClick={onOpenReports}
          className="px-3 py-1.5 rounded-xl border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 font-medium text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          title="View & Generate Clinical Reports in MongoDB"
        >
          <FileText className="w-3.5 h-3.5 text-teal-400" />
          <span>Clinical Reports</span>
        </button>

        {/* Vector Index Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-full border border-slate-700 text-xs shadow-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              isReady
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse'
                : 'bg-cyan-400 animate-pulse'
            }`}
          />
          <span className="text-slate-300 font-medium">
            {isReady ? 'Pinecone Cloud: Connected' : indexStatus.message || 'Building Index...'}
          </span>

          {isIndexing && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
              <div className="w-12 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300"
                  style={{ width: `${indexStatus.progress}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-cyan-400">{indexStatus.progress}%</span>
            </div>
          )}
        </div>

        {/* Device Info */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <Cpu className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-500 uppercase">DEVICE:</span>
          <span className="text-cyan-400 font-semibold">{deviceInfo || 'CUDA 12.1'}</span>
        </div>

        {/* Rebuild Action */}
        <button
          onClick={onRebuildIndex}
          disabled={isIndexing}
          className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700/80 text-slate-400 hover:text-cyan-400 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="Force rebuild vector index"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isIndexing ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>
    </header>
  );
};

