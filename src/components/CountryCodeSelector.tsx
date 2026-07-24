import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { COUNTRY_CODES, CountryCode } from '../lib/authUtils';
import { motion, AnimatePresence } from 'motion/react';

interface CountryCodeSelectorProps {
  value: string;
  onChange: (code: string) => void;
  className?: string;
}

export default function CountryCodeSelector({ value, onChange, className = '' }: CountryCodeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCountry = COUNTRY_CODES.find(c => c.code === value) || COUNTRY_CODES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const filteredCountries = COUNTRY_CODES.filter(c => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.flag.includes(q)
    );
  });

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Selector Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-full bg-black/40 border border-white/10 hover:border-primary/50 rounded-2xl px-3 py-3 text-xs text-white font-bold flex items-center justify-between gap-1.5 transition-all shrink-0 cursor-pointer focus:outline-none focus:border-primary"
      >
        <span className="flex items-center gap-1.5">
          <span className="text-base">{selectedCountry.flag}</span>
          <span className="font-mono tracking-tight">{selectedCountry.code}</span>
        </span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
      </button>

      {/* Searchable Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 w-72 max-w-[88vw] bg-[#0c0f17] border border-white/15 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 overflow-hidden flex flex-col"
          >
            {/* Search Input Box */}
            <div className="p-2.5 border-b border-white/10 bg-black/40 sticky top-0 z-10 flex items-center gap-2">
              <Search size={14} className="text-gray-400 shrink-0 ml-1" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country or code (+263)..."
                className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none font-medium py-1"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Country List */}
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
              {filteredCountries.length > 0 ? (
                filteredCountries.map((country, idx) => {
                  const isSelected = country.code === value && (selectedCountry.name === country.name);
                  return (
                    <button
                      key={`${country.code}-${country.name}-${idx}`}
                      type="button"
                      onClick={() => {
                        onChange(country.code);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                        isSelected 
                          ? 'bg-primary/20 text-primary font-bold border border-primary/30' 
                          : 'text-gray-300 hover:bg-white/5 hover:text-white font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <span className="text-base shrink-0">{country.flag}</span>
                        <span className="truncate">{country.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] text-gray-400">{country.code}</span>
                        {isSelected && <Check size={14} className="text-primary" />}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-6 text-center text-xs text-gray-500 italic">
                  No matching country code found
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
