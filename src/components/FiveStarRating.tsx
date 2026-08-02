import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '../lib/utils';

interface FiveStarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  count?: number;
  countLabel?: string;
  interactive?: boolean;
  className?: string;
}

const RATING_LABELS = [
  'Select Rating',
  '1 Star - Poor',
  '2 Stars - Fair',
  '3 Stars - Good',
  '4 Stars - Very Good',
  '5 Stars - Excellent'
];

export const FiveStarRating: React.FC<FiveStarRatingProps> = ({
  value,
  onChange,
  readOnly = false,
  size = 'md',
  showLabel = false,
  count,
  countLabel,
  interactive = false,
  className
}) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const starSizes = {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 28
  };

  const iconSize = starSizes[size];

  const activeValue = hoverValue !== null ? hoverValue : Math.round(value);

  return (
    <div className={cn("inline-flex items-center gap-1.5 flex-wrap", className)}>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= activeValue;
          const isHalf = !isFilled && star - 0.5 <= value;
          const isClickable = !readOnly && Boolean(onChange);
          const Component = isClickable ? 'button' : 'span';

          return (
            <Component
              key={star}
              {...(isClickable ? { type: 'button' as const } : {})}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                if (isClickable && onChange) {
                  e.preventDefault();
                  onChange(star);
                }
              }}
              onMouseEnter={(e: React.MouseEvent) => {
                e.stopPropagation();
                if (isClickable && onChange) setHoverValue(star);
              }}
              onMouseLeave={(e: React.MouseEvent) => {
                e.stopPropagation();
                if (isClickable && onChange) setHoverValue(null);
              }}
              className={cn(
                "transition-all p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-amber-400/50 inline-flex items-center justify-center",
                isClickable ? "cursor-pointer hover:scale-125 active:scale-95" : "cursor-default"
              )}
              title={`${star} Star${star > 1 ? 's' : ''}`}
            >
              <Star
                size={iconSize}
                className={cn(
                  "transition-colors duration-200",
                  isFilled
                    ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                    : isHalf
                    ? "fill-amber-400/50 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.3)]"
                    : "fill-white/10 text-gray-600"
                )}
              />
            </Component>
          );
        })}
      </div>

      {/* Numeric Score */}
      <span className={cn(
        "font-black text-amber-400 tracking-tight",
        size === 'sm' ? "text-[10px]" : size === 'md' ? "text-xs" : size === 'lg' ? "text-sm" : "text-base"
      )}>
        {value ? value.toFixed(1) : '0.0'}
      </span>

      {/* Review / Rating Count */}
      {count !== undefined && (
        <span className="text-gray-400 text-[10px] sm:text-xs font-semibold">
          ({count} {count === 1 ? (countLabel || 'rating') : `${countLabel || 'rating'}s`})
        </span>
      )}

      {/* Interactive Label */}
      {showLabel && !readOnly && onChange && (
        <span className="text-[10px] sm:text-xs font-bold text-amber-300 uppercase tracking-wider ml-1 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
          {RATING_LABELS[activeValue] || `${activeValue} Stars`}
        </span>
      )}
    </div>
  );
};

export default FiveStarRating;
