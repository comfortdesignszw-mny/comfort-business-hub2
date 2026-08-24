import React, { useState, useRef, useEffect } from 'react';
import { Upload, Link as LinkIcon, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import { createInstantLocalImage, uploadImageInBackground } from '../lib/upload-utils';

interface ImageInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  aspectRatio?: 'square' | 'video' | 'portrait';
  allowLocalUpload?: boolean;
}

export default function ImageInput({ value, onChange, label, className, aspectRatio = 'square', allowLocalUpload = true }: ImageInputProps) {
  const [mode, setMode] = useState<'upload' | 'url'>(value && value.startsWith('data:') ? 'upload' : 'url');
  const [isProcessing, setIsProcessing] = useState(false);
  const [localUrl, setLocalUrl] = useState(value || '');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Sync mode with value changes if needed
  React.useEffect(() => {
    if (value) {
      setLocalUrl(value);
      if (value.startsWith('data:')) {
        setMode('upload');
      }
    }
  }, [value]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!allowLocalUpload) {
      setUploadError("Local upload limit reached (max 2 local uploads). Please enter image URL for additional images.");
      if (e.target) e.target.value = '';
      setTimeout(() => setUploadError(null), 6000);
      return;
    }

    // Validate if it is actually an image / supported file format
    if (!file.type || !file.type.startsWith('image/')) {
      setUploadError("Invalid image format. Please choose a JPEG, PNG, or WebP image.");
      if (e.target) e.target.value = '';
      setTimeout(() => setUploadError(null), 6000);
      return;
    }

    setUploadError(null);

    try {
      // 1. Instantly generate compressed local data URL (< 20ms)
      const instantDataUrl = await createInstantLocalImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.65
      });

      // 2. Optimistic UI update in single frame
      setLocalUrl(instantDataUrl);
      onChange(instantDataUrl);

      // 3. Background upload to Firebase Storage (write-behind)
      const filename = `assets/images/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
      setIsProcessing(true);
      uploadImageInBackground(
        file,
        filename,
        (remoteUrl) => {
          setIsProcessing(false);
          // In-place swap without UI disruption
          onChange(remoteUrl);
        },
        () => {
          // Failure or offline: keep the instant local data URL as source of truth
          setIsProcessing(false);
        }
      );

    } catch (err: any) {
      console.error("Error creating local image preview:", err);
      setUploadError(err.message || "Failed to process image file.");
      setTimeout(() => setUploadError(null), 6000);
    }
  };

  const handleUrlSubmit = () => {
    if (localUrl && (localUrl.startsWith('http') || localUrl.startsWith('data:'))) {
      onChange(localUrl);
    }
  };

  const aspectClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'aspect-[3/4]'
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">{label}</label>}
      
      <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 mb-2">
        <button
          type="button"
          onClick={() => {
            setMode('url');
            if (!value) setLocalUrl('');
          }}
          className={cn(
            "flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
            mode === 'url' ? "bg-white/10 text-white shadow-xl" : "text-gray-500 hover:text-gray-400"
          )}
        >
          <div className="flex items-center justify-center gap-1.5">
            <LinkIcon size={12} />
            Image URL
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={cn(
            "flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
            mode === 'upload' ? "bg-white/10 text-white shadow-xl" : "text-gray-500 hover:text-gray-400"
          )}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Upload size={12} />
            Upload File
          </div>
        </button>
      </div>

      <div className={cn(
        "relative rounded-2xl border-2 border-dashed border-white/10 overflow-hidden bg-black/20 group hover:border-primary/30 transition-colors",
        aspectClasses[aspectRatio]
      )}>
        {value || localUrl ? (
          <>
            <img 
              src={value || localUrl} 
              alt="Preview" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=400&auto=format&fit=crop";
              }}
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setLocalUrl('');
                }}
                className="w-10 h-10 bg-red-500/20 backdrop-blur-md rounded-xl flex items-center justify-center text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white transition-all"
              >
                <X size={20} />
              </button>
            </div>
            {isProcessing && (
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-md rounded-md flex items-center gap-1 text-[9px] font-medium text-primary">
                <Loader2 size={10} className="animate-spin" />
                <span>Syncing</span>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-600 group-hover:text-primary group-hover:scale-110 transition-all">
              {isProcessing ? <Loader2 size={24} className="animate-spin text-primary" /> : <ImageIcon size={24} />}
            </div>
            <div>
              <p className="text-[10px] font-black text-white uppercase tracking-widest mb-1">
                {mode === 'url' ? 'Input Resource Link' : 'Select File (Instant Preview)'}
              </p>
              <p className="text-[8px] text-gray-500 uppercase tracking-widest leading-relaxed">
                {mode === 'url' ? 'Protocol: HTTPS preferred' : 'Auto-optimized for instant offline & online view'}
              </p>
            </div>
          </div>
        )}

        {mode === 'upload' && !value && (
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        )}
      </div>

      {mode === 'url' && !value && (
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://images.unsplash.com/photo-..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all outline-none"
            value={localUrl}
            onChange={(e) => setLocalUrl(e.target.value)}
            onBlur={handleUrlSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleUrlSubmit();
              }
            }}
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            className="px-4 bg-primary rounded-xl text-[#05070a] text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
          >
            Load
          </button>
        </div>
      )}

      <AnimatePresence>
        {uploadError && (
          <motion.div
            key="image-input-upload-error-toast"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] w-[90%] max-w-md"
          >
            <div className="bg-[#120404] border border-red-500/50 rounded-2xl p-4 shadow-[0_0_30px_rgba(239,68,68,0.3)] flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-500 flex-shrink-0 font-bold">
                ✕
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest">Image Notice</h4>
                <p className="text-xs text-red-400 font-semibold mt-1 leading-normal selection:bg-red-500/30">
                  {uploadError}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setUploadError(null)}
                className="text-red-500/60 hover:text-red-400 transition-colors p-1"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
