"use client";

import { useState, useEffect } from "react";

export default function HomePage() {
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);

  const messages = [
    { sender: "Buyer", role: "buyer", text: "New Escrow Created! Ref: TS-849201. Item: iPhone 15 Pro (₦850,000)." },
    { sender: "TrustShip Bot", role: "bot", text: "Paystack Secure Link generated & sent." },
    { sender: "Buyer", role: "buyer", text: "[Sends Paystack Payment Receipt - ₦850,000 Locked 🔒]" },
    { sender: "TrustShip Bot", role: "bot", text: "Funds Secured in Escrow! Buyer Release PIN generated: *4821*." },
    { sender: "Seller", role: "seller", text: "Item dispatched via waybill. Delivered!" },
    { sender: "Buyer", role: "buyer", text: "Received and inspected. Here is my PIN: *4821*." },
    { sender: "TrustShip Bot", role: "bot", text: "✅ PIN Verified! Instant payout of ₦850,000 transferred to Seller via Paystack." },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMessageIndex((prev) => (prev + 1) % messages.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="bg-[#030611] text-slate-100 min-h-screen flex flex-col font-sans selection:bg-blue-500 selection:text-white overflow-x-hidden">
      {/* HEADER */}
      <header className="border-b border-slate-800/80 bg-[#070C1E]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-emerald-400 flex items-center justify-center text-white shadow-xl shadow-blue-600/30 font-black text-2xl tracking-wider">
              TS
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                TrustShip
              </span>
              <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold block">
                WhatsApp Escrow Protocol
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/terms"
              className="text-slate-400 hover:text-white text-xs font-semibold transition"
            >
              Terms & Policy
            </a>
            <a
              href="mailto:trustship.app@gmail.com"
              className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 px-4 py-2 rounded-xl text-xs font-bold transition"
            >
              Contact Support
            </a>
          </div>
        </div>
      </header>

      {/* MAIN SPLIT HERO SECTION */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* LEFT COLUMN: Captivating Vision & Copywriting */}
        <div className="lg:col-span-7 space-y-8 text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold tracking-wide shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Zero Registration • Instant WhatsApp Commerce
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.1]">
            Automated Escrow, Right on <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">WhatsApp</span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl font-normal">
            Eliminating vendor scams and buyer friction across Nigeria. TrustShip embeds enterprise-grade escrow directly into your daily chat streams—secured by automated Paystack payouts and 4-digit PIN verification.
          </p>

          {/* Vision Feature Grid */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-[#070C1E]/60 border border-slate-800/80 backdrop-blur-sm space-y-1">
              <p className="text-blue-400 font-bold text-sm">⚡ Zero Friction</p>
              <p className="text-slate-400 text-xs leading-normal">No app downloads or tedious sign-ups. Trade securely straight from WhatsApp.</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#070C1E]/60 border border-slate-800/80 backdrop-blur-sm space-y-1">
              <p className="text-emerald-400 font-bold text-sm">🔒 100% Guaranteed</p>
              <p className="text-slate-400 text-xs leading-normal">Funds stay locked in escrow until the item is delivered and inspected with a PIN.</p>
            </div>
          </div>

          <div className="pt-4 flex flex-wrap items-center gap-4">
            <div className="flex -space-x-2">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-xs border-2 border-[#030611]">NG</div>
              <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white text-xs border-2 border-[#030611]">PS</div>
              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center font-bold text-white text-xs border-2 border-[#030611]">WA</div>
            </div>
            <div className="text-xs text-slate-400">
              <p className="font-bold text-white">Trusted by modern traders</p>
              <p>Powered by Paystack & Meta WhatsApp Cloud API</p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Compact Floating Auto-Playing Animation Widget */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-sm bg-[#0b141a] rounded-3xl border border-slate-800 shadow-2xl shadow-blue-600/25 overflow-hidden text-left relative transform hover:scale-[1.02] transition duration-500">
            
            {/* Glowing Backdrop Ambient */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>

            {/* WhatsApp Header Bar */}
            <div className="bg-[#202c33] px-5 py-3.5 flex items-center gap-3 border-b border-slate-700/50 relative z-10">
              <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-xs shadow-md">
                TS
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-xs">TrustShip Escrow Bot</p>
                <p className="text-emerald-400 text-[10px]">● Live Simulation Active</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
            </div>

            {/* Chat Stream Window */}
            <div className="p-4 space-y-3 min-h-[340px] max-h-[380px] overflow-y-auto flex flex-col justify-end bg-[#0b141a] relative z-10">
              {messages.slice(0, activeMessageIndex + 1).map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col max-w-[90%] p-3 rounded-2xl text-xs transition-all duration-500 animate-fadeIn ${
                    msg.role === "buyer"
                      ? "bg-[#005c4b] text-white self-end rounded-br-none shadow"
                      : msg.role === "seller"
                      ? "bg-[#202c33] text-slate-100 self-start rounded-bl-none shadow border border-slate-700/50"
                      : "bg-[#1f2c34] text-emerald-300 self-start rounded-bl-none shadow border border-emerald-500/20"
                  }`}
                >
                  <span className="text-[9px] font-extrabold uppercase tracking-wider opacity-60 mb-0.5">
                    {msg.sender}
                  </span>
                  <p className="leading-snug">{msg.text}</p>
                </div>
              ))}
            </div>

            {/* Footer input simulation */}
            <div className="bg-[#202c33] px-3.5 py-2.5 flex items-center gap-2 border-t border-slate-700/50 text-[11px] text-slate-400 relative z-10">
              <span className="bg-[#2a3942] px-3 py-1.5 rounded-lg flex-1 text-slate-300 font-mono truncate">
                🔒 Secure WhatsApp Escrow active...
              </span>
              <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                ➤
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/80 bg-[#070C1E]/50 py-8 text-center text-xs text-slate-500">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-left">
          <div className="space-y-2">
            <p className="font-bold text-white text-sm">TrustShip Escrow Technologies</p>
            <p className="text-slate-400 text-xs">Zero Registration • WhatsApp Native • Paystack Secured • 4-digit PIN protection</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-400">Integrations</p>
            <div><a href="/terms" className="hover:text-white transition">Terms of Service</a></div>
            <div><a href="/terms" className="hover:text-white transition">Privacy Policy</a></div>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-400">Support Desk</p>
            <div><a href="mailto:trustship.app@gmail.com" className="hover:text-white transition">trustship.app@gmail.com</a></div>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-400">Legal & Copyright</p>
            <p>© {new Date().getFullYear()} TrustShip. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
