import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store as StoreIcon, 
  Package, 
  ShoppingBag, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Sparkles, 
  Zap, 
  HelpCircle,
  PlusCircle,
  MessageSquare,
  DollarSign,
  ShieldCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfile } from '../types';

interface SupplierTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
}

interface StepContent {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  bulletPoints: {
    title: string;
    description: string;
    icon: React.ElementType;
  }[];
  tip: string;
}

const SUPPLIER_STEPS: StepContent[] = [
  {
    id: 'create_store',
    badge: 'Step 1 of 3 • Storefront Setup',
    title: 'How to Create Your Store',
    subtitle: 'Establish your brand storefront node on the Comfort Business Hub.',
    icon: StoreIcon,
    iconColor: 'text-primary bg-primary/10 border-primary/30',
    bulletPoints: [
      {
        title: 'Navigate to Hub / Store Setup',
        description: 'Go to your Hub profile or click Stores tab and tap "Create Storefront Node".',
        icon: PlusCircle
      },
      {
        title: 'Business Information',
        description: 'Enter your official Business Name, Category, Description, and Contact Numbers.',
        icon: StoreIcon
      },
      {
        title: 'Configure Payment Gateways',
        description: 'Enable PayPal, EcoCash, Stripe, or Cash on Delivery so customers can pay easily.',
        icon: DollarSign
      }
    ],
    tip: 'Adding a clear business logo, cover photo, and location increases customer trust by 80%!'
  },
  {
    id: 'list_products',
    badge: 'Step 2 of 3 • Catalog Inventory',
    title: 'How to List Products & Services',
    subtitle: 'Upload items or professional services to reach thousands of local buyers.',
    icon: Package,
    iconColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    bulletPoints: [
      {
        title: 'Select Item Type',
        description: 'Choose between "Product" (tangible goods) or "Service" (repairs, consultations).',
        icon: Package
      },
      {
        title: 'High Quality Photos & Pricing',
        description: 'Upload item images, set price (Fixed, Negotiable, or Contact for Price), and pick category.',
        icon: Sparkles
      },
      {
        title: 'Connect Buyer CTA Buttons',
        description: 'Set your preferred action button: Order Now, WhatsApp Direct, or In-App Chat.',
        icon: MessageSquare
      }
    ],
    tip: 'You can also create short 10-second Video Classified Ads for temporary promo deals!'
  },
  {
    id: 'manage_orders',
    badge: 'Step 3 of 3 • Order Processing',
    title: 'How Ordering & Sales Work',
    subtitle: 'Receive customer order requests, issue quotes, and close deals smoothly.',
    icon: ShoppingBag,
    iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    bulletPoints: [
      {
        title: 'Instant Order Notifications',
        description: 'When buyers click "Order Now", you get an instant alert in Comms & Markets.',
        icon: Zap
      },
      {
        title: 'Deal Room & Negotiated Quotes',
        description: 'Communicate with customers in real-time, send custom price quotes, and confirm terms.',
        icon: MessageSquare
      },
      {
        title: 'Status Updates & Delivery',
        description: 'Update deal state from Pending → Accepted → Shipped → Delivered to complete orders.',
        icon: ShieldCheck
      }
    ],
    tip: 'Prompt replies in Comms earn you top ratings and a "Verified Supplier" badge on the platform!'
  }
];

export default function SupplierTutorialModal({ isOpen, onClose, profile }: SupplierTutorialModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const step = SUPPLIER_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === SUPPLIER_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    if (profile?.uid) {
      localStorage.setItem(`supplier_tutorial_dismissed_${profile.uid}`, 'true');
    }
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg bg-[#0d1117] border border-primary/30 rounded-3xl shadow-[0_0_50px_rgba(0,242,254,0.15)] overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Top Banner Accent */}
          <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-emerald-400" />

          {/* Header */}
          <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-2xl border flex items-center justify-center shadow-lg", step.iconColor)}>
                <step.icon size={20} />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-primary block">
                  {step.badge}
                </span>
                <h3 className="text-base font-black text-white italic tracking-wide">
                  {step.title}
                </h3>
              </div>
            </div>

            <button
              onClick={handleComplete}
              className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              title="Close Tutorial"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-5 text-left custom-scrollbar">
            <p className="text-xs text-gray-300 font-medium leading-relaxed">
              {step.subtitle}
            </p>

            {/* Bullet Points */}
            <div className="space-y-3">
              {step.bulletPoints.map((item, idx) => (
                <div 
                  key={idx}
                  className="p-3.5 bg-white/5 border border-white/5 rounded-2xl flex items-start gap-3 hover:border-primary/20 transition-all"
                >
                  <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <item.icon size={16} />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-white">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-gray-400 font-medium leading-snug">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pro Tip Box */}
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-amber-300 text-[11px] font-medium leading-snug">
              <Sparkles size={18} className="shrink-0 text-amber-400" />
              <span>{step.tip}</span>
            </div>
          </div>

          {/* Footer controls */}
          <div className="p-5 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-3">
            {/* Step indicators */}
            <div className="flex items-center gap-1.5">
              {SUPPLIER_STEPS.map((_, idx) => (
                <div
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={cn(
                    "h-2 rounded-full transition-all cursor-pointer",
                    idx === currentStep ? "w-6 bg-primary" : "w-2 bg-white/20 hover:bg-white/40"
                  )}
                />
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-gray-300 uppercase tracking-wider hover:bg-white/10 transition-all flex items-center gap-1"
                >
                  <ChevronLeft size={16} /> Back
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-xs font-black text-black uppercase tracking-wider hover:opacity-90 transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,242,254,0.3)]"
              >
                {isLastStep ? (
                  <>
                    <Check size={16} /> OK, Got It!
                  </>
                ) : (
                  <>
                    Next <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
