import React, { useState, useEffect } from 'react';
import { FileText, Download, X, Loader2, Check, Sparkles, Calendar } from 'lucide-react';

interface Report {
  report_id: string;
  session_id: string;
  user_email: string;
  title: string;
  summary: string;
  findings: string;
  createdAt: number;
}

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSessionId: string;
  userEmail?: string;
  onAddToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  activeSessionId,
  userEmail,
  onAddToast
}) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchReports();
    }
  }, [isOpen, userEmail]);

  const fetchReports = async () => {
    try {
      const url = userEmail ? `/api/reports?user_email=${encodeURIComponent(userEmail)}` : '/api/reports';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
        if (data.reports && data.reports.length > 0) {
          // Select most recent report or matching session report
          const matching = data.reports.find((r: Report) => r.session_id === activeSessionId);
          setActiveReport(matching || data.reports[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeSessionId,
          user_email: userEmail,
          title: `Clinical Consultation Report (${new Date().toLocaleDateString()})`
        })
      });

      if (res.ok) {
        const data = await res.json();
        onAddToast('Clinical Report saved to MongoDB Atlas', 'success');
        fetchReports();
        if (data.report) setActiveReport(data.report);
      } else {
        const err = await res.json().catch(() => ({}));
        onAddToast(err.detail || 'Failed to generate report', 'error');
      }
    } catch (e) {
      onAddToast('Network error generating report', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyReport = () => {
    if (!activeReport) return;
    const fullText = `MEDICAL VQA CLINICAL REPORT\nID: ${activeReport.report_id}\nDate: ${new Date(activeReport.createdAt * 1000).toLocaleString()}\n\nSUMMARY:\n${activeReport.summary}\n\nFINDINGS:\n${activeReport.findings}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onAddToast('Report copied to clipboard', 'info');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">MongoDB Clinical Reports</h3>
              <p className="text-[11px] text-slate-400 font-mono">
                GROUNDED CLINICAL CONSULTATION DOCUMENTS
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateReport}
              disabled={isGenerating}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-sky-500 text-slate-950 font-bold text-xs flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 shadow-md shadow-teal-500/10"
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Generate Current Session Report</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Reports Sidebar */}
          <div className="w-64 border-r border-slate-800 bg-slate-950/40 p-3 space-y-2 overflow-y-auto">
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-bold px-2 py-1">
              Saved Reports ({reports.length})
            </div>
            {reports.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 italic">
                No reports saved yet. Click generate above to create one.
              </div>
            ) : (
              reports.map((rep) => {
                const isSelected = activeReport?.report_id === rep.report_id;
                return (
                  <button
                    key={rep.report_id}
                    onClick={() => setActiveReport(rep)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-teal-500/10 border-teal-500/40 text-teal-100'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-semibold truncate text-slate-200 mb-1">{rep.title}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(rep.createdAt * 1000).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Active Report Detail View */}
          <div className="flex-1 p-6 overflow-y-auto bg-slate-900/30 flex flex-col space-y-6">
            {activeReport ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded font-bold">
                      MONGODB ATLAS RECORD · {activeReport.report_id}
                    </span>
                    <h2 className="text-xl font-bold text-slate-100 mt-2">{activeReport.title}</h2>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      User: {activeReport.user_email} · Session: {activeReport.session_id}
                    </p>
                  </div>

                  <button
                    onClick={handleCopyReport}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 transition-all cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Download className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Document'}</span>
                  </button>
                </div>

                {/* Summary Box */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-teal-400">
                    Clinical Consultation Summary
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {activeReport.summary}
                  </p>
                </div>

                {/* Findings Section */}
                <div className="space-y-3 flex-1">
                  <div className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">
                    Detailed VQA Findings & Evidence
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">
                    {activeReport.findings || 'No findings recorded.'}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-3">
                <FileText className="w-12 h-12 text-slate-700 stroke-1" />
                <p className="text-sm font-medium">Select a report from the left sidebar or click "Generate Current Session Report".</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
