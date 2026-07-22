import React from 'react';
import { motion } from 'motion/react';
import { Shield, ChevronLeft, Mail, Phone, Scale, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermsOfService() {
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
          <span className="text-xs font-black uppercase tracking-widest italic">Return Home</span>
        </motion.button>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-12"
        >
          <header className="space-y-4 border-b border-white/5 pb-12">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 shadow-[0_0_20px_rgba(0,242,254,0.15)]">
              <Shield size={32} />
            </div>
            <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none">
              Terms of <span className="text-primary">Service</span>
            </h1>
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 bg-white/5 rounded border border-white/10 text-[9px] font-black text-gray-500 uppercase tracking-widest">
                Version 1.0.4
              </span>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Last Updated: May 17, 2026</p>
            </div>
          </header>

          <div className="grid gap-12 text-gray-400 font-medium leading-relaxed">
            <section className="space-y-4">
              <p className="text-sm">
                Welcome to <span className="text-white font-bold">Comfort Business Hub</span> ("the Platform"). These Terms of Service ("Terms") govern your access to and use of our web application, tools, and services.
              </p>
              <p className="text-sm">
                By signing up for an account, creating a storefront, or purchasing goods/services through the Platform, you agree to be bound by these Terms. If you do not agree to these Terms, you may not use the Platform.
              </p>
            </section>

            <section className="space-y-4 bg-white/5 p-8 rounded-[2.5rem] border border-white/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 text-primary group-hover:rotate-12 transition-transform">
                <Scale size={80} />
              </div>
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">01.</span> Description of Service
              </h2>
              <p className="text-sm relative z-10 leading-loose">
                The Platform is a business hub and multi-vendor marketplace built to allow users to sign up, create business profiles, establish customizable storefronts, and list products or services for sale. The Platform serves as an intermediary venue connecting sellers ("Sellers") with customers ("Buyers"). We do not sell or possess any products or services listed by third-party Sellers.
              </p>
              <div className="h-px bg-white/10 w-full relative z-10" />
              <p className="text-xs text-gray-500 relative z-10 leading-relaxed italic">
                <span className="text-white font-bold uppercase tracking-wider not-italic">Guest & Anonymous Modes:</span> In addition to full membership, the Platform supports Guest Browsing and Guest Access modes. Anonymous explorers can browse public inventories and share nodes, while user-activated Guest Sessions allow users to register a local temporary identifier and test transactions (e.g., placing inquiries via the "Talk" option or submitting purchase intents via "Order Now" commands) to preview the system seamlessly.
              </p>
            </section>

            <section className="space-y-6">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">02.</span> Account Registration & Security
              </h2>
              <ul className="grid gap-6">
                <li className="flex gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <p className="text-sm"><span className="text-white font-bold">Google Authentication:</span> To access certain features, you must register for an account using your Google Account. You agree to provide and maintain accurate, current, and complete profile information, including your full name, phone number, and profile image.</p>
                </li>
                <li className="flex gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <p className="text-sm"><span className="text-white font-bold">Guest Accounts and Access:</span> Users may opt to transact or inquire under a guest account. Personal information is not explicitly persisted on our central servers for guest access, except where required for conversion logging (e.g. logging active business leads or store metrics for "Talk" and "Order Now" commands) to provide accurate dashboard statistics. Clearing your device's browser cache or logged-out manual dissolution will permanently erase guest tokens and historical access.</p>
                </li>
                <li className="flex gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <p className="text-sm"><span className="text-white font-bold">Account Responsibility:</span> You are entirely responsible for maintaining the confidentiality of your credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.</p>
                </li>
                <li className="flex gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <p className="text-sm"><span className="text-white font-bold">Age Restriction:</span> You must be at least 18 years old, or the legal age of majority in your jurisdiction, to create a storefront and sell goods or services.</p>
                </li>
              </ul>
            </section>

            <section className="space-y-6 bg-white/5 p-8 rounded-[2.5rem] border border-white/10">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">03.</span> Storefronts and Seller Obligations
              </h2>
              <div className="grid gap-6">
                <p className="text-sm italic text-gray-500">Sellers who create storefronts and product/service listings agree to the following conditions:</p>
                <div className="grid gap-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-xs font-bold text-white uppercase mb-1">Accuracy</p>
                    <p className="text-xs">You must provide true, accurate, and up-to-date descriptions, pricing, and images for all listed products or services.</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-xs font-bold text-white uppercase mb-1">Compliance</p>
                    <p className="text-xs">You are solely responsible for ensuring that your products, services, listings, and business operations comply with all applicable local and international laws.</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-xs font-bold text-white uppercase mb-1">Fulfillment</p>
                    <p className="text-xs">Sellers are independently responsible for fulfilling orders, handling shipping/delivery, and addressing customer service requests.</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">04.</span> Fees and Payments
              </h2>
              <div className="grid gap-6">
                <div className="flex gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <p className="text-sm"><span className="text-white font-bold">Transaction Processing:</span> Payment handling and integration with third-party payment gateways (mobile money, local triggers) are subject to the terms of those respective providers.</p>
                </div>
                <div className="flex gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <p className="text-sm"><span className="text-white font-bold">Platform Fees:</span> The Platform reserves the right to charge subscription fees or percentage-based transaction fees. Applicable fees will be disclosed prior to implementation.</p>
                </div>
              </div>
            </section>

            <div className="grid sm:grid-cols-2 gap-6">
              <section className="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/10">
                <h3 className="text-sm font-black text-white uppercase tracking-wider italic">05. Intellectual Property</h3>
                <p className="text-xs leading-relaxed">The web app, design elements, logos, and architecture are exclusive property of Comfort Business Hub. Users grant a license to host uploaded content for the purpose of promoting storefronts.</p>
              </section>
              <section className="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/10">
                <h3 className="text-sm font-black text-white uppercase tracking-wider italic">06. User Conduct</h3>
                <p className="text-xs leading-relaxed">Prohibited: Fraud, scams, malicious code, reverse-engineering, or violating any local or international laws and regulations.</p>
              </section>
            </div>

            <section className="space-y-6 bg-primary/5 p-8 rounded-[2.5rem] border border-primary/10">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">07.</span> Limitation of Liability
              </h2>
              <div className="space-y-4">
                <p className="text-sm font-bold text-white italic">"As-Is" Basis</p>
                <p className="text-sm">The Platform is provided on an "as-is" and "as-available" basis. We make no warranties regarding availability, uptime, or suitability for specific business needs.</p>
                <div className="h-px bg-white/10 w-full" />
                <p className="text-sm">Comfort Business Hub is not a party to any transaction, contract, or dispute between Buyers and Sellers. We do not guarantee quality, safety, or delivery of items.</p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">08.</span> Indemnification
              </h2>
              <p className="text-sm">You agree to indemnify and hold harmless the Platform from any claims, liabilities, or losses arising out of misuse, violation of Terms, or infringement of third-party rights.</p>
            </section>

            <section className="space-y-4 bg-white/5 p-8 rounded-[2.5rem] border border-white/10">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">09.</span> Reporting and Suspension
              </h2>
              <p className="text-sm">We maintain a zero-tolerance policy for abuse, substandard products, misinformation, illegal content, nudity, or content promoting violence. Users are encouraged to report any infractions via the on-platform "Report" tools.</p>
              <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20 mt-4">
                <p className="text-xs font-black text-red-500 uppercase flex items-center gap-2 mb-2">
                   <ShieldAlert size={14} /> Enforcement Protocol
                </p>
                <p className="text-xs text-gray-300 leading-relaxed italic">
                  Any account, storefront, or product reported <span className="text-white font-bold">three (3) times within a single month</span> for verified violations will result in an <span className="text-white font-bold text-red-500">automatic suspension</span> of the responsible account for a duration of two weeks. Repeated violations may result in a permanent ban.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">10.</span> Governing Law
              </h2>
              <p className="text-sm">These Terms are governed by the laws of <span className="text-white font-bold italic underline decoration-primary underline-offset-4">Zimbabwe</span>. Disputes must be resolved in the competent courts located within Zimbabwe.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                <span className="text-primary text-2xl">11.</span> Changes to Terms
              </h2>
              <p className="text-sm">We may modify these Terms from time to time. Continued use of the Platform after changes are posted constitutes binding acceptance of updated Terms.</p>
            </section>

            <section className="mt-12 p-8 bg-gradient-to-br from-[#0d1117] to-[#05070a] rounded-[3rem] border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-8">
              <div className="space-y-2 text-center sm:text-left">
                <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Contact Support</h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Have questions regarding these terms?</p>
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
