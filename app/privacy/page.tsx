"use client";

import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-[#03070A] text-slate-100 min-h-screen font-sans selection:bg-[#00FF9D] selection:text-black">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#03070A]/85 backdrop-blur-md border-b border-emerald-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-white font-black text-xl">
            <span className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-black font-bold">TS</span>
            TrustShip <span className="text-xs text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/60">Privacy Policy</span>
          </a>
          <a href="/" className="text-xs font-bold text-[#00FF9D] hover:underline">
            ← Back to Home
          </a>
        </div>
      </header>

      {/* Content Section with Clean White Card contrast */}
      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-white text-slate-900 rounded-3xl p-8 sm:p-12 shadow-2xl space-y-8">
          <div className="border-b border-slate-200 pb-6">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Privacy Policy</h1>
            <p className="text-xs text-slate-500 mt-2">Last updated: October 2026</p>
          </div>

          <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900">1. Introduction</h2>
              <p>Welcome to TrustShip. We respect your privacy and are committed to protecting your personal data. This privacy policy informs you how we look after your personal data when you use our WhatsApp-native escrow platform and website.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900">2. Data We Collect</h2>
              <p>When you interact with our WhatsApp bot or platform, we may collect your phone number, display name, transaction details, and payment confirmation metadata processed via Flutterwave.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900">3. How We Secure Your Funds</h2>
              <p>All escrow payments are held securely through our regulated payment partner, Flutterwave. Funds are only released upon verification of unique 4-digit buyer release PINs.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-slate-900">4. Contact Us</h2>
              <p>If you have any questions about this privacy policy, please contact our support desk at <a href="mailto:trustship.app@gmail.com" className="text-emerald-600 font-bold underline">trustship.app@gmail.com</a>.</p>
            </section>
          </div>

          <div className="pt-8 border-t border-slate-200">
            <a href="/" className="inline-block bg-slate-900 text-white text-xs font-bold px-6 py-3 rounded-xl hover:bg-slate-800 transition">
              Return to TrustShip Home
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
