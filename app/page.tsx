"use client";
import { useState, useEffect } from "react";

export default function HomePage() {
  const [showDemo, setShowDemo] = useState(false);
  const [step, setStep] = useState<string>("idle");
  const [pin, setPin] = useState<string>("");
  const [statusMessages, setStatusMessages] = useState<string[]>([]);

  useEffect(() => {
    if (step === "start") {
      setStatusMessages([
        "🛡️ TrustShip Escrow Starting...",
        "📱 Initializing WhatsApp chat...",
        "💰 Generating payment link...",
      ]);
    }
  }, [step]);

  const nextStep = () => {
    setStep((prev) => {
      if (prev === "idle" || prev === "start") return "created";
      if (prev === "created") return "secured";
      if (prev === "secured") return "delivered";
      if (prev === "delivered") return "released";
      return "idle";
    });
  };

  const replayDemo = () => {
    setStep("start");
    setPin("");
    setStatusMessages([
      "🛡️ TrustShip Escrow Starting...",
      "📱 Initializing WhatsApp chat...",
      "💰 Generating payment link...",
    ]);
  };

  const closeDemo = () => {
    setShowDemo(false);
    setStep("idle");
    setPin("");
    setStatusMessages([]);
  };

  const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

  if (step === "created" && !pin) {
    setPin(generatePin());
  }

  return (
    <div className="bg-[#030611] text-slate-100 min-h-screen flex flex-col justify-between font-sans antialiased selection:bg-blue-500 selection:text-white">
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-6 my-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
          🛡️ Secure Transactions in Nigeria
        </div>

        <h1 className="text-5xl sm:text-7xl font-black text-white tracking-tight mb-8">
          Automated Escrow, Right on <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">WhatsApp</span>
        </h1>

        <div className="pt-8 flex flex-col sm:flex-row justify-center gap-3">
          <button
            onClick={() => {
              setShowDemo(true);
              setStep("start");
              setPin("");
              setStatusMessages([
                "🛡️ TrustShip Escrow Starting...",
                "📱 Initializing WhatsApp chat...",
                "💰 Generating payment link...",
              ]);
            }}
            className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-blue-600 text-white px-8 py-4 rounded-3xl text-2xl font-bold shadow-2xl shadow-blue-600/25 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 ring-blue-500/50"
          >
            ⚡ Watch 1-Click Demo
          </button>

          <a
            href="/terms"
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-6 py-4 rounded-3xl border border-slate-700 transition flex items-center justify-center text-lg"
          >
            View Terms & Policy
          </a>
        </div>

        {showDemo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl p-4">
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#070C1E]/90 border border-slate-800/50 rounded-3xl shadow-2xl shadow-blue-600/20 overflow-hidden transform scale-100 transition-transform ease-out text-left" onClick={(e) => e.stopPropagation()}>
              <div className="border-b border-slate-800/60 bg-[#030611] flex items-center justify-between px-6 py-3">
                <div className="flex gap-6 text-xs font-medium text-slate-400">
                  <span>1</span> Creation
                  <span>2</span> Secured
                  <span>3</span> Delivered
                  <span>4</span> Released
                </div>
                <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      step === "released" ? "w-full bg-emerald-500" :
                      step === "delivered" ? "w-3/4 bg-purple-500" :
                      step === "secured" ? "w-1/2 bg-blue-500" :
                      step === "created" ? "w-1/4 bg-emerald-500" : "w-0 bg-blue-600"
                    }`}
                  />
                </div>
              </div>

              <div className="p-6 pt-8 min-h-[220px]">
                {step === "start" && (
                  <div className="space-y-4 text-sm text-slate-400">
                    <p>🛡️ TrustShip Escrow Starting...</p>
                    <p>📱 Initializing WhatsApp chat...</p>
                    <p>💰 Generating payment link...</p>
                  </div>
                )}

                {step === "created" && (
                  <div className="space-y-4 text-slate-300">
                    <p className="font-bold text-green-400">✅ Escrow Created Successfully!</p>
                    <p>📱 TrustShip bot sent: <strong>🛡️ New Escrow Created (Ref: TS-849201, ₦850,000)</strong></p>
                    <p>🔗 <strong>Paystack payment link</strong> sent to buyer's WhatsApp</p>
                    <p>🔢 <strong>4-digit Release PIN:</strong> <span className="font-mono text-emerald-400 font-bold">{pin}</span> - saved for later release</p>
                  </div>
                )}

                {step === "secured" && (
                  <div className="space-y-4 text-slate-300">
                    <p className="font-bold text-blue-400">🔒 Transaction SECURED</p>
                    <p className="mb-2">Funds locked in escrow - payment link confirmed</p>
                    <p className="text-slate-500">💰 4-digit Release PIN: <span className="font-mono text-emerald-400 font-bold">{pin}</span> generated and dispatched</p>
                    <p className="text-slate-500">📦 Item marked for dispatch - waybill tracking activated</p>
                    <p className="text-slate-500">⏳ Awaiting buyer confirmation and item delivery</p>
                  </div>
                )}

                {step === "delivered" && (
                  <div className="space-y-4 text-slate-300">
                    <p className="font-bold text-purple-400">🚚 Waybill status: DELIVERED</p>
                    <p className="mb-2">Item received by buyer - inspection stage</p>
                    <p className="text-slate-500">👁️ Buyer instructed to reply with PIN <span className="font-mono text-amber-400 font-bold">{pin}</span> to release funds</p>
                    <p className="text-slate-500">⏳ Ready for PIN entry to release funds to seller</p>
                  </div>
                )}

                {step === "released" && (
                  <div className="space-y-4 text-slate-300">
                    <p className="font-bold text-emerald-400">✅ Funds successfully released to seller!</p>
                    <p className="mb-2">Seller notified: Payout completed for reference TS-849201</p>
                    <p className="text-slate-500">📊 Transaction complete - trade finished successfully</p>
                    <p className="text-slate-500">💡 Try again: Use <strong>Replay Demo</strong> to restart the full experience</p>
                  </div>
                )}
              </div>

              <div className="mt-8 flex gap-4 justify-center p-6 pt-0">
                {step === "start" && (
                  <button
                    onClick={nextStep}
                    className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 px-6 py-3 rounded-xl text-sm font-semibold transition"
                  >
                    Start Demo →
                  </button>
                )}

                {step === "created" && (
                  <div className="flex gap-2">
                    <button onClick={() => setStep("idle")} className="bg-slate-800 px-4 py-2 rounded text-slate-400">Cancel</button>
                    <button onClick={() => setStep("secured")} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 px-4 py-2 rounded">Mark Payment Received →</button>
                  </div>
                )}

                {step === "secured" && (
                  <div className="flex gap-2">
                    <button onClick={() => setStep("idle")} className="bg-slate-800 px-4 py-2 rounded text-slate-400">Cancel</button>
                    <button onClick={() => setStep("delivered")} className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-4 py-2 rounded">Item Delivered →</button>
                  </div>
                )}

                {step === "delivered" && (
                  <div className="flex gap-2">
                    <button onClick={() => setStep("idle")} className="bg-slate-800 px-4 py-2 rounded text-slate-400">Cancel</button>
                    <button onClick={() => setStep("released")} className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 px-4 py-2 rounded">Release PIN →✅</button>
                  </div>
                )}

                {step === "released" && (
                  <div className="flex gap-2">
                    <button onClick={replayDemo} className="bg-slate-800 px-6 py-3 rounded font-semibold text-white">Replay Demo</button>
                    <button onClick={closeDemo} className="bg-slate-800 px-6 py-3 rounded text-slate-400">Close</button>
                  </div>
                )}
              </div>

              <div className="absolute top-2 right-2">
                <button
                  onClick={closeDemo}
                  className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-sm font-semibold hover:bg-slate-700 transition"
                  aria-label="Close demo">
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}
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
            <div><a href="mailto:support@trustship.io" className="hover:underline">Support Desk</a></div>
          </div>
          <div>
            <p className="text-slate-500">© {new Date().getFullYear()} TrustShip Escrow Technologies</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
