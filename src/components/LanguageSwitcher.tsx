import React from 'react';
import { motion } from 'motion/react';
import { Globe, Sparkles, Loader2, Check } from 'lucide-react';
import { cn } from '../lib/utils';

export type SupportedLanguage = 'en' | 'sn' | 'nr';

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English (UK/US)', flag: '🇬🇧' },
  { code: 'sn', name: 'Shona', nativeName: 'chiShona', flag: '🇿🇼' },
  { code: 'nr', name: 'Ndebele', nativeName: 'isiNdebele', flag: '🇿🇼' },
];

interface LanguageSwitcherProps {
  currentLanguage: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  isLoading?: boolean;
  className?: string;
}

export default function LanguageSwitcher({
  currentLanguage,
  onLanguageChange,
  isLoading = false,
  className
}: LanguageSwitcherProps) {
  return (
    <div className={cn("bg-white/5 border border-white/10 p-3 sm:p-4 rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden", className)}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(0,242,254,0.15)]">
            <Globe size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white italic uppercase tracking-wider">Select Language</span>
              <span className="px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-[8px] font-black uppercase text-primary tracking-widest flex items-center gap-1 shadow-[0_0_10px_rgba(0,242,254,0.2)]">
                <Sparkles size={10} className="animate-spin-slow" />
                AI Translated
              </span>
            </div>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
              Instant AI Legal Document Translation (Shona • Ndebele • English)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {LANGUAGES.map((lang) => {
            const isActive = currentLanguage === lang.code;
            return (
              <motion.button
                key={lang.code}
                whileTap={{ scale: 0.95 }}
                onClick={() => onLanguageChange(lang.code)}
                disabled={isLoading && isActive}
                className={cn(
                  "flex-1 sm:flex-none px-3 py-2 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 relative group",
                  isActive
                    ? "bg-primary text-black border-primary font-black shadow-[0_0_20px_rgba(0,242,254,0.4)]"
                    : "bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20"
                )}
              >
                <span className="text-sm">{lang.flag}</span>
                <span className="italic">{lang.nativeName}</span>
                {isActive && !isLoading && (
                  <Check size={14} className="text-black stroke-[3]" />
                )}
                {isActive && isLoading && (
                  <Loader2 size={14} className="animate-spin text-black" />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
