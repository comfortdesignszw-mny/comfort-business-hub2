import React, { useState, useRef } from 'react';
import { Video, Upload, Link as LinkIcon, X, AlertCircle, Play, Pause, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface VideoInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

const PRESET_VIDEOS = [
  { name: '📱 Tech Promo', url: 'https://assets.mixkit.co/videos/preview/mixkit-hands-holding-a-smartphone-with-green-screen-41558-large.mp4' },
  { name: '🛍️ Store Showcase', url: 'https://assets.mixkit.co/videos/preview/mixkit-woman-shopping-for-clothes-in-a-store-41539-large.mp4' },
  { name: '☕ Gourmet / Food', url: 'https://assets.mixkit.co/videos/preview/mixkit-barista-pouring-coffee-into-a-cup-41548-large.mp4' },
  { name: '⚡ E-Commerce Sale', url: 'https://assets.mixkit.co/videos/preview/mixkit-online-shopping-on-a-laptop-41560-large.mp4' }
];

export default function VideoInput({ value, onChange, label = 'Classified Video Ad (Max 750KB file or Direct Video URL)', className }: VideoInputProps) {
  const [mode, setMode] = useState<'upload' | 'url' | 'presets'>('upload');
  const [urlInput, setUrlInput] = useState(value || '');
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // 1. Strict size limit for inline Firestore Base64: 750 KB
    const maxSizeInBytes = 750 * 1024;
    if (file.size > maxSizeInBytes) {
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
      const sizeInKB = Math.round(file.size / 1024);
      setError(`Video file is ${sizeInMB}MB (${sizeInKB}KB). Maximum allowed file size for inline upload is 750KB to ensure instant database saving. Tip: Compress your video or use "Direct Video URL" for unlimited file sizes.`);
      return;
    }

    if (!file.type.startsWith('video/')) {
      setError('Selected file is not a valid video format.');
      return;
    }

    setLoading(true);

    // 2. Check duration using a temporary video element
    const videoUrl = URL.createObjectURL(file);
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = videoUrl;

    tempVideo.onloadedmetadata = () => {
      URL.revokeObjectURL(videoUrl);
      const duration = tempVideo.duration;

      if (duration > 15.5) {
        setError(`Video is ${Math.round(duration)}s long. Maximum allowed video length for inline ad clips is 15 seconds.`);
        setLoading(false);
        return;
      }

      // Convert to Base64
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange(reader.result as string);
        setLoading(false);
      };
      reader.onerror = () => {
        setError('Failed to read video file.');
        setLoading(false);
      };
      reader.readAsDataURL(file);
    };

    tempVideo.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      // Fallback: convert file to base64 if metadata fails
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange(reader.result as string);
        setLoading(false);
      };
      reader.readAsDataURL(file);
    };
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) {
      onChange('');
      return;
    }
    setError(null);
    onChange(urlInput.trim());
  };

  const handleClear = () => {
    onChange('');
    setUrlInput('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className={cn("space-y-2 text-left", className)}>
      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Video size={12} className="text-primary" /> {label}
        </span>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-red-400 hover:text-red-300 text-[8px] font-black uppercase tracking-wider flex items-center gap-0.5"
          >
            <X size={10} /> Clear Video
          </button>
        )}
      </label>

      {/* Video Preview Player if video selected */}
      {value ? (
        <div className="relative rounded-2xl overflow-hidden border border-primary/30 bg-black/60 aspect-video max-h-56 group flex items-center justify-center">
          <video
            ref={videoRef}
            src={value}
            loop
            muted
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className="w-full h-full object-contain bg-black"
          />
          
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-primary text-black flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              title="Remove Video"
            >
              <X size={18} />
            </button>
          </div>

          <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[8px] font-black text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
            Video Ready
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Mode Selector */}
          <div className="grid grid-cols-3 gap-1 bg-[#0d1117] p-1 rounded-xl border border-white/10 text-[9px] font-black uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={cn(
                "py-1.5 rounded-lg transition-all flex items-center justify-center gap-1",
                mode === 'upload' ? "bg-primary/20 text-primary border border-primary/30" : "text-gray-400 hover:text-white"
              )}
            >
              <Upload size={11} /> File (&lt;750KB)
            </button>
            <button
              type="button"
              onClick={() => setMode('url')}
              className={cn(
                "py-1.5 rounded-lg transition-all flex items-center justify-center gap-1",
                mode === 'url' ? "bg-primary/20 text-primary border border-primary/30" : "text-gray-400 hover:text-white"
              )}
            >
              <LinkIcon size={11} /> Direct URL
            </button>
            <button
              type="button"
              onClick={() => setMode('presets')}
              className={cn(
                "py-1.5 rounded-lg transition-all flex items-center justify-center gap-1",
                mode === 'presets' ? "bg-accent/20 text-accent border border-accent/30" : "text-gray-400 hover:text-white"
              )}
            >
              <Video size={11} /> Sample Presets
            </button>
          </div>

          {/* Mode Inputs */}
          {mode === 'upload' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime"
                onChange={handleFileChange}
                className="hidden"
                id="classified-video-upload"
              />
              <label
                htmlFor="classified-video-upload"
                className="w-full py-4 px-4 bg-[#0d1117] border border-dashed border-white/20 hover:border-primary/50 rounded-2xl flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-white/[0.02] transition-all group"
              >
                <Upload size={20} className="text-gray-400 group-hover:text-primary transition-colors" />
                <span className="text-xs font-bold text-gray-300">
                  {loading ? 'Processing Video File...' : 'Choose Device Video File'}
                </span>
                <span className="text-[9px] text-gray-500 font-medium">
                  Max size: 750KB • Max length: 15 seconds • MP4, WebM, MOV
                </span>
              </label>
            </div>
          ) : mode === 'url' ? (
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/promo-video.mp4"
                className="flex-1 bg-[#0d1117] border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-primary/50 text-xs font-medium"
              />
              <button
                type="button"
                onClick={handleApplyUrl}
                className="px-4 py-2.5 bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
              >
                <Check size={14} /> Attach
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0d1117] rounded-xl border border-white/10">
              {PRESET_VIDEOS.map((preset, idx) => (
                <button
                  key={`video-preset-${idx}`}
                  type="button"
                  onClick={() => {
                    onChange(preset.url);
                    setUrlInput(preset.url);
                  }}
                  className="p-2 bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/40 rounded-lg text-left transition-all text-[10px] font-bold text-gray-300 hover:text-primary"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-[10px] font-bold">
          <AlertCircle size={14} className="shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
