"use client";

import { useState, useEffect } from "react";

const testimonials = [
  {
    quote: "I was scared at first, but TrustShip made the whole process so easy and safe. I got my item and the seller got paid. Highly recommend!",
    name: "Amaka",
    location: "Lagos",
    rating: 5,
  },
  {
    quote: "Best platform for online transactions in Nigeria. I've used it multiple times and it's always smooth and secure.",
    name: "Tunde",
    location: "Abuja",
    rating: 5,
  },
  {
    quote: "The WhatsApp integration is genius! No extra apps, no stress. TrustShip really lives up to its name.",
    name: "Ngozi",
    location: "Port Harcourt",
    rating: 5,
  },
];

// SVG Logos & Icons
const TrustShipShieldLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 5L90 20V45C90 70 70 88 50 95C30 88 10 70 10 45V20L50 5Z" fill="url(#shield_grad)" />
    <path d="M50 12L83 25V45C83 66 66 82 50 88C34 82 17 66 17 45V25L50 12Z" fill="#030611" />
    <path d="M40 35H60V43H52V65H48V43H40V35Z" fill="#10B981" />
    <defs>
      <linearGradient id="shield_grad" x1="10" y1="5" x2="90" y2="95" gradientUnits="userSpaceOnUse">
        <stop stopColor="#34D399" />
        <stop offset="1" stopColor="#059669" />
      </linearGradient>
    </defs>
  </svg>
);

const FlutterwaveBadgeLogo = () => (
  <svg className="w-6 h-6 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 6h18v2H3zm0 5h12v2H3zm0 5h18v2H3z" />
  </svg>
);

const WhatsAppBadgeLogo = () => (
  <svg className="w-6 h-6 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984 0 1.762.459 3.48 1.332 5.001l-1.416 5.169 5.291-1.387c1.467.8 3.117 1.222 4.783 1.223h.004c5.505 0 9.988-4.478 9.989-9.984 0-2.667-1.038-5.175-2.925-7.062a9.923 9.923 0 0 0-7.068-2.944zm5.11 13.916c-.21.593-1.22 1.165-1.688 1.215-.469.05-.922.228-3.084-.627-2.603-1.028-4.286-3.666-4.415-3.84-.13-.174-1.047-1.393-1.047-2.656 0-1.263.66-1.884.896-2.143.235-.26.512-.325.682-.325.17 0 .341.002.49.009.158.007.371-.06.58.441.21.501.716 1.748.778 1.875.062.127.104.276.019.444-.085.168-.128.273-.254.422-.126.149-.265.333-.379.447-.126.126-.258.263-.111.515.147.252.654 1.08 1.403 1.747.964.859 1.777 1.126 2.029 1.252.252.126.399.105.547-.063.148-.168.631-.735.799-.987.168-.252.336-.21.564-.126.228.084 1.448.683 1.699.809.252.126.42.189.482.294.062.105.062.612-.148 1.205z"/>
  </svg>
);

