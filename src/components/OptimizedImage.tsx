import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { ImageIcon } from 'lucide-react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  fallbackSrc?: string;
  className?: string;
}

export default function OptimizedImage({ 
  src, 
  alt, 
  className, 
  fallbackSrc = "https://images.unsplash.com/photo-1557683316-973673baf926?w=400&q=80",
  ...props 
}: OptimizedImageProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={cn("relative overflow-hidden bg-white/5", className)}>
      {!loaded && !error && (
        <div className="absolute inset-0 animate-pulse flex items-center justify-center bg-white/5">
          <ImageIcon className="text-gray-700" size={24} />
        </div>
      )}
      
      <img
        src={error ? fallbackSrc : src}
        alt={alt}
        className={cn(
          "transition-all duration-500",
          !loaded && "opacity-0 scale-105 blur-lg",
          loaded && "opacity-100 scale-100 blur-0",
          className
        )}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
        referrerPolicy="no-referrer"
        {...props}
      />
    </div>
  );
}
