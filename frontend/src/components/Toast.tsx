import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastProps {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: (id: string) => void;
}

export const ToastNotification: React.FC<ToastProps> = ({ id, message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const bgStyles =
    type === 'success'
      ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-400'
      : type === 'error'
      ? 'bg-rose-950/90 border-rose-500/30 text-rose-400'
      : 'bg-cyan-950/90 border-cyan-500/30 text-cyan-400';

  return (
    <div
      className={`fixed bottom-20 right-6 z-50 p-4 rounded-xl border backdrop-blur-md shadow-2xl flex items-start gap-3 max-w-sm transition-all duration-300 animate-slide-in ${bgStyles}`}
    >
      {type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />}
      {type === 'error' && <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
      {type === 'info' && <Info className="w-5 h-5 shrink-0 mt-0.5" />}

      <div className="flex-1 min-w-0 pr-1">
        <h4 className="text-xs font-bold capitalize leading-none mb-1">{type}</h4>
        <p className="text-[11px] leading-relaxed text-slate-200">{message}</p>
      </div>

      <button
        onClick={() => onClose(id)}
        className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-white/10 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
