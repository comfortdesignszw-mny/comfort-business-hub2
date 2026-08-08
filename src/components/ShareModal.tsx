import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Share2, Copy, Check, MessageSquare, ExternalLink, Sparkles, Store, ShoppingBag } from 'lucide-react';
import { SharePayload, updateMetaTags } from '../lib/shareUtils';
import { openWhatsApp, formatCurrency } from '../lib/utils';
import AppLogo from './AppLogo';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: SharePayload | null;
}

export default function ShareModal({ isOpen, onClose, payload }: ShareModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (!isOpen || !payload) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(payload.url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      console.error('Copy link failed:', e);
    }
  };

  const handleCopyText = async () => {
    try {
      const fullMessage = payload.text.includes(payload.url)
        ? payload.text
        : `${payload.text}\n${payload.url}`;
      await navigator.clipboard.writeText(fullMessage);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch (e) {
      console.error('Copy text failed:', e);
    }
  };

  const handleWhatsAppShare = () => {
    const fullMessage = payload.text.includes(payload.url)
      ? payload.text
      : `${payload.text}\n${payload.url}`;
    openWhatsApp('', fullMessage);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: payload.title,
          text: payload.text,
          url: payload.url
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Native share failed:', err);
        }
      }
    }
  };

  const badgeIcon = () => {
    switch (payload.type) {
      case 'product':
        return <ShoppingBag size={14} className="text-cyan-400" />;
      case 'store':
        return <Store size={14} className="text-cyan-400" />;
      default:
        return <Sparkles size={14} className="text-cyan-400" />;
    }
  };

  const badgeTitle = () => {
    switch (payload.type) {
      case 'product':
        return 'Product Share Preview';
      case 'store':
        return 'Storefront Brand Link';
      case 'profile':
        return 'Operator Profile Share';
      default:
        return 'Comfort Business Hub Share';
    }
  };

  return (
    <AnimatePresence>
      <div key="share-modal-wrapper" className="fixed inset-0 z-[500] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          key="share-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-[#05070a]/85 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          key="share-modal-window"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative w-full max-w-md neon-card p-6 space-y-5 bg-[#0d1117] border border-cyan-500/30 rounded-3xl shadow-[0_0_35px_rgba(0,242,254,0.15)] overflow-hidden text-left"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Share2 size={16} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  {badgeTitle()}
                </h3>
                <p className="text-[11px] text-gray-400">Professional Brand Link & URL Preview</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Visual Preview Card */}
          <div className="bg-[#05070a] border border-white/10 rounded-2xl p-3 space-y-3 relative overflow-hidden group">
            <div className="flex items-center gap-2 px-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20 uppercase tracking-wider">
                {badgeIcon()}
                {payload.type.toUpperCase()} PREVIEW
              </span>
              {payload.storeName && (
                <span className="text-[11px] font-semibold text-gray-400 truncate">
                  {payload.storeName}
                </span>
              )}
            </div>

            {/* Media Image Frame */}
            <div className="relative w-full h-44 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
              {payload.imageUrl && !imgError ? (
                <img
                  src={payload.imageUrl}
                  alt={payload.title}
                  className="w-full h-full object-contain filter group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center space-y-2">
                  <AppLogo size="lg" />
                  <span className="text-xs text-gray-400 font-medium">Comfort Business Hub</span>
                </div>
              )}
              {payload.price !== undefined && (
                <div className="absolute bottom-2 right-2 px-3 py-1 bg-[#05070a]/90 backdrop-blur-md rounded-xl border border-cyan-500/40 text-cyan-400 text-xs font-black shadow-lg">
                  {formatCurrency(payload.price, payload.currency || 'USD')}
                </div>
              )}
            </div>

            {/* Title & snippet */}
            <div className="space-y-1 px-1">
              <h4 className="text-sm font-bold text-white line-clamp-1">{payload.title}</h4>
              <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{payload.description}</p>
            </div>
          </div>

          {/* Shareable Link Box */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center justify-between">
              <span>Brand Share URL</span>
              {copiedLink && <span className="text-cyan-400 flex items-center gap-1 font-bold"><Check size={12} /> Link Copied</span>}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={payload.url}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-cyan-300 font-mono truncate focus:outline-none focus:border-cyan-500/50"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
              >
                {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                {copiedLink ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Quick Action Grid */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleWhatsAppShare}
              className="w-full py-2.5 px-3 bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-[0_0_15px_rgba(37,211,102,0.15)]"
            >
              <MessageSquare size={16} />
              Share via WhatsApp
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator ? (
              <button
                onClick={handleNativeShare}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-[0_0_15px_rgba(0,242,254,0.15)]"
              >
                <ExternalLink size={16} />
                System Share
              </button>
            ) : (
              <button
                onClick={handleCopyText}
                className="w-full py-2.5 px-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {copiedText ? <Check size={16} className="text-cyan-400" /> : <Copy size={16} />}
                {copiedText ? 'Snippet Copied' : 'Copy Full Text'}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
