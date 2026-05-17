import React from 'react';
import { motion } from 'motion/react';
import { Shield, ChevronLeft, Mail, Phone, Lock, Eye, Share2, Database, Trash2, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#05070a] pt-24 pb-20 px-6 sm:px-12">
      <div className="max-w-4xl mx-auto">
        <motion.button 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors mb-8 group"
        >
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest italic">Return to Terminal</span>
        </motion.button>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-12"
        >
          <header className="space-y-4 border-b border-white/5 pb-12">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 shadow-[0_0_20px_rgba(0,242,254,0.15)]">
              <Lock size={32} />
            </div>
            <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none">
              Privacy <span className="text-primary">Policy</span>
            </h1>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 bg-white/5 rounded border border-white/10 text-[9px] font-black text-gray-500 uppercase tracking-widest">
                Data Protocol 1.0.2
              </span>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Last Updated: May 17, 2026</p>
            </div>
          </header>

          <div className="grid gap-12 text-gray-400 font-medium leading-relaxed">
            <section className="space-y-4">
              <p className="text-sm">
                Comfort Business Hub, ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Web Application (the "Platform").
              </p>
              <p className="text-sm">
                By accessing or using the Platform, you agree to the collection and use of information in accordance with this policy.
              </p>
            </section>

            <section className="space-y-6">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">01.</span> Information We Collect
              </h2>
              <p className="text-sm italic text-gray-500">We collect information about you in three ways: information you provide directly, information collected automatically, and information from third-party services.</p>
              
              <div className="grid gap-6">
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                  <h3 className="text-xs font-black text-white uppercase mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    A. Information You Provide to Us
                  </h3>
                  <div className="grid gap-4 text-xs">
                    <p><span className="text-white font-bold">Account and Profile Data:</span> When you sign up and log in using Google Authentication, we receive personal data from Google, which includes your Full Name, Email Address, and Profile Image.</p>
                    <p><span className="text-white font-bold">Storefront and Contact Data:</span> To set up a storefront, list products/services, or complete a profile, you provide us with your Phone Number, business description, and any media uploaded for listings.</p>
                    <p><span className="text-white font-bold">Communication Data:</span> Any information you provide when you contact our support team or send us feedback.</p>
                  </div>
                </div>

                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                  <h3 className="text-xs font-black text-white uppercase mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    B. Information Collected Automatically
                  </h3>
                  <p className="text-xs">
                    <span className="text-white font-bold">Log and Usage Data:</span> When you access the Platform, our servers automatically log standard information, such as IP address, browser type, and page views. We use cookies to maintain your login session.
                  </p>
                </div>

                <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                  <h3 className="text-xs font-black text-white uppercase mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    C. Information from Third-Parties
                  </h3>
                  <p className="text-xs">
                    <span className="text-white font-bold">Google Auth:</span> Google shares your basic profile details with us. 
                    <br/><br/>
                    <span className="text-white font-bold">Payment Gateways:</span> We receive transaction confirmation tokens but do not store full credit card numbers or banking passwords.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-6 bg-white/5 p-8 rounded-[2.5rem] border border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 text-primary group-hover:rotate-12 transition-transform">
                <Eye size={80} />
              </div>
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">02.</span> How We Use Information
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  "Maintain Platform Access",
                  "Facilitate Node Comms",
                  "Improve Service Logic",
                  "Security & Safety Protocols",
                  "Compliance with Law"
                ].map((item, i) => (
                  <div key={i} className="px-4 py-2 bg-white/5 rounded-xl border border-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">03.</span> Sharing Protocol
              </h2>
              <div className="grid gap-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center flex-shrink-0 text-white border border-white/10">
                    <Globe size={18} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider italic">Public Visibility</h3>
                    <p className="text-xs">Your business storefront (Name, Phone, Listings) will be visible to potential buyers in the Zimbabwe marketplace matrix.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center flex-shrink-0 text-white border border-white/10">
                    <Share2 size={18} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider italic">Legal Disclosures</h3>
                    <p className="text-xs">We may disclose information if required by law or to protect the safety/rights of our users or the public.</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4 bg-primary/5 p-8 rounded-[2.5rem] border border-primary/10">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">04.</span> Data Security
              </h2>
              <p className="text-sm">
                We implement industry-standard encryption (HTTPS) to safeguard data. While we use commercially acceptable means to protect information, no method of transmission is 100% secure.
              </p>
            </section>

            <div className="grid sm:grid-cols-2 gap-6">
              <section className="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/10">
                <div className="flex items-center gap-2 text-white">
                  <Database size={16} />
                  <h3 className="text-sm font-black uppercase tracking-wider italic">05. Retention</h3>
                </div>
                <p className="text-xs leading-relaxed">Data is retained as long as your account is active. Deleted account data is anonymized unless required for tax compliance records.</p>
              </section>
              <section className="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/10">
                <div className="flex items-center gap-2 text-white">
                  <Trash2 size={16} />
                  <h3 className="text-sm font-black uppercase tracking-wider italic">06. Your Rights</h3>
                </div>
                <p className="text-xs leading-relaxed">You have the right to access, correct, or request deletion of your personal data through your profile settings.</p>
              </section>
            </div>

            <section className="space-y-6 bg-white/5 p-8 rounded-[2.5rem] border border-white/10">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">07.</span> Children’s Privacy
              </h2>
              <p className="text-sm">
                The Platform is not intended for individuals under 18. We do not knowingly collect personal data from children.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">08.</span> Changes to Policy
              </h2>
              <p className="text-sm">
                We periodically update this policy. Changes are notified via the "Last Updated" date on this page.
              </p>
            </section>

            <section className="mt-12 p-8 bg-gradient-to-br from-[#0d1117] to-[#05070a] rounded-[3rem] border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-8">
              <div className="space-y-2 text-center sm:text-left">
                <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Privacy Support</h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Contact our privacy node</p>
              </div>
              <div className="flex flex-col gap-4">
                <a href="mailto:comfort.designszw@gmail.com" className="flex items-center gap-3 text-xs font-black text-white uppercase tracking-widest hover:text-primary transition-colors">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <Mail size={14} />
                  </div>
                  comfort.designszw@gmail.com
                </a>
                <a href="tel:+263772824132" className="flex items-center gap-3 text-xs font-black text-white uppercase tracking-widest hover:text-primary transition-colors">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <Phone size={14} />
                  </div>
                  +263 772 824 132
                </a>
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
