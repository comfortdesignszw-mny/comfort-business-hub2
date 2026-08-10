import React from 'react';

interface EcoCashLogoProps {
  className?: string;
  style?: React.CSSProperties;
  size?: number;
}

export const EcoCashLogo: React.FC<EcoCashLogoProps> = ({ className = "h-5 w-auto", style, size }) => {
  const customStyle: React.CSSProperties = {
    ...(size ? { height: `${size}px`, width: 'auto' } : {}),
    ...style,
  };

  return (
    <svg 
      viewBox="0 0 160 40" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={customStyle}
      aria-label="EcoCash Logo"
    >
      <text 
        x="2" 
        y="30" 
        fontFamily="Arial, Helvetica, sans-serif" 
        fontWeight="900" 
        fontSize="34" 
        letterSpacing="-1.2"
      >
        <tspan fill="#0052B4">Eco</tspan>
        <tspan fill="#E31B23">Cash</tspan>
      </text>
    </svg>
  );
};

export default EcoCashLogo;
