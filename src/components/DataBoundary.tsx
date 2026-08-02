import React from 'react';
import { WifiOff, RefreshCw, AlertCircle, Database } from 'lucide-react';
import { cn } from '../lib/utils';

export interface DataBoundaryProps {
  loading?: boolean;
  error?: Error | string | null;
  isCached?: boolean;
  isStale?: boolean;
  onRetry?: () => void;
  loadingFallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const DataBoundary: React.FC<DataBoundaryProps> = ({
  loading = false,
  error = null,
  isCached = false,
  isStale = false,
  onRetry,
  loadingFallback,
  errorFallback,
  className,
  children,
}) => {
  if (loading) {
    if (loadingFallback) return <>{loadingFallback}</>;
    return (
      <div className={cn("p-6 flex flex-col items-center justify-center space-y-3 text-center rounded-2xl bg-[#080d14] border border-white/5", className)}>
        <RefreshCw className="w-6 h-6 text-primary animate-spin" />
        <p className="text-xs text-gray-400 font-medium">Resolving data from local storage...</p>
      </div>
    );
  }

  if (error) {
    if (errorFallback) return <>{errorFallback}</>;
    const errorMessage = typeof error === 'string' ? error : error.message || 'Unable to load live data';

    return (
      <div className={cn("p-5 rounded-2xl bg-[#0c121e] border border-amber-500/20 text-amber-200/90 space-y-3 my-3 shadow-lg", className)}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
            <WifiOff className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">Offline / Limited Connection</h4>
            <p className="text-xs text-gray-300 mt-1">{errorMessage}</p>
          </div>
        </div>

        {onRetry && (
          <div className="flex justify-end pt-1">
            <button
              onClick={onRetry}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 border border-amber-500/30"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Sync</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative group/boundary">
      {(isCached || isStale) && (
        <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-medium flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-1.5 truncate">
            <Database className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate">Showing offline cached data</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-blue-400 hover:text-blue-200 flex items-center gap-1 hover:underline text-[10px] uppercase font-bold tracking-wider shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Revalidate</span>
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

export default DataBoundary;
