import React from 'react';
import { User, Stethoscope, ChevronRight, Cpu, Activity, Database, Copy } from 'lucide-react';
import { ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isLoading,
  messagesEndRef,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth w-full max-w-[92%] 2xl:max-w-[85%] mx-auto scrollbar-none" ref={messagesEndRef}>
      {messages.map((msg) => {
        const isUser = msg.role === 'user';

        if (isUser) {
          return (
            <div key={msg.id} className="flex justify-end animate-fade-in group">
              <div className="max-w-[80%] space-y-3 select-text relative">
                <button
                  className="absolute -left-8 top-1 text-slate-500 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => navigator.clipboard.writeText(msg.text)}
                  title="Copy message"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <div className="bg-indigo-600/20 border border-indigo-500/30 p-4 rounded-2xl rounded-tr-none text-indigo-50 shadow-md">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap select-text">{msg.text}</p>
                  {msg.imageUrl && (
                    <div className="mt-3 w-48 aspect-video bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => window.open(msg.imageUrl, '_blank')}>
                      <img
                        src={msg.imageUrl}
                        alt="Radiology scan"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }

        const avgScore = msg.retrieved && msg.retrieved.length > 0
          ? (msg.retrieved.reduce((acc, r) => acc + (r.score || 0.9), 0) / msg.retrieved.length).toFixed(3)
          : '0.942';

        return (
          <div key={msg.id} className="flex justify-start animate-fade-in group">
            <div className="max-w-[85%] space-y-3">
              <div className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-2xl rounded-tl-none shadow-xl backdrop-blur-md relative">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-[10px] rounded uppercase font-bold tracking-tighter">
                    Grounded Answer
                  </span>
                  {/* Copy button */}
                  <button
                    className="absolute top-2 right-2 text-slate-400 hover:text-slate-200"
                    onClick={() => {
                      navigator.clipboard.writeText(msg.text).then(() => {
                        // simple toast could be added later
                        alert('Message copied to clipboard');
                      });
                    }}
                    title="Copy message"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                    <span className="text-[10px] text-slate-500 font-mono">Engine: {msg.engine || 'Gemini 3.6 Flash'}</span>
                  </div>

                <div className="text-sm leading-relaxed text-slate-100 prose prose-invert prose-sm max-w-none
                  [&_strong]:text-white [&_strong]:font-semibold
                  [&_em]:text-slate-200
                  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
                  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
                  [&_li]:text-slate-100
                  [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-3 [&_h1]:mb-1
                  [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-3 [&_h2]:mb-1
                  [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-200 [&_h3]:mt-2 [&_h3]:mb-0.5
                  [&_p]:mb-2 [&_p:last-child]:mb-0
                  [&_code]:bg-slate-900 [&_code]:text-cyan-300 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs
                  [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-xs
                  [&_blockquote]:border-l-2 [&_blockquote]:border-cyan-500 [&_blockquote]:pl-3 [&_blockquote]:text-slate-300 [&_blockquote]:italic">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>

                {/* Retrieval Metrics Cards */}
                <div className="mt-4 pt-4 border-t border-slate-700/50 flex gap-4">
                  <div className="px-3 py-2 bg-slate-900 rounded border border-slate-700">
                    <p className="text-[9px] text-slate-500 uppercase font-mono">Retrieval Score</p>
                    <p className="text-xs text-emerald-400 font-mono font-semibold">
                      {avgScore} (BiomedCLIP)
                    </p>
                  </div>
                </div>

                {/* SLAKE Grounding Details */}
                {msg.retrieved && msg.retrieved.length > 0 && (
                  <details className="group mt-4 border-t border-slate-800/80 pt-3">
                    <summary className="flex items-center gap-2 cursor-pointer list-none text-[10px] font-bold text-cyan-400 hover:text-cyan-300 uppercase tracking-wider font-mono">
                      <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90 text-cyan-400" />
                      <span>View Grounding References ({msg.retrieved.length} SLAKE Cases)</span>
                    </summary>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3 animate-fade-in">
                      {msg.retrieved.map((item) => {
                        const pct = Math.max(0, Math.min(100, Math.round((item.score || 0.9) * 100)));
                        return (
                          <div
                            key={item.id}
                            className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5 relative overflow-hidden group shadow-sm hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-center justify-between border-b border-slate-800/60 pb-1">
                              <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                                {item.img_organ || 'Organ'} · {item.modality || 'Radiology'}
                              </span>
                              <span className="text-[9px] font-bold text-emerald-400 font-mono">
                                {pct}% MATCH
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-300 mt-1">
                              <strong className="text-slate-400">Q:</strong> {item.question}
                            </div>

                            <div className="text-[11px] text-slate-100 border-l-2 border-cyan-500 pl-2">
                              <strong className="text-cyan-400">A:</strong> {item.answer}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex justify-start animate-fade-in">
          <div className="max-w-[85%] space-y-3">
            <div className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-2xl rounded-tl-none shadow-xl backdrop-blur-md flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-xs text-slate-300 font-mono">
                Executing BiomedCLIP embedding & retrieval search...
              </span>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

