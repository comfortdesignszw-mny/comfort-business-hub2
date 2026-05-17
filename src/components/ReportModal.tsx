import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, Send, Loader2, ShieldAlert } from 'lucide-react';
import { ReportType, Report } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, serverTimestamp, setDoc, doc, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetType: 'product' | 'store' | 'user';
  targetName: string;
  ownerId: string;
  reporterId: string;
  reporterName: string;
}

const REPORT_OPTIONS: { value: ReportType; label: string; description: string }[] = [
  { 
    value: 'substandard', 
    label: 'Substandard Products/Services', 
    description: 'Item is of poor quality or does not match description.' 
  },
  { 
    value: 'misinformation', 
    label: 'Misinformation or misleading adverts', 
    description: 'False claims or deceptive marketing practices.' 
  },
  { 
    value: 'illegal', 
    label: 'Sale of illegal products', 
    description: 'Drugs, fraudulent items, or prohibited goods.' 
  },
  { 
    value: 'nudity', 
    label: 'Nudity and sexual explicit content', 
    description: 'Pornographic or inappropriate imagery/text.' 
  },
  { 
    value: 'violence', 
    label: 'Promotes violence or instability', 
    description: 'Inciting hate, violence, or social instability.' 
  }
];

export default function ReportModal({ 
  isOpen, 
  onClose, 
  targetId, 
  targetType, 
  targetName, 
  ownerId, 
  reporterId, 
  reporterName 
}: ReportModalProps) {
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!selectedType || !details.trim()) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const now = new Date();
      
      const reportData: Report = {
        id: reportId,
        reporterId,
        reporterName,
        targetId,
        targetType,
        targetName,
        ownerId,
        type: selectedType,
        details: details.trim(),
        status: 'pending',
        createdAt: now.toISOString()
      };

      // 1. Save the report
      await setDoc(doc(db, 'reports', reportId), reportData);

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setSelectedType(null);
        setDetails('');
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to submit report');
      handleFirestoreError(err, OperationType.CREATE, 'reports');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md"
            onClick={onClose}
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-[#0d1117] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Secure Integrity Report</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Target: {targetName} ({targetType})</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {success ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-12 space-y-4 text-center"
                >
                  <div className="w-20 h-20 bg-neon-green/10 rounded-full flex items-center justify-center text-neon-green animate-pulse">
                    <ShieldAlert size={40} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xl font-black text-white uppercase tracking-tighter italic">Report Transmitted</h4>
                    <p className="text-xs text-gray-500 font-medium">Compliance matrix updated. System is investigating.</p>
                  </div>
                </motion.div>
              ) : (
                <>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] ml-1">Type of Infraction</label>
                    <div className="grid grid-cols-1 gap-2">
                      {REPORT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setSelectedType(option.value)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-2xl border text-left transition-all",
                            selectedType === option.value 
                              ? "bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20" 
                              : "bg-white/5 border-white/5 hover:border-white/10"
                          )}
                        >
                          <div className={cn(
                            "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                            selectedType === option.value ? "border-red-500" : "border-gray-700"
                          )}>
                            {selectedType === option.value && <div className="w-2 h-2 bg-red-500 rounded-full" />}
                          </div>
                          <div className="flex-1">
                            <p className={cn(
                              "text-xs font-black uppercase italic tracking-tight",
                              selectedType === option.value ? "text-red-500" : "text-white"
                            )}>{option.label}</p>
                            <p className="text-[9px] text-gray-500 font-medium leading-none mt-0.5">{option.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] ml-1">Contextual Details</label>
                    <textarea 
                      placeholder="Provide specific evidence or description of the act..."
                      className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-xs font-medium text-white placeholder-gray-700 outline-none focus:border-red-500/30 transition-colors min-h-[100px] resize-none"
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-500 bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                      <AlertTriangle size={14} />
                      <p className="text-[10px] font-bold uppercase tracking-widest">{error}</p>
                    </div>
                  )}

                  <button 
                    onClick={handleSubmit}
                    disabled={isSubmitting || !selectedType || !details.trim()}
                    className={cn(
                      "w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] italic flex items-center justify-center gap-2 transition-all",
                      isSubmitting || !selectedType || !details.trim()
                        ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                        : "bg-red-500 text-white shadow-[0_4px_20px_rgba(239,68,68,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                    )}
                  >
                    {isSubmitting ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <>
                        <Send size={16} />
                        Transmit Integrity Report
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
