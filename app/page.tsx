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
    }, 3000); // Cycles every 3 seconds
    return () => clearInterval(interval);
  }, [messages.length]);

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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
          🛡️ Secure Transactions in Nigeria
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight mb-8">
          Automated Escrow, Right on <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">WhatsApp</span>
        </h1>

        {/* Billboard iPhone WhatsApp Simulation Frame */}
        <div className="mx-auto w-full max-w-xl bg-[#0b141a] rounded-3xl border border-slate-800 shadow-2xl shadow-blue-600/20 overflow-hidden text-left mb-12">
          {/* WhatsApp Header Bar */}
          <div className="bg-[#202c33] px-6 py-4 flex items-center gap-3 border-b border-slate-700/50">
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">
              TS
            </div>
            <div>
              <p className="text-white font-bold text-sm">TrustShip Escrow Bot</p>
              <p className="text-emerald-400 text-xs">Online • WhatsApp Native</p>
            </div>
          </div>

          {/* Chat Stream Window */}
          <div className="p-6 space-y-4 min-h-[320px] max-h-[400px] overflow-y-auto flex flex-col justify-end bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0b141a] to-[#0b141a]">
            {messages.slice(0, activeMessageIndex + 1).map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col max-w-[85%] p-3.5 rounded-2xl text-sm transition-all duration-500 animate-fadeIn ${
                  msg.role === "buyer"
                    ? "bg-[#005c4b] text-white self-end rounded-br-none shadow-md"
                    : msg.role === "seller"
                    ? "bg-[#202c33] text-slate-100 self-start rounded-bl-none shadow-md border border-slate-700/50"
                    : "bg-[#1f2c34] text-emerald-300 self-start rounded-bl-none shadow-md border border-emerald-500/20"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">
                  {msg.sender}
                </span>
                <p className="leading-relaxed">{msg.text}</p>
              </div>
            ))}
          </div>

          {/* Footer input simulation */}
          <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3 border-t border-slate-700/50 text-slate-400 text-xs">
            <span className="bg-[#2a3942] px-3 py-2 rounded-xl flex-1 text-slate-300 font-mono">
              🔒 Type message or send 4-digit PIN...
            </span>
            <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold">
              ➤
            </div>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
          Live billboard animation - loops automatically
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
