import React, { useState } from 'react';
import { Upload, Link as LinkIcon, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

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

  // Sync mode with value changes if needed
  React.useEffect(() => {
    if (value && value.startsWith('data:')) {
      setMode('upload');
    } else if (value) {
      setMode('url');
      setLocalUrl(value);
    }
  }, [value]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const quickReader = new FileReader();
      quickReader.onloadend = () => {
        // 1. Instantly render a fast, raw preview with zero loading delay!
        const rawDataUrl = quickReader.result as string;
        onChange(rawDataUrl);
        setIsProcessing(false);

        // 2. Spawn compression in the background to avoid blocking user interaction
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Max dimensions
          const MAX_SIZE = 800;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with 0.6 quality
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
          
          // 3. Update with the optimized background reference silently
          onChange(compressedDataUrl);
        };
        img.src = rawDataUrl;
      };
      quickReader.readAsDataURL(file);
    } catch (err) {
      console.error("Error processing image:", err);
      setIsProcessing(false);
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
    </div>
  );
}
