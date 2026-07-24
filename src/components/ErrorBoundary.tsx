import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home, ShieldCheck } from 'lucide-react';
import { clearAppLocalState } from '../lib/dexieSyncManager';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isClearing: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isClearing: false,
  };

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Global App Boundary] Caught exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHardRecovery = async () => {
    this.setState({ isClearing: true });
    try {
      await clearAppLocalState();
      // Clear session cache storage if any
      sessionStorage.clear();
      // Reload page clean
      window.location.href = '/?recovered=true';
    } catch (e) {
      console.error(e);
      window.location.reload();
    }
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#05070a] text-white flex items-center justify-center p-6 select-none font-sans">
          <div className="max-w-md w-full bg-[#0d1117] border border-red-500/30 rounded-3xl p-8 shadow-[0_0_60px_rgba(239,68,68,0.15)] space-y-6 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-500/10 rounded-full blur-[80px]" />
            
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0 text-red-500">
                <AlertTriangle size={28} />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-400 block">
                  System Safeguard Active
                </span>
                <h2 className="text-xl font-black italic uppercase tracking-tight text-white mt-0.5">
                  App Safeguard Intercepted
                </h2>
              </div>
            </div>

            <div className="space-y-2 bg-black/40 p-4 rounded-2xl border border-white/5">
              <p className="text-xs text-gray-300 font-medium leading-relaxed">
                The application encountered an unhandled execution glitch. Your local data and offline outbox are safely preserved in IndexedDB sandbox storage.
              </p>
              {this.state.error && (
                <div className="mt-2 p-2.5 bg-red-950/40 rounded-xl border border-red-500/20 text-[10px] font-mono text-red-300 truncate">
                  {this.state.error.message || 'Unknown runtime error'}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-3.5 px-4 bg-primary text-black rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white transition-all shadow-lg active:scale-95"
              >
                <RefreshCw size={16} /> Recover Session & Reload
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full py-3.5 px-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
              >
                <Home size={16} /> Return to Primary Hub
              </button>

              <button
                onClick={this.handleHardRecovery}
                disabled={this.state.isClearing}
                className="w-full py-3 px-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all"
              >
                <Trash2 size={14} />
                {this.state.isClearing ? 'Purging Local Cache...' : 'Clear Cache & Hard Reset'}
              </button>
            </div>

            <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-gray-500 pt-2 border-t border-white/5">
              <span className="flex items-center gap-1">
                <ShieldCheck size={10} className="text-neon-green" /> Comfort Matrix Watchdog v3.6
              </span>
              <span>Standalone PWA Protected</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
