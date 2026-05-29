import React, { useState, useRef, useEffect } from 'react';
import { Upload, Link as LinkIcon, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import { uploadAndCompressImage } from '../lib/upload-utils';

interface ImageInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  aspectRatio?: 'square' | 'video' | 'portrait';
}

export default function ImageInput({ value, onChange, label, className, aspectRatio = 'square' }: ImageInputProps) {
  const [mode, setMode] = useState<'upload' | 'url'>(value && value.startsWith('data:') ? 'upload' : 'url');
  const [isProcessing, setIsProcessing] = useState(false);
  const [localUrl, setLocalUrl] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync mode with value changes if needed
  React.useEffect(() => {
    if (value && value.startsWith('data:')) {
      setMode('upload');
    } else if (value) {
      setMode('url');
      setLocalUrl(value);
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate if it is actually an image / supported file format
    if (!file.type || !file.type.startsWith('image/')) {
      setUploadError("Error uploading file, this may be bad connection or wrong file format, please try again");
      if (e.target) e.target.value = '';
      setTimeout(() => {
        setUploadError(null);
      }, 10000);
      return;
    }

    setIsProcessing(true);
    setUploadError(null);
    let isCompleted = false;

    // Instantly provide local preview for snappy UI
    const localPreviewUrl = URL.createObjectURL(file);
    onChange(localPreviewUrl); // Show preview instantly

    // Setup 30-second timeout for robust sync and upload
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (!isCompleted) {
        setIsProcessing(false);
        onChange(''); // revert
        if (e.target) e.target.value = '';
        setUploadError("Error uploading file, this may be bad connection or wrong file format, please try again");
        setTimeout(() => {
          setUploadError(null);
        }, 10000);
      }
    }, 30 * 1000); // 30 seconds!

    try {
      const filename = `assets/images/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
      const downloadURL = await uploadAndCompressImage(file, filename, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.6
      });

      isCompleted = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      onChange(downloadURL); // Pass the final Firebase URL
      setIsProcessing(false);

    } catch (err) {
      console.error("Error processing image:", err);
      if (!isCompleted) {
        isCompleted = true;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        
        setIsProcessing(false);
        onChange('');
        if (e.target) e.target.value = '';
        setUploadError("Error uploading file, this may be bad connection or wrong file format, please try again");
        setTimeout(() => setUploadError(null), 10000);
      }
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
        {value ? (
          <>
            <img 
              src={value} 
              alt="Preview" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=400&auto=format&fit=crop"; // Minimalist abstract placeholder
                console.error("Image failed to load, placeholder applied:", value);
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
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-600 group-hover:text-primary group-hover:scale-110 transition-all">
              {isProcessing ? <Loader2 size={24} className="animate-spin text-primary" /> : <ImageIcon size={24} />}
            </div>
            <div>
              <p className="text-[10px] font-black text-white uppercase tracking-widest mb-1">
                {mode === 'url' ? 'Input Resource Link' : 'Select Network File'}
              </p>
              <p className="text-[8px] text-gray-500 uppercase tracking-widest leading-relaxed">
                {mode === 'url' ? 'Protocol: HTTPS preferred' : 'Limit: 1MB per asset'}
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
                <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest">Upload Failed</h4>
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
