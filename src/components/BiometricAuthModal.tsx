import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Fingerprint, ShieldCheck, Lock, CheckCircle2, AlertCircle, X, KeyRound, Sparkles, RefreshCw } from 'lucide-react';
import { 
  isBiometricSupported, 
  isBiometricRegistered, 
  registerBiometrics, 
  verifyBiometrics, 
  disableBiometrics,
  getBiometricConfig 
} from '../lib/biometricAuth';
import { UserProfile } from '../types';

interface BiometricAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  mode?: 'settings' | 'unlock';
  onUnlockSuccess?: () => void;
}

export default function BiometricAuthModal({
  isOpen,
  onClose,
  profile,
  mode = 'settings',
  onUnlockSuccess
}: BiometricAuthModalProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function checkSupport() {
      const isAvailable = await isBiometricSupported();
      setSupported(isAvailable);
      if (profile?.uid) {
        setIsRegistered(isBiometricRegistered(profile.uid));
      }
    }
    if (isOpen) {
      checkSupport();
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, profile?.uid]);

  if (!isOpen) return null;

  const handleRegister = async () => {
    if (!profile?.uid) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await registerBiometrics(profile.uid, profile.email || 'user@comforthub.app');
      setIsRegistered(true);
      setSuccessMsg('Biometric authentication successfully enrolled! Touch ID / Face ID is now active for instant session unlock.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Biometric registration failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerify = async () => {
    if (!profile?.uid) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const verified = await verifyBiometrics(profile.uid);
      if (verified) {
        setSuccessMsg('Biometric verification passed!');
        if (onUnlockSuccess) {
          setTimeout(() => {
            onUnlockSuccess();
            onClose();
          }, 800);
        }
      } else {
        setErrorMsg('Biometric verification failed.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Biometric authentication was canceled.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisable = () => {
    if (!profile?.uid) return;
    disableBiometrics(profile.uid);
    setIsRegistered(false);
    setSuccessMsg('Biometric authentication has been revoked for this session.');
  };

  const config = profile?.uid ? getBiometricConfig(profile.uid) : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="relative w-full max-w-md max-h-[95vh] overflow-y-auto bg-[#0d1117] border border-primary/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(0,242,254,0.15)] space-y-6"
        >
          {/* Background Ambient Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(0,242,254,0.2)]">
                <Fingerprint size={24} className="animate-pulse" />
              </div>
              <div>
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-primary block">
                  Hardware Vault Security
                </span>
                <h3 className="text-lg font-black italic uppercase tracking-tight text-white">
                  {mode === 'unlock' ? 'Session Biometric Unlock' : 'Touch ID / Face ID Vault'}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Status Alert Banner */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-red-300 font-medium">
              <AlertCircle size={16} className="shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-neon-green/10 border border-neon-green/30 rounded-2xl flex items-center gap-2.5 text-xs text-neon-green font-medium">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Main Body */}
          <div className="space-y-4">
            {supported === false ? (
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2 text-center">
                <ShieldCheck size={32} className="mx-auto text-gray-500" />
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-300">Biometrics Unavailable</h4>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Your current browser environment or hardware device does not support WebAuthn platform biometrics.
                </p>
              </div>
            ) : mode === 'unlock' ? (
              /* Unlock Screen Mode */
              <div className="space-y-6 text-center py-2">
                <div className="relative mx-auto w-24 h-24 rounded-3xl bg-primary/10 border-2 border-primary/40 flex items-center justify-center text-primary shadow-[0_0_30px_rgba(0,242,254,0.3)]">
                  <Fingerprint size={48} className="animate-pulse" />
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-neon-green text-black flex items-center justify-center font-bold text-xs shadow-lg">
                    <ShieldCheck size={16} />
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-black uppercase text-white tracking-wider">
                    Touch Sensor or Face ID
                  </h4>
                  <p className="text-xs text-gray-400">
                    Verify hardware biometric key to unlock full hub functionality.
                  </p>
                </div>

                <button
                  onClick={handleVerify}
                  disabled={isProcessing}
                  className="w-full py-4 bg-primary text-black rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white transition-all shadow-[0_0_20px_rgba(0,242,254,0.3)] active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <RefreshCw className="animate-spin" size={16} />
                  ) : (
                    <Fingerprint size={18} />
                  )}
                  {isProcessing ? 'Verifying Hardware Sensor...' : 'Scan Biometric to Unlock'}
                </button>
              </div>
            ) : (
              /* Settings & Management Mode */
              <div className="space-y-4">
                <div className="p-4 bg-black/40 border border-white/10 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                      <KeyRound size={14} className="text-primary" /> Security Hardware Status
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      isRegistered 
                        ? 'bg-neon-green/10 text-neon-green border border-neon-green/30' 
                        : 'bg-white/10 text-gray-400 border border-white/10'
                    }`}>
                      {isRegistered ? 'Enrolled & Active' : 'Not Enrolled'}
                    </span>
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed">
                    Biometric authentication binds your local device’s Touch ID / Face ID hardware scanner directly to your Comfort Hub account.
                  </p>

                  {config && (
                    <div className="pt-2 border-t border-white/5 text-[10px] text-gray-400 flex items-center justify-between font-mono">
                      <span>Registered: {new Date(config.registeredAt).toLocaleDateString()}</span>
                      <span className="truncate max-w-[150px]">ID: {config.credentialId.slice(0, 10)}...</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 space-y-2">
                  {!isRegistered ? (
                    <button
                      onClick={handleRegister}
                      disabled={isProcessing}
                      className="w-full py-3.5 bg-primary text-black rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                      {isProcessing ? <RefreshCw className="animate-spin" size={16} /> : <Fingerprint size={16} />}
                      {isProcessing ? 'Communicating with Sensor...' : 'Enroll Touch ID / Face ID'}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={handleVerify}
                        disabled={isProcessing}
                        className="w-full py-3 bg-primary/20 border border-primary/40 text-primary rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary hover:text-black transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isProcessing ? <RefreshCw className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
                        Test Biometric Unlock
                      </button>

                      <button
                        onClick={handleDisable}
                        className="w-full py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all"
                      >
                        Revoke Biometric Enrolment
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[9px] text-gray-500 font-mono uppercase tracking-widest">
            <span className="flex items-center gap-1">
              <Sparkles size={10} className="text-primary" /> WebAuthn Level 3 Standard
            </span>
            <span>Local Vault Isolated</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