export default function HomePage() {
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);

  const demoMessages = [
    { sender: "Buyer", role: "buyer", text: "New Escrow Created! Ref: TS-849201. Item: iPhone 15 Pro (₦850,000)." },
    { sender: "TrustShip Bot", role: "bot", text: "Flutterwave Secure Link generated & sent." },
    { sender: "Buyer", role: "buyer", text: "[Sends Flutterwave Receipt - ₦850,000 Locked 🔒]" },
    { sender: "TrustShip Bot", role: "bot", text: "Funds Secured in Escrow! Buyer Release PIN generated: *4821*." },
    { sender: "Seller", role: "seller", text: "Item dispatched via waybill. Delivered!" },
    { sender: "Buyer", role: "buyer", text: "Received and inspected. Here is my PIN: *4821*." },
    { sender: "TrustShip Bot", role: "bot", text: "✅ PIN Verified! Instant payout of ₦850,000 transferred to Seller via Flutterwave." },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMessageIndex((prev) => (prev + 1) % demoMessages.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [demoMessages.length]);

  return (
    <div className="bg-[#030611] text-slate-100 min-h-screen flex flex-col font-sans selection:bg-emerald-500 selection:text-white overflow-x-hidden relative">
      
      {/* HEADER */}
      <header className="relative z-50 border-b border-slate-800/80 bg-[#070C1E]/90 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrustShipShieldLogo className="w-11 h-11" />
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1">
                TrustShip
              </span>
              <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">WhatsApp Escrow</span>
            </div>
          </div>
          
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-300">
            <a href="#" className="hover:text-white transition">Home</a>
            <a href="#how-it-works" className="hover:text-white transition">How It Works</a>
            <a href="#why-trust-us" className="hover:text-white transition">Why Trust Us</a>
            <a href="#security" className="hover:text-white transition">Security</a>
            <a href="#reviews" className="hover:text-white transition">Reviews</a>
          </nav>

          <div className="flex items-center gap-3">
            <a href="https://wa.me/yourwhatsappbot" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition">
              <WhatsAppBadgeLogo />
              Chat on WhatsApp
            </a>
            <a href="https://wa.me/yourwhatsappbot" className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-600/20 transition">
              Get Started
            </a>
          </div>
        </div>
      </header>

      {/* 1. HERO SECTION (DARK BACKGROUND) */}
      <section className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 text-center lg:text-left grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        <div className="lg:col-span-7 space-y-8 relative">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Secure Buying & Selling, Powered by WhatsApp.
          </div>

          <h1 className="text-5xl sm:text-7xl font-black text-white tracking-tight leading-[1.05]">
            Buy & Sell with<br />Confidence on<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400">TrustShip</span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl font-normal lg:mx-0 mx-auto">
            TrustShip is a WhatsApp-integrated escrow service that keeps your money safe, your transactions secure, and your mind at ease. Powered by <strong className="text-amber-400">Flutterwave</strong>, we hold the payment, verify the deal, and only release funds when you're 100% satisfied.
          </p>

          <div className="pt-4 flex flex-wrap items-center gap-4 lg:justify-start justify-center">
            <a href="https://wa.me/yourwhatsappbot" className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold px-10 py-4 rounded-3xl text-lg shadow-xl shadow-emerald-600/25 transition">
              Start on WhatsApp
            </a>
            <a href="#how-it-works" className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold px-8 py-4 rounded-3xl border border-slate-700 transition flex items-center gap-3">
              <span>▶ How It Works</span>
            </a>
          </div>

          <div className="pt-4 flex items-center gap-6 lg:justify-start justify-center text-xs text-slate-400">
            <div className="flex items-center gap-2"><span className="text-emerald-400 font-bold">✓</span> No fake payments</div>
            <div className="flex items-center gap-2"><span className="text-emerald-400 font-bold">✓</span> No stolen goods</div>
            <div className="flex items-center gap-2"><span className="text-emerald-400 font-bold">✓</span> 100% Escrow Protection</div>
          </div>
        </div>

        {/* Right Column: Live WhatsApp Simulation Phone */}
        <div className="lg:col-span-5 flex justify-center relative">
          <div className="w-full max-w-xs bg-[#0b141a] rounded-[48px] border-[10px] border-[#1d1d1f] shadow-2xl shadow-emerald-600/20 overflow-hidden text-left relative">
            <div className="bg-[#202c33] px-5 py-4 flex items-center gap-3 border-b border-slate-700/50">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">TS</div>
              <div>
                <p className="text-white font-bold text-sm">TrustShip Escrow Bot</p>
                <p className="text-emerald-400 text-xs">Online • ✅ Verified</p>
              </div>
            </div>

            <div className="p-5 space-y-3 min-h-[320px] max-h-[380px] overflow-y-auto flex flex-col justify-end bg-[#0b141a]">
              {demoMessages.slice(0, activeMessageIndex + 1).map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col max-w-[85%] p-3 rounded-2xl text-[11px] transition-all duration-500 animate-fadeIn ${
                    msg.role === "buyer" ? "bg-[#005c4b] text-white self-end rounded-br-none shadow-md" : "bg-[#1f2c34] text-slate-100 self-start rounded-bl-none shadow-md border border-slate-700/50"
                  }`}
                >
                  <span className="text-[8px] font-bold uppercase tracking-wider opacity-60 mb-1">{msg.sender}</span>
                  <p className="leading-snug">{msg.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="relative z-10 border-t border-b border-slate-800/80 bg-[#070C1E]/50 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-300 font-medium text-center">
          <div className="flex items-center gap-3 justify-center">
            <FlutterwaveBadgeLogo />
            <span>Powered by <strong className="text-amber-400">Flutterwave</strong> Secure Payments</span>
          </div>
          <div className="flex items-center gap-3 justify-center">
            <WhatsAppBadgeLogo />
            <span>WhatsApp API Seamless Communication</span>
          </div>
          <div className="flex items-center gap-3 justify-center">
            <TrustShipShieldLogo className="w-6 h-6" />
            <span>100% Scam Protection Guarantee</span>
          </div>
        </div>
      </section>

      {/* 2. WHY YOU NEED TRUSTSHIP (CLEAN WHITE BACKGROUND SECTION) */}
      <section id="why-trust-us" className="relative z-10 bg-white text-slate-900 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold tracking-wide">
              THE TRUSTSHIP ADVANTAGE
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Why You Need<br /><span className="text-emerald-600">TrustShip</span>
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Online transactions are convenient, but they can be risky. <strong className="text-slate-900">TrustShip removes the fear of scams</strong> by acting as a trusted middleman. Whether you're buying or selling, we make sure both sides are protected — every step of the way.
            </p>
            <a href="https://wa.me/yourwhatsappbot" className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-3.5 rounded-2xl text-sm shadow-lg shadow-emerald-600/20 transition">
              Get Started on WhatsApp
            </a>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-left shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 text-lg font-bold">🛡️</div>
              <h3 className="font-bold text-slate-900 text-base">Eliminate Scam Risks</h3>
              <p className="text-slate-600 text-xs leading-relaxed">No more fake buyers, fake sellers, or "send first" scammers. Your funds are protected.</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-left shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 text-lg font-bold">💳</div>
              <h3 className="font-bold text-slate-900 text-base">Secure Payments</h3>
              <p className="text-slate-600 text-xs leading-relaxed">Powered by Flutterwave, we ensure your money is safe and only released when you confirm delivery.</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-left shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 text-lg font-bold">💬</div>
              <h3 className="font-bold text-slate-900 text-base">WhatsApp Integration</h3>
              <p className="text-slate-600 text-xs leading-relaxed">No need to download another app. Just use WhatsApp — the platform you already trust.</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-left shadow-sm hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 text-lg font-bold">🤝</div>
              <h3 className="font-bold text-slate-900 text-base">Build Trust</h3>
              <p className="text-slate-600 text-xs leading-relaxed">Verified users and transparent processes create safer, more reliable transactions.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW TRUSTSHIP WORKS (DARK BACKGROUND) */}
      <section id="how-it-works" className="relative z-10 bg-[#030611] py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto text-center space-y-12">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-wide">
              SIMPLE. SECURE. SEAMLESS.
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
              How TrustShip Works
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              A 4-step process designed to keep you safe. You buy. We hold. You're safe.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-left">
            <div className="p-6 rounded-2xl bg-[#070C1E] border border-slate-800 space-y-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-sm">1</div>
              <h3 className="font-bold text-white text-base">Start on WhatsApp</h3>
              <p className="text-slate-400 text-xs leading-relaxed">Chat with our TrustShip bot and tell us what you're buying or selling.</p>
            </div>

            <div className="p-6 rounded-2xl bg-[#070C1E] border border-slate-800 space-y-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-sm">2</div>
              <h3 className="font-bold text-white text-base">Pay via Flutterwave</h3>
              <p className="text-slate-400 text-xs leading-relaxed">You make the payment, which is securely held in escrow via Flutterwave.</p>
            </div>

            <div className="p-6 rounded-2xl bg-[#070C1E] border border-slate-800 space-y-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-sm">3</div>
              <h3 className="font-bold text-white text-base">Confirm Delivery</h3>
              <p className="text-slate-400 text-xs leading-relaxed">Once you receive the item and confirm it's as described, we release payment.</p>
            </div>

            <div className="p-6 rounded-2xl bg-[#070C1E] border border-slate-800 space-y-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center text-sm">4</div>
              <h3 className="font-bold text-white text-base">Transaction Complete</h3>
              <p className="text-slate-400 text-xs leading-relaxed">The seller gets paid, and you're protected. Simple as that!</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. YOUR SECURITY MATTERS (CLEAN WHITE BACKGROUND SECTION) */}
      <section id="security" className="relative z-10 bg-white text-slate-900 py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-700 text-xs font-bold tracking-wide">
              DON'T BE SCARED. BE SMART.
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
              Your Security Matters
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              We know you might be wondering — <em className="text-slate-900 font-bold">"Is it really safe?"</em><br />
              Here's why you can trust TrustShip:
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-slate-700 text-xs sm:text-sm">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">✓</span>
                We use Flutterwave, Africa's premier payment processor.
              </div>
              <div className="flex items-center gap-3 text-slate-700 text-xs sm:text-sm">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">✓</span>
                Our WhatsApp API ensures secure and verified communication.
              </div>
              <div className="flex items-center gap-3 text-slate-700 text-xs sm:text-sm">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">✓</span>
                We never release funds until you confirm you've received your item.
              </div>
              <div className="flex items-center gap-3 text-slate-700 text-xs sm:text-sm">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">✓</span>
                Our team monitors transactions and resolves disputes if needed.
              </div>
            </div>

            <p className="text-emerald-600 font-extrabold italic text-base pt-2">
              Real people. Real protection. Real peace of mind.
            </p>
          </div>

          <div className="lg:col-span-5 flex justify-center">
            <div className="p-8 rounded-3xl bg-slate-900 text-white text-center space-y-4 shadow-2xl border border-slate-800">
              <TrustShipShieldLogo className="w-16 h-16 mx-auto" />
              <h3 className="text-white font-bold text-xl">TrustShip Escrow</h3>
              <p className="text-slate-400 text-xs">Escrow for a Safer Tomorrow</p>
              <div className="pt-2 flex justify-center gap-3 text-xs text-slate-300">
                <span className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 flex items-center gap-1.5">
                  <FlutterwaveBadgeLogo /> Flutterwave Secured
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 flex items-center gap-1.5">
                  <WhatsAppBadgeLogo /> WhatsApp Native
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. WHAT OUR USERS ARE SAYING (DARK BACKGROUND) */}
      <section id="reviews" className="relative z-10 bg-[#030611] py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto text-center space-y-12">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-wide">
              REAL PEOPLE. REAL STORIES.
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
              What Our Users Are Saying
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {testimonials.map((user, i) => (
              <div key={i} className="p-6 rounded-2xl bg-[#070C1E] border border-slate-800 space-y-4 shadow-lg">
                <p className="text-slate-300 text-xs leading-relaxed italic">"{user.quote}"</p>
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-white text-xs">
                    {user.name[0]}
                  </div>
                  <div>
                    <p className="text-white font-bold text-xs">{user.name}, <span className="text-slate-400 font-normal">{user.location}</span></p>
                    <p className="text-amber-400 text-xs">★★★★★</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. READY TO BUY OR SELL SAFELY */}
      <section className="relative z-10 bg-[#050A18] py-16 px-4 sm:px-6 lg:px-8 text-center border-t border-slate-800">
        <div className="max-w-4xl mx-auto p-10 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-[#070C1E] to-teal-950/40 border border-slate-800 space-y-6 shadow-2xl">
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Ready to Buy or Sell Safely?
          </h2>
          <p className="text-slate-300 text-sm max-w-xl mx-auto">
            Join thousands of Nigerians using TrustShip for secure, hassle-free transactions.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <a href="https://wa.me/yourwhatsappbot" className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold px-8 py-3.5 rounded-2xl text-sm transition shadow-lg shadow-emerald-600/20">
              Start on WhatsApp
            </a>
            <a href="#how-it-works" className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-6 py-3.5 rounded-2xl border border-slate-700 text-sm transition">
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* 7. FOOTER WITH SOCIALS */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-[#070C1E] py-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 text-left mb-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrustShipShieldLogo className="w-8 h-8" />
              <span className="text-white font-bold text-base">TrustShip</span>
            </div>
            <p className="text-slate-400 text-xs">Safe Transactions. Stronger Communities.</p>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-slate-300">Quick Links</p>
            <div><a href="#" className="hover:text-white transition">Home</a></div>
            <div><a href="#how-it-works" className="hover:text-white transition">How It Works</a></div>
            <div><a href="#why-trust-us" className="hover:text-white transition">Why Trust Us</a></div>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-slate-300">Legal & Support</p>
            <div><a href="/terms" className="hover:text-white transition">Terms of Service</a></div>
            <div><a href="/terms" className="hover:text-white transition">Privacy Policy</a></div>
            <div><a href="mailto:trustship.app@gmail.com" className="hover:text-white transition">trustship.app@gmail.com</a></div>
          </div>

          <div className="space-y-3">
            <p className="font-bold text-slate-300">Follow Our Community</p>
            <div className="flex items-center gap-4 text-base text-slate-400">
              <a href="https://wa.me/yourwhatsappbot" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition" aria-label="WhatsApp">💬 WhatsApp</a>
              <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition" aria-label="Twitter">𝕏 Twitter</a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-pink-400 transition" aria-label="Instagram">📸 Instagram</a>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800/60 pt-6 text-center text-slate-600">
          <p>© {new Date().getFullYear()} TrustShip Escrow Technologies. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}