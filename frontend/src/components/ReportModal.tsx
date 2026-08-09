import React, { useState, useEffect } from 'react';
import { FileText, Download, X, Loader2, Check, Sparkles, Calendar, Trash2 } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface Report {
  report_id: string;
  session_id: string;
  user_email: string;
  title: string;
  summary: string;
  findings: string;
  image_url?: string;
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
        } else {
          setActiveReport(null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteReport = async (reportId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this clinical report?')) return;

    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onAddToast('Clinical Report deleted successfully', 'info');
        const url = userEmail ? `/api/reports?user_email=${encodeURIComponent(userEmail)}` : '/api/reports';
        const repRes = await fetch(url);
        if (repRes.ok) {
          const data = await repRes.json();
          const updatedReports = data.reports || [];
          setReports(updatedReports);
          if (activeReport?.report_id === reportId) {
            setActiveReport(updatedReports.length > 0 ? updatedReports[0] : null);
          }
        }
      } else {
        const err = await res.json().catch(() => ({}));
        onAddToast(err.detail || 'Failed to delete report', 'error');
      }
    } catch (err) {
      onAddToast('Network error deleting report', 'error');
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
        onAddToast('Clinical Report generated successfully', 'success');
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

  const handleDownloadPDF = () => {
    if (!activeReport) return;
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const primaryColor = [13, 148, 136]; // Teal #0d9488
      const darkColor = [15, 23, 42];      // Slate 900 #0f172a
      const grayColor = [100, 116, 139];   // Slate 500 #64748b
      const lightBg = [248, 250, 252];     // Slate 50 #f8fafc

      const margin = 15;
      const pageWidth = doc.internal.pageSize.getWidth();
      const contentWidth = pageWidth - (margin * 2);
      let currentY = 18;

      // Header Tag
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`CLINICAL REPORT · ${activeReport.report_id.toUpperCase()}`, margin, currentY);
      currentY += 6;

      // Title
      doc.setFontSize(18);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      const titleLines = doc.splitTextToSize(activeReport.title, contentWidth);
      doc.text(titleLines, margin, currentY);
      currentY += (titleLines.length * 7) + 2;

      // Metadata
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      const dateStr = new Date(activeReport.createdAt * 1000).toLocaleString();
      doc.text(`User: ${activeReport.user_email || 'N/A'}   |   Session: ${activeReport.session_id}`, margin, currentY);
      currentY += 5;
      doc.text(`Date Generated: ${dateStr}`, margin, currentY);
      currentY += 8;

      // Divider Line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 10;

      // Section 1: Summary Title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('CLINICAL CONSULTATION SUMMARY', margin, currentY);
      currentY += 6;

      // Section 1: Summary Content
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

      const summaryLines = doc.splitTextToSize(activeReport.summary, contentWidth - 6);
      const summaryBoxHeight = (summaryLines.length * 4.5) + 6;

      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, currentY, contentWidth, summaryBoxHeight, 2, 2, 'FD');

      doc.text(summaryLines, margin + 3, currentY + 5);
      currentY += summaryBoxHeight + 10;

      // Section 2: Attached Image (if present)
      if (activeReport.image_url) {
        try {
          const pageHeight = doc.internal.pageSize.getHeight();
          const imgHeight = 50; // mm
          const imgWidth = 65;  // mm
          if (currentY + imgHeight + 10 > pageHeight - margin) {
            doc.addPage();
            currentY = margin + 10;
          }

          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.text('ATTACHED RADIOLOGY SCAN / CLINICAL EVIDENCE', margin, currentY);
          currentY += 5;

          doc.addImage(activeReport.image_url, 'JPEG', margin, currentY, imgWidth, imgHeight);
          currentY += imgHeight + 10;
        } catch (imgErr) {
          console.error('Failed to embed image into PDF:', imgErr);
        }
      }

      // Section 3: Findings Title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('DETAILED VQA FINDINGS & EVIDENCE', margin, currentY);
      currentY += 6;

      // Section 2: Findings Content
      doc.setFont('Courier', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);

      const findingsText = activeReport.findings || 'No findings recorded.';
      const findingsLines = doc.splitTextToSize(findingsText, contentWidth - 6);
      const pageHeight = doc.internal.pageSize.getHeight();
      const limitY = pageHeight - margin - 10;
      const lineHeight = 4.2;

      let idx = 0;
      while (idx < findingsLines.length) {
        if (currentY > limitY) {
          doc.addPage();
          currentY = margin + 10;

          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
          doc.text(`Clinical Report (${activeReport.report_id}) - Page ${doc.getNumberOfPages()}`, margin, margin);

          doc.setFont('Courier', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        }

        doc.text(findingsLines[idx], margin, currentY);
        currentY += lineHeight;
        idx++;
      }

      const fileName = `${activeReport.report_id}_clinical_report.pdf`;
      doc.save(fileName);
      onAddToast('PDF downloaded successfully', 'success');
    } catch (e) {
      console.error('PDF Generation failed:', e);
      onAddToast('Failed to download PDF', 'error');
    }
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
              <h3 className="font-bold text-slate-100 text-sm">Clinical Reports</h3>
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
                  <div
                    key={rep.report_id}
                    onClick={() => setActiveReport(rep)}
                    className={`group relative w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-teal-500/10 border-teal-500/40 text-teal-100'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold truncate text-slate-200 mb-1 flex-1">{rep.title}</div>
                      <button
                        onClick={(e) => handleDeleteReport(rep.report_id, e)}
                        className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all cursor-pointer"
                        title="Delete Report"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(rep.createdAt * 1000).toLocaleDateString()}</span>
                    </div>
                  </div>
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
                      CLINICAL REPORT · {activeReport.report_id}
                    </span>
                    <h2 className="text-xl font-bold text-slate-100 mt-2">{activeReport.title}</h2>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      User: {activeReport.user_email} · Session: {activeReport.session_id}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyReport}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-2 transition-all cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <FileText className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                    </button>
                    <button
                      onClick={handleDownloadPDF}
                      className="px-3 py-1.5 rounded-lg border border-teal-500/30 bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5 text-teal-400" />
                      <span>Download PDF</span>
                    </button>
                    <button
                      onClick={() => handleDeleteReport(activeReport.report_id)}
                      className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-medium flex items-center gap-2 transition-all cursor-pointer"
                      title="Delete Report"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      <span>Delete</span>
                    </button>
                  </div>
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

                {/* Attached Radiology Scan */}
                {activeReport.image_url && (
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-teal-400">
                      Attached Radiology Scan / Clinical Evidence
                    </div>
                    <div className="flex justify-center bg-slate-950 rounded-lg p-3 border border-slate-800/80">
                      <img
                        src={activeReport.image_url}
                        alt="Radiology Scan"
                        className="max-h-56 rounded-lg object-contain border border-slate-800 shadow-md"
                      />
                    </div>
                  </div>
                )}

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
