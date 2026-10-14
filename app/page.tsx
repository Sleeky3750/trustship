"use client";

import { useEffect } from "react";

export default function HomePage() {
  useEffect(() => {
    // Billboard auto-plays on mount - no manual steps
    return undefined;
  }, []);

  return (
    <div className="bg-[#030611] text-slate-100 min-h-screen flex flex-col font-sans antialiased">
      <header className="border-b border-slate-800/80 bg-[#070C1E]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-blue-600/20 font-black text-xl tracking-wider">
              TS
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
              TrustShip <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">WHATSAPP ESCROW</span>
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
          🛡️ Secure Transactions in Nigeria
        </div>

        <h1 className="text-5xl sm:text-7xl font-black text-white tracking-tight mb-12">
          Automated Escrow, Right on <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">WhatsApp</span>
        </h1>

        {/* iPhone Billboard Animation - continuous looping WhatsApp chat */}
        <div className="mx-auto w-full max-w-2xl">
          <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-blue-600/30 bg-[#040A14] border border-slate-800/30 mb-16">
            {/* iPhone top notch */}
            <div className="absolute top-0 left-0 right-0 h-14 bg-[#0f172a] border-b border-slate-800/50">
              <div className="absolute top-3 left-4 w-6 h-6 rounded-full bg-red-500 blur-sm border-2 white/20" />
              <div className="absolute top-3 right-4 w-6 h-6 rounded-full bg-green-500 blur-sm border-2 white/20" />
              <div className="absolute top-3 right-10 w-6 h-6 rounded-full bg-yellow-500 blur-sm border-2 white/20" />
            </div>

            {/* Chat messages with continuous looping animation */}
            <div className="p-6 relative space-y-3 max-h-[650px] overflow-y-auto text-sm" aria-label="WhatsApp chat">
              {/* Message 1: Buyer - New Escrow Created */}
              <div className="message-bubble message-buyer message-1 absolute left-0 right-0">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-emerald-400 flex items-center justify-center text-white font-semibold text-xs">B</div>
                  <div>
                    <p className="font-medium text-white">Buyer</p>
                    <p className="mt-1 text-slate-200 line-clamp-3">New Escrow Created! Ref: TS-849201. Item: iPhone 15 Pro (₦850,000).</p>
                  </div>
                </div>
              </div>

              {/* Message 2: Bot - Paystack Secure Link */}
              <div className="message-bubble message-bot message-2 absolute left-0 right-0">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white font-semibold text-xs">T</div>
                  <div>
                    <p className="font-medium text-white">TrustShip Bot</p>
                    <p className="mt-1 text-slate-200 line-clamp-3">Paystack Secure Link generated & sent.</p>
                  </div>
                </div>
              </div>

              {/* Message 3: Buyer - Payment Receipt */}
              <div className="message-bubble message-buyer message-3 absolute left-0 right-0">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-emerald-400 flex items-center justify-center text-white font-semibold text-xs">B</div>
                  <div>
                    <p className="font-medium text-white">Buyer</p>
                    <p className="mt-1 text-slate-200 line-clamp-3">[Sends Paystack Payment Receipt - ₦850,000 Locked 🔒]</p>
                  </div>
                </div>
              </div>

              {/* Message 4: Bot - Funds Secured / PIN Generated */}
              <div className="message-bubble message-bot message-4 absolute left-0 right-0">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white font-semibold text-xs">T</div>
                  <div>
                    <p className="font-medium text-white">TrustShip Bot</p>
                    <p className="mt-1 text-slate-200 line-clamp-3">Funds Secured in Escrow! Buyer Release PIN generated: *4821*.</p>
                  </div>
                </div>
              </div>

              {/* Message 5: Seller - Item Dispatched */}
              <div className="message-bubble message-seller message-5 absolute left-0 right-0">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white font-semibold text-xs">S</div>
                  <div>
                    <p className="font-medium text-white">Seller</p>
                    <p className="mt-1 text-slate-200 line-clamp-3">Item dispatched via waybill. Delivered!</p>
                  </div>
                </div>
              </div>

              {/* Message 6: Buyer - PIN Received */}
              <div className="message-bubble message-buyer message-6 absolute left-0 right-0">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-emerald-400 flex items-center justify-center text-white font-semibold text-xs">B</div>
                  <div>
                    <p className="font-medium text-white">Buyer</p>
                    <p className="mt-1 text-slate-200 line-clamp-3">Received and inspected. Here is my PIN: *4821*.</p>
                  </div>
                </div>
              </div>

              {/* Message 7: Bot - PIN Verified & Payout */}
              <div className="message-bubble message-bot message-7 absolute left-0 right-0">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white font-semibold text-xs">T</div>
                  <div>
                    <p className="font-medium text-white">TrustShip Bot</p>
                    <p className="mt-1 text-slate-200 line-clamp-3">✅ PIN Verified! Instant payout of ₦850,000 transferred to Seller via Paystack.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Signal / connectivity indicator at bottom */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 border-b border-slate-800/50">
              <div className="flex h-1.5 items-center gap-1">
                <div></div>
                <div></div>
                <div></div>
              </div>
            </div>
          </div>
        </div>

        {/* Subtle CTA below billboard */}
        <div className="mt-12 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
          Live demo - escrow on WhatsApp
        </div>
      </main>

      <footer className="border-t border-slate-800/80 bg-[#070C1E]/50 py-6 text-center text-xs text-slate-500">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mx-auto max-w-4xl px-4">
          <div>
            <p className="font-bold text-blue-400 text-sm mb-2">TrustShip Escrow Technologies</p>
            <p className="text-slate-500">Zero Registration • WhatsApp Native • Paystack Secured • 4-digit PIN protection</p>
          </div>
          <div className="text-slate-500 space-y-1">
            <p className="font-semibold text-slate-400">Integrations</p>
            <div><a href="/terms" className="hover:underline">Terms of Service</a></div>
            <div><a href="/terms" className="hover:underline">Privacy Policy</a></div>
          </div>
          <div className="text-slate-500 space-y-1">
            <p className="font-semibold text-slate-400">Support</p>
            <div><a href="mailto:trustship.app@gmail.com" className="hover:underline">Support Desk</a></div>
          </div>
          <div>
            <p className="text-slate-500">© {new Date().getFullYear()} TrustShip Escrow Technologies</p>
          </div>
        </div>
      </footer>
    </div>
  );
}