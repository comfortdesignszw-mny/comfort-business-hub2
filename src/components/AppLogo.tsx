import React, { useState } from 'react';
import { Store, Shield } from 'lucide-react';

interface AppLogoProps {
  className?: string;
  imgClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const CANDIDATE_SOURCES = [
  '/icons/icon-512x512.png',
  '/icons/icon-192x192.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-maskable-512x512.png',
  '/icon.png',
  '/apple-touch-icon.png'
];

export default function AppLogo({ className = '', imgClassName = '', size = 'md' }: AppLogoProps) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [hasFailedAll, setHasFailedAll] = useState(false);

  const dimensionMap = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20',
  };

  const iconSizeMap = {
    sm: 14,
    md: 20,
    lg: 24,
    xl: 32,
    '2xl': 40,
  };

  const currentDimension = dimensionMap[size] || dimensionMap.md;

  const handleImageError = () => {
    if (sourceIndex < CANDIDATE_SOURCES.length - 1) {
      setSourceIndex(prev => prev + 1);
    } else {
      setHasFailedAll(true);
    }
  };

  if (hasFailedAll) {
    return (
      <div 
        className={`${currentDimension} bg-gradient-to-br from-primary/30 via-accent/20 to-primary/40 rounded-2xl flex items-center justify-center border border-primary/40 shadow-[0_0_20px_rgba(0,242,254,0.35)] shrink-0 overflow-hidden relative group ${className}`}
        aria-label="Comfort Business Hub Logo"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-accent/10 opacity-70 animate-pulse" />
        <Store size={iconSizeMap[size]} className="text-primary drop-shadow-[0_0_10px_#00f2fe] relative z-10" />
      </div>
    );
  }

  return (
    <div className={`${currentDimension} bg-white/5 rounded-2xl flex items-center justify-center overflow-hidden border border-white/10 shadow-[0_0_20px_rgba(0,242,254,0.25)] shrink-0 relative ${className}`}>
      <img
        src={CANDIDATE_SOURCES[sourceIndex]}
        alt="Comfort Business Hub Logo"
        className={`w-full h-full object-cover relative z-10 ${imgClassName}`}
        referrerPolicy="no-referrer"
        onError={handleImageError}
      />
    </div>
  );
}

