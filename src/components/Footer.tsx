import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Mail, Phone, Heart } from 'lucide-react';
import AppLogo from './AppLogo';

export default function Footer() {
  return (
    <footer className="mt-auto py-12 px-6 sm:px-12 bg-[#05070a] border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <AppLogo size="md" />
              <h2 className="text-sm font-black text-white uppercase italic tracking-tighter">Comfort Hub</h2>
            </div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest leading-relaxed">
              Neural Supply Chain & Marketplace Matrix for the Modern Zimbabwe Economy. Establishing secure market nodes.
            </p>
          </div>

          <div className="space-y-6 text-left">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-8">Node Links</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/" className="text-[11px] font-black text-gray-600 uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-2">
                  Market Discovery
                </Link>
              </li>
              <li>
                <Link to="/stores" className="text-[11px] font-black text-gray-600 uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-2">
                  Supplier Hub
                </Link>
              </li>
              <li>
                <Link to="/chat" className="text-[11px] font-black text-gray-600 uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-2">
                  Deal Rooms
                </Link>
              </li>
              <li>
                <button
                  onClick={async () => {
                    const { getAppSharePayload, executeShare } = await import('../lib/shareUtils');
                    const payload = getAppSharePayload();
                    await executeShare(payload);
                  }}
                  className="text-[11px] font-black text-cyan-400 uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2"
                >
                  Share Comfort Hub
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-6 text-left">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-8">Legal Matrix</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/terms" className="text-[11px] font-black text-primary hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-[11px] font-black text-gray-600 uppercase tracking-widest hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-6 text-left">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-8">Communication</h3>
            <div className="space-y-4">
              <a href="mailto:comfort.designszw@gmail.com" className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:text-primary transition-colors">
                <Mail size={14} className="text-primary" />
                Email Support
              </a>
              <a href="tel:+263772824132" className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:text-primary transition-colors">
                <Phone size={14} className="text-primary" />
                Call Support
              </a>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center pt-8 border-t border-white/5 gap-4">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-1.5 flex-wrap justify-center sm:justify-start text-primary drop-shadow-[0_0_8px_#00f2fe]">
            <span>@ 2026 Comfort Business Hub.</span>
            <span>A Neural Architecture made with</span>
            <Heart size={10} className="fill-primary animate-pulse" />
            <span>by Comfort Designs</span>
          </p>
          <div className="flex gap-6">
            <span className="text-[8px] font-black text-neon-green uppercase tracking-[0.2em] flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
              Service Status: Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
