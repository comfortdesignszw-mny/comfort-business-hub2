import React, { useState } from 'react';
import { Store } from 'lucide-react';

interface AppLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function AppLogo({ className = '', size = 'md' }: AppLogoProps) {
  const [imgError, setImgError] = useState(false);

  const dimensionMap = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-20 h-20',
  };

  const iconSizeMap = {
    sm: 14,
    md: 20,
    lg: 24,
    xl: 40,
  };

  const currentDimension = dimensionMap[size] || dimensionMap.md;

  if (imgError) {
    return (
      <div className={`${currentDimension} bg-gradient-to-br from-primary/30 to-accent/30 rounded-xl flex items-center justify-center border border-primary/40 shadow-[0_0_15px_rgba(0,242,254,0.3)] shrink-0 overflow-hidden ${className}`}>
        <Store size={iconSizeMap[size]} className="text-primary drop-shadow-[0_0_8px_#00f2fe]" />
      </div>
    );
  }

  return (
    <div className={`${currentDimension} bg-white/5 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 shadow-[0_0_15px_rgba(0,242,254,0.2)] shrink-0 ${className}`}>
      <img
        src="/icon.png"
        alt="Comfort Hub"
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
      />
    </div>
  );
}
