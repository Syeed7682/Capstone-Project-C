import React, { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';

interface ChatInputProps {
  inputText: string;
  setInputText: (val: string) => void;
  selectedImageFile: File | null;
  selectedImagePreview: string | null;
  onSelectImage: (file: File) => void;
  onClearImage: () => void;
  onSendMessage: () => void;
  isLoading: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  setInputText,
  selectedImageFile,
  selectedImagePreview,
  onSelectImage,
  onClearImage,
  onSendMessage,
  isLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectImage(file);
    }
  };

  return (
    <div className="p-6 border-t border-slate-800 bg-slate-900/50 shrink-0 z-20 font-sans">
      {/* Attached Image Bar */}
      {selectedImagePreview && (
        <div className="mb-3 flex items-center gap-3 p-2 pr-4 rounded-xl bg-slate-950 border border-slate-700 w-fit animate-fade-in shadow-xl">
          <div className="relative w-12 h-12 rounded-lg border border-slate-700 overflow-hidden shrink-0">
            <img
              src={selectedImagePreview}
              alt="Scan upload preview"
              className="w-full h-full object-cover"
            />
            <button
              onClick={onClearImage}
              className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center cursor-pointer shadow-md hover:scale-110 transition-transform"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <span className="text-xs font-semibold text-slate-200 truncate max-w-[180px] font-mono">
              {selectedImageFile?.name || 'scan_image.jpg'}
            </span>
            <span className="text-[10px] text-cyan-400 font-mono font-medium">
              Medical radiograph loaded
            </span>
          </div>
        </div>
      )}

      {/* Input Field Bar */}
      <div className="relative flex items-center">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="absolute left-4 p-2 text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
          title="Attach medical radiograph scan"
        >
          <ImagePlus className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your clinical question..."
          className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-4 pl-14 pr-24 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all shadow-inner"
        />

        <button
          type="button"
          onClick={onSendMessage}
          disabled={isLoading || (!inputText.trim() && !selectedImageFile)}
          className="absolute right-3 px-5 py-2 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-900/40 disabled:opacity-40 cursor-pointer"
        >
          {isLoading ? 'Processing...' : 'Query'}
        </button>
      </div>
    </div>
  );
};

