import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Compass, Search, Heart, UserPlus, Share2, ShieldAlert, Zap, 
  MessageSquare, ShoppingBag, Store as StoreIcon, ShieldCheck, Phone, 
  ChevronRight, ChevronLeft, Check, Sparkles, Bell, HelpCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

interface TutorialStep {
  id: string;
  badge: string;
  title: string;
  description: string;
  icon: React.ElementType;
  highlights: {
    icon: React.ElementType;
    title: string;
    detail: string;
  }[];
  tip: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    badge: 'Step 1 of 7 • Hub Architecture',
    title: 'Welcome to Comfort Business Hub',
    description: 'A high-performance B2B & B2C marketplace ecosystem built for verified suppliers, merchants, and customers. Here is how to navigate and make the most of your experience.',
    icon: Compass,
    highlights: [
      {
        icon: StoreIcon,
        title: 'Verified Storefront Nodes',
        detail: 'Discover verified suppliers, examine customer ratings, and browse active inventory in real time.'
      },
      {
        icon: ShieldCheck,
        title: 'Trusted Security',
        detail: 'Protected by Biometric Passcode lock (Face ID / Touch ID) and direct encrypted comms.'
      }
    ],
    tip: 'Pro Tip: Install Comfort Business Hub as a PWA on your home screen for instant offline access and background push alerts.'
  },
  {
    id: 'discovery',
    badge: 'Step 2 of 7 • Navigation & Discovery',
    title: 'Explore & Discover Products',
    description: 'Use the top Navigation bar and filters to quickly find products, services, and verified business nodes across all market sectors.',
    icon: Search,
    highlights: [
      {
        icon: Search,
        title: 'Instant Search & Filters',
        detail: 'Filter by category (Electronics, Apparel, Agriculture, Food, Services) or keyword.'
      },
      {
        icon: Zap,
        title: 'Grid & Interactive Map View',
        detail: 'Toggle between clean product card view and interactive GPS node location maps.'
      }
    ],
    tip: 'Click any Verified Storefront badge to view their complete profile, location coordinates, and owner details.'
  },
  {
    id: 'engagement',
    badge: 'Step 3 of 7 • Engagement Icons',
    title: 'Social & Business Uplinks',
    description: 'Build your network using direct engagement buttons rendered on every store and product card:',
    icon: Heart,
    highlights: [
      {
        icon: Heart,
        title: 'Like (Heart)',
        detail: 'Express interest and save items to your personal liked list for quick access.'
      },
      {
        icon: UserPlus,
        title: 'Connect & Follow (User Plus)',
        detail: 'Send connection requests to establish trusted business partner status and follow feeds.'
      },
      {
        icon: Share2,
        title: 'Share (Share Link)',
        detail: 'Instantly share storefront or product links via WhatsApp, SMS, or copy link.'
      },
      {
        icon: ShieldAlert,
        title: 'Report (Shield Alert)',
        detail: 'Report suspicious listings or fraud directly to system administrators for fast review.'
      }
    ],
    tip: 'Use the "Talk" button on any product card to open a direct real-time chat with the supplier.'
  },
  {
    id: 'deals',
    badge: 'Step 4 of 7 • Orders & Markets',
    title: 'Deal Room & Financial Uplinks',
    description: 'Manage active purchases, negotiate custom price quotes, and finalize orders with flexible payment protocols.',
    icon: ShoppingBag,
    highlights: [
      {
        icon: Phone,
        title: 'EcoCash USSD Direct',
        detail: 'Dial official supplier EcoCash merchant shortcodes directly from your mobile device.'
      },
      {
        icon: Zap,
        title: 'Pay On Delivery (POD)',
        detail: 'Order items with pay-on-delivery agreement and automatic address transmission.'
      }
    ],
    tip: 'Check the "Markets / Deals" tab in the bottom bar to track active deal status and order delivery logs.'
  },
  {
    id: 'comms',
    badge: 'Step 5 of 7 • Real-Time Chat',
    title: 'Encrypted Comms & Attachments',
    description: 'Chat directly with suppliers and clients in the Comms section with rich attachment support.',
    icon: MessageSquare,
    highlights: [
      {
        icon: MessageSquare,
        title: 'Rich Media Sharing',
        detail: 'Send image photos, document files, exact GPS location pins, and contact cards.'
      },
      {
        icon: Bell,
        title: 'Push Alerts',
        detail: 'Receive instant notifications when new messages, deals, or connection approvals arrive.'
      }
    ],
    tip: 'All chat conversations are synchronized across your devices and work offline when connection is lost.'
  },
  {
    id: 'supplier',
    badge: 'Step 6 of 7 • Supplier Reminders',
    title: 'Supplier Storefront & Weekly Reminders',
    description: 'Are you a seller or supplier? Keep your product catalog fresh and discoverable with automated weekly reminders.',
    icon: StoreIcon,
    highlights: [
      {
        icon: Bell,
        title: 'Weekly Discovery Push Alerts',
        detail: 'System sends weekly notifications to update prices, restock items, and maintain top ranking.'
      },
      {
        icon: Sparkles,
        title: 'Verification Badges',
        detail: 'Suppliers with updated listings earn the green Verified Node badge and higher customer trust.'
      }
    ],
    tip: 'Configure your payment gateways (EcoCash/PayPal/Stripe) in your Hub Profile to accept direct customer orders.'
  },
  {
    id: 'security',
    badge: 'Step 7 of 7 • Security & PWA',
    title: 'Biometrics & App Installation',
    description: 'Maximize your app experience with native device integration and zero-trust security.',
    icon: ShieldCheck,
    highlights: [
      {
        icon: ShieldCheck,
        title: 'Biometric Passcode',
        detail: 'Lock your app with Face ID, Touch ID, or 4-digit PIN in your Profile settings.'
      },
      {
        icon: Bell,
        title: 'Custom Push Alert Toggles',
        detail: 'Customize notification channels for messages, deals, social interactions, and reminders.'
      }
    ],
    tip: 'Click "Install App" anytime from the top bar to add Comfort Business Hub to your home screen!'
  }
];

