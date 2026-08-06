import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Image as ImageIcon, 
  X, 
  Eye, 
  Download, 
  Loader2, 
  Send, 
  CheckCircle2, 
  File, 
  ExternalLink,
  ZoomIn,
  Paperclip
} from 'lucide-react';
import { uploadAndCompressImage, blobToDataUrl } from '../lib/upload-utils';

export interface POPAttachmentData {
  popReference: string;
  popAttachmentUrl?: string;
  popAttachmentName?: string;
  popAttachmentType?: 'image' | 'pdf' | 'document' | string;
}

interface POPFormProps {
  initialReference?: string;
  submitting: boolean;
  onSubmit: (data: POPAttachmentData) => Promise<void>;
  buttonText?: string;
}

export function POPForm({
  initialReference = '',
  submitting,
  onSubmit,
  buttonText = 'Send Proof of Payment (POP)'
}: POPFormProps) {
  const [popInput, setPopInput] = useState(initialReference);
  const [attachment, setAttachment] = useState<{
    url: string;
    name: string;
    type: 'image' | 'pdf' | 'document' | string;
  } | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    setFileError(null);
    setIsProcessingFile(true);

    try {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      
      let url = '';
      let type: 'image' | 'pdf' | 'document' = 'document';

      if (isImage) {
        type = 'image';
        try {
          url = await uploadAndCompressImage(file, `pop_proofs/${Date.now()}_${file.name}`);
        } catch {
          url = await blobToDataUrl(file);
        }
      } else if (isPdf) {
        type = 'pdf';
        url = await blobToDataUrl(file);
      } else {
        type = 'document';
        url = await blobToDataUrl(file);
      }

      setAttachment({
        url,
        name: file.name,
        type
      });
    } catch (err: any) {
      console.error("POP file upload error:", err);
      setFileError("Could not process file. Please try a different image or PDF file.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!popInput.trim() && !attachment) return;

    onSubmit({
      popReference: popInput.trim(),
      popAttachmentUrl: attachment?.url,
      popAttachmentName: attachment?.name,
      popAttachmentType: attachment?.type
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* File Attachment Controls: Image / Screenshot or Document / PDF */}
      <div className="space-y-1.5">
        <label className="text-[9px] font-black uppercase tracking-wider text-amber-300 flex items-center justify-between">
          <span>Attach Proof File (Screenshot or PDF)</span>
          <span className="text-[8px] text-gray-400 font-normal lowercase">(optional if text code provided)</span>
        </label>

        {/* Hidden inputs */}
        <input 
          type="file" 
          ref={imageInputRef} 
          accept="image/*" 
          className="hidden" 
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />
        <input 
          type="file" 
          ref={docInputRef} 
          accept="application/pdf, .pdf, .doc, .docx, .txt" 
          className="hidden" 
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />

        {/* Selected Attachment Preview or Upload Buttons */}
        {attachment ? (
          <div className="bg-black/60 border border-amber-500/40 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              {attachment.type === 'image' ? (
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-amber-500/30 bg-black shrink-0 relative group">
                  <img src={attachment.url} alt="POP Preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-center justify-center shrink-0 text-amber-400 font-bold text-[10px]">
                  PDF
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-white truncate">{attachment.name}</p>
                <p className="text-[8.5px] text-amber-400 font-mono uppercase tracking-wider">
                  {attachment.type === 'image' ? 'Image Screenshot Attached' : 'PDF Document Attached'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAttachment(null)}
              className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-red-400 transition-all cursor-pointer shrink-0"
              title="Remove attachment"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isProcessingFile}
              onClick={() => imageInputRef.current?.click()}
              className="px-3 py-2 bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 rounded-xl text-[9px] font-black text-amber-300 uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isProcessingFile ? <Loader2 size={12} className="animate-spin text-amber-400" /> : <ImageIcon size={12} className="text-amber-400" />}
              Screenshot / Image
            </button>

            <button
              type="button"
              disabled={isProcessingFile}
              onClick={() => docInputRef.current?.click()}
              className="px-3 py-2 bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 rounded-xl text-[9px] font-black text-amber-300 uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isProcessingFile ? <Loader2 size={12} className="animate-spin text-amber-400" /> : <FileText size={12} className="text-amber-400" />}
              PDF / Document File
            </button>
          </div>
        )}

        {fileError && (
          <p className="text-[8.5px] font-bold text-rose-400">{fileError}</p>
        )}
      </div>

      {/* Transaction Ref / Code Input */}
      <div className="space-y-1">
        <label className="text-[9px] font-black uppercase tracking-wider text-gray-300">
          POP Reference Code / Approval ID
        </label>
        <input
          type="text"
          value={popInput}
          onChange={e => setPopInput(e.target.value)}
          placeholder="Enter POP Ref / Code (e.g. EC12345678, Ref #)"
          className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-mono outline-none focus:border-amber-400"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || isProcessingFile || (!popInput.trim() && !attachment)}
        className="w-full bg-amber-500 hover:bg-amber-400 text-black py-2.5 rounded-xl font-black text-[9.5px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-md"
      >
        {submitting ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />} {buttonText}
      </button>
    </form>
  );
}

export function POPDisplay({
  popReference,
  popAttachmentUrl,
  popAttachmentName,
  popAttachmentType,
  popStatus,
  isSeller,
  onVerify,
  verifying = false,
  onReupload
}: {
  popReference?: string;
  popAttachmentUrl?: string;
  popAttachmentName?: string;
  popAttachmentType?: string;
  popStatus?: string;
  isSeller?: boolean;
  onVerify?: () => void;
  verifying?: boolean;
  onReupload?: () => void;
}) {
  const [showImageLightbox, setShowImageLightbox] = useState(false);

  const isImage = popAttachmentType === 'image' || 
    (popAttachmentUrl && (popAttachmentUrl.startsWith('data:image/') || popAttachmentUrl.match(/\.(jpeg|jpg|gif|png|webp)/i)));

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-[10px] font-mono font-bold text-white flex items-center gap-1.5">
            Ref / Code: {popReference ? <span className="text-amber-300 font-black">{popReference}</span> : <span className="text-gray-400 italic font-normal">File Attachment Provided</span>}
          </p>
          <p className="text-[9px] text-gray-300 mt-0.5">
            Status:{' '}
            {popStatus === 'verified' ? (
              <span className="text-emerald-400 font-black inline-flex items-center gap-1">
                <CheckCircle2 size={11} /> Verified by Supplier
              </span>
            ) : (
              <span className="text-amber-400 font-bold">Awaiting Supplier Verification</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isSeller && popStatus !== 'verified' && onReupload && (
            <button
              onClick={onReupload}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-gray-200 rounded-xl text-[8.5px] font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              Update / Replace Proof
            </button>
          )}

          {isSeller && popStatus !== 'verified' && onVerify && (
            <button
              onClick={onVerify}
              disabled={verifying}
              className="bg-emerald-500 hover:bg-emerald-400 text-black px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shrink-0 shadow-md transition-all"
            >
              {verifying ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Verify POP & Conclude Sale
            </button>
          )}
        </div>
      </div>

      {/* POP Attachment Rendering */}
      {popAttachmentUrl && (
        <div className="pt-2 border-t border-amber-500/20">
          <p className="text-[8.5px] font-black uppercase tracking-wider text-amber-300 mb-1.5 flex items-center gap-1">
            <Paperclip size={10} /> Attached Proof of Payment Document/Screenshot:
          </p>

          {isImage ? (
            <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl p-2">
              <div 
                onClick={() => setShowImageLightbox(true)}
                className="w-16 h-16 rounded-lg overflow-hidden bg-black border border-amber-500/30 relative group cursor-pointer shrink-0"
              >
                <img src={popAttachmentUrl} alt="POP Screenshot" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <ZoomIn size={14} className="text-white" />
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[10px] font-bold text-white truncate">{popAttachmentName || 'Proof_Screenshot.jpg'}</p>
                <p className="text-[8px] text-gray-400 font-mono">Screenshot / Image File</p>
                
                <button
                  onClick={() => setShowImageLightbox(true)}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-[8.5px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Eye size={10} /> View Full Screenshot
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 bg-black/40 border border-white/10 rounded-xl p-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 font-bold text-[9px] shrink-0">
                  PDF
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-white truncate">{popAttachmentName || 'Proof_Of_Payment.pdf'}</p>
                  <p className="text-[8px] text-gray-400 font-mono">PDF / Document File</p>
                </div>
              </div>

              <a
                href={popAttachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={popAttachmentName || 'Proof_Of_Payment.pdf'}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-[8.5px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1 transition-all shrink-0"
              >
                <ExternalLink size={10} /> View / Download Document
              </a>
            </div>
          )}
        </div>
      )}

      {/* Lightbox Modal for Image Screenshot */}
      <AnimatePresence>
        {showImageLightbox && popAttachmentUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/90 backdrop-blur-md" 
              onClick={() => setShowImageLightbox(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="relative max-w-3xl w-full bg-[#080c14] border border-amber-500/40 rounded-2xl p-4 space-y-3 z-10 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <p className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                  <ImageIcon size={14} /> POP Screenshot Inspection: {popAttachmentName || 'Screenshot'}
                </p>
                <button
                  onClick={() => setShowImageLightbox(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-auto flex items-center justify-center bg-black/80 rounded-xl p-2 border border-white/5">
                <img 
                  src={popAttachmentUrl} 
                  alt="Proof of Payment Screenshot" 
                  className="max-h-[70vh] w-auto object-contain rounded-lg"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <a
                  href={popAttachmentUrl}
                  download={popAttachmentName || 'POP_Screenshot.png'}
                  className="px-3 py-1.5 bg-amber-500 text-black font-black text-[9px] uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <Download size={12} /> Download Screenshot
                </a>
                <button
                  onClick={() => setShowImageLightbox(false)}
                  className="px-4 py-1.5 bg-white/10 text-white font-black text-[9px] uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