export default function AppTutorialModal({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  const handleFinish = () => {
    if (dontShowAgain) {
      localStorage.setItem('cbh_tutorial_completed', 'true');
    }
    onClose();
  };

  if (!isOpen) return null;

  const step = TUTORIAL_STEPS[currentStep];
  const StepIcon = step.icon;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-xl"
        onClick={onClose}
      />

      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-xl bg-[#0d1117] border border-primary/30 rounded-3xl shadow-[0_0_50px_rgba(0,242,254,0.15)] overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header Bar */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-white/5 flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(0,242,254,0.3)]">
              <Compass size={20} className="animate-spin-slow" />
            </div>
            <div>
              <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">{step.badge}</span>
              <h3 className="text-base sm:text-lg font-black text-white italic uppercase tracking-tighter leading-tight">
                How To Navigate Hub
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-all border border-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="w-full bg-white/5 h-1.5 flex">
          {TUTORIAL_STEPS.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setCurrentStep(idx)}
              className={cn(
                "h-full flex-1 transition-all duration-300 border-r border-[#0d1117] last:border-r-0",
                idx === currentStep ? "bg-primary shadow-[0_0_10px_#00f2fe]" : idx < currentStep ? "bg-primary/40" : "bg-transparent"
              )}
              title={s.title}
            />
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 custom-scrollbar flex-1">
          <div className="flex items-start gap-4 p-4 bg-primary/10 border border-primary/20 rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0 shadow-lg">
              <StepIcon size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-black text-white italic uppercase tracking-tighter">{step.title}</h4>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">{step.description}</p>
            </div>
          </div>

          {/* Highlights List */}
          <div className="space-y-3">
            <h5 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Key Features & Controls</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {step.highlights.map((h, i) => {
                const HIcon = h.icon;
                return (
                  <div key={i} className="p-3.5 bg-white/5 border border-white/5 rounded-2xl space-y-1.5 hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
                        <HIcon size={12} />
                      </div>
                      <span className="text-xs font-black text-white italic uppercase">{h.title}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-normal">{h.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pro Tip Box */}
          <div className="p-4 bg-neon-green/10 border border-neon-green/30 rounded-2xl flex items-start gap-3 text-neon-green">
            <Sparkles size={18} className="shrink-0 mt-0.5" />
            <p className="text-xs font-bold leading-relaxed">{step.tip}</p>
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <div className="p-5 sm:p-6 border-t border-white/10 bg-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-400 hover:text-white transition-colors">
            <input 
              type="checkbox" 
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-white/20 bg-white/5 text-primary focus:ring-primary w-4 h-4"
            />
            Don't show automatically on launch
          </label>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all"
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}

            {currentStep < TUTORIAL_STEPS.length - 1 ? (
              <button
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="px-6 py-2.5 rounded-xl bg-primary text-[#05070a] hover:shadow-[0_0_20px_rgba(0,242,254,0.4)] text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-105"
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-6 py-2.5 rounded-xl bg-neon-green text-[#05070a] hover:shadow-[0_0_20px_rgba(57,255,20,0.4)] text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-105"
              >
                <Check size={16} /> Complete Guide
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
