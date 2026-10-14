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

export default function HomePage() {
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);

  const demoMessages = [
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
      setActiveMessageIndex((prev) => (prev + 1) % demoMessages.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [demoMessages.length]);

  return (
    <div className="bg-[#030611] text-slate-100 min-h-screen flex flex-col font-sans selection:bg-blue-500 selection:text-white overflow-x-hidden relative">
      
      {/* Background Glow */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30">
        <div className="absolute top-0 left-0 w-full h-full bg-[#030611]"></div>
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[160px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[160px]"></div>
      </div>

      {/* 1. HEADER */}
      <header className="relative z-50 border-b border-slate-800/80 bg-[#070C1E]/90 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-emerald-400 flex items-center justify-center text-white shadow-xl shadow-blue-600/30 font-black text-2xl tracking-wider">
              TS
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-white">TrustShip</span>
              <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Secure Native Commerce</span>
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
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Chat on WhatsApp
            </a>
            <button className="bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition">
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 text-center lg:text-left grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        <div className="lg:col-span-7 space-y-8 relative">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Secure Buying & Selling, Powered by WhatsApp
          </div>

          <h1 className="text-5xl sm:text-7xl font-black text-white tracking-tight leading-[1.05]">
            Buy & Sell with<br />Confidence on<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">TrustShip</span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl font-normal lg:mx-0 mx-auto">
            TrustShip is a WhatsApp-integrated escrow service that keeps your money safe, your transactions secure, and your mind at ease. We hold the payment, verify the deal, and only release funds when you're 100% satisfied.
          </p>

          <div className="pt-4 flex flex-wrap items-center gap-4 lg:justify-start justify-center">
            <button className="bg-gradient-to-r from-emerald-600 to-blue-500 hover:from-emerald-500 hover:to-blue-400 text-white font-bold px-10 py-4 rounded-3xl text-lg shadow-xl shadow-emerald-600/25 transition">
              Start on WhatsApp
            </button>
            <a href="#how-it-works" className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold px-8 py-4 rounded-3xl border border-slate-700 transition flex items-center gap-3">
              <span>▶ How It Works</span>
            </a>
          </div>
        </div>

        {/* Right Column: Phone Mockup */}
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
      <section className="relative z-10 border-t border-b border-slate-800/80 bg-[#070C1E]/50 mb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-400 font-medium text-center md:text-left">
          <div className="flex items-center gap-3 justify-center md:justify-start">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            Powered by Paystack Secure Payments
          </div>
          <div className="flex items-center gap-3 justify-center">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            WhatsApp API Seamless Communication
          </div>
          <div className="flex items-center gap-3 justify-center md:justify-end">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            100% Scam Protection Your Safety, Our Priority
          </div>
        </div>
      </section>

      {/* 3. WHY YOU NEED TRUSTSHIP */}
      <section id="why-trust-us" className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mb-20">
        <div className="lg:col-span-5 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-wide">
            THE TRUSTSHIP ADVANTAGE
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            Why You Need<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">TrustShip</span>
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Online transactions are convenient, but they can be risky. <strong className="text-white">TrustShip removes the fear of scams</strong> by acting as a trusted middleman. Whether you're buying or selling, we make sure both sides are protected — every step of the way.
          </p>
          <button className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white font-bold px-8 py-3.5 rounded-2xl text-sm transition">
            Get Started on WhatsApp
          </button>
        </div>

        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-[#070C1E] border border-slate-800 space-y-2 text-left">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-lg font-bold">🛡️</div>
            <h3 className="font-bold text-white text-base">Eliminate Scam Risks</h3>
            <p className="text-slate-400 text-xs leading-relaxed">No more fake buyers, fake sellers, or "send first" scammers. Your funds are protected.</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#070C1E] border border-slate-800 space-y-2 text-left">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg font-bold">🔒</div>
            <h3 className="font-bold text-white text-base">Secure Payments</h3>
            <p className="text-slate-400 text-xs leading-relaxed">Powered by Paystack, we ensure your money is safe and only released when you confirm delivery.</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#070C1E] border border-slate-800 space-y-2 text-left">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg font-bold">📱</div>
            <h3 className="font-bold text-white text-base">WhatsApp Integration</h3>
            <p className="text-slate-400 text-xs leading-relaxed">No need to download another app. Just use WhatsApp — the platform you already trust.</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#070C1E] border border-slate-800 space-y-2 text-left">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-lg font-bold">🤝</div>
            <h3 className="font-bold text-white text-base">Build Trust</h3>
            <p className="text-slate-400 text-xs leading-relaxed">Verified users and transparent processes create safer, more reliable transactions.</p>
          </div>
        </div>
      </section>

      {/* 4. HOW TRUSTSHIP WORKS */}
      <section id="how-it-works" className="relative z-10 border-t border-slate-800/80 bg-[#050A18] py-16 mb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold tracking-wide">
              SIMPLE. SECURE. SEAMLESS.
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
              How TrustShip Works
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              A 4-step process designed to keep you safe.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-left">
            <div className="p-6 rounded-2xl bg-[#070C1E] border border-slate-800 space-y-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-sm">1</div>
              <h3 className="font-bold text-white text-base">Start on WhatsApp</h3>
              <p className="text-slate-400 text-xs leading-relaxed">Chat with our TrustShip bot and tell us what you're buying or selling.</p>
            </div>

            <div className="p-6 rounded-2xl bg-[#070C1E] border border-slate-800 space-y-3">
              <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-sm">2</div>
              <h3 className="font-bold text-white text-base">Pay via Paystack</h3>
              <p className="text-slate-400 text-xs leading-relaxed">You make the payment, which is securely held in escrow via Paystack.</p>
            </div>

            <div className="p-6 rounded-2xl bg-[#070C1E] border border-slate-800 space-y-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-sm">3</div>
              <h3 className="font-bold text-white text-base">Confirm Delivery</h3>
              <p className="text-slate-400 text-xs leading-relaxed">Once you receive the item and confirm it's as described, we release payment.</p>
            </div>

            <div className="p-6 rounded-2xl bg-[#070C1E] border border-slate-800 space-y-3">
              <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-sm">4</div>
              <h3 className="font-bold text-white text-base">Transaction Complete</h3>
              <p className="text-slate-400 text-xs leading-relaxed">The seller gets paid, and you're protected. Simple as that!</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. YOUR SECURITY MATTERS */}
      <section id="security" className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16 mb-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold tracking-wide">
            DON'T BE SCARED. BE SMART.
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            Your Security Matters
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            We know you might be wondering — <em className="text-white font-bold">"Is it really safe?"</em><br />
            Here's why you can trust TrustShip:
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 text-slate-300 text-xs sm:text-sm">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">✓</span>
              We use Paystack, one of Africa's most trusted payment processors.
            </div>
            <div className="flex items-center gap-3 text-slate-300 text-xs sm:text-sm">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">✓</span>
              Our WhatsApp API ensures secure and verified communication.
            </div>
            <div className="flex items-center gap-3 text-slate-300 text-xs sm:text-sm">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">✓</span>
              We never release funds until you confirm you've received your item.
            </div>
            <div className="flex items-center gap-3 text-slate-300 text-xs sm:text-sm">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">✓</span>
              Our team monitors transactions and resolves disputes if needed.
            </div>
          </div>

          <p className="text-emerald-400 font-extrabold italic text-base pt-2">
            Real people. Real protection. Real peace of mind.
          </p>
        </div>

        <div className="lg:col-span-5 flex justify-center">
          <div className="p-8 rounded-3xl bg-gradient-to-br from-[#070C1E] to-[#0b141a] border border-slate-800 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-emerald-400 mx-auto flex items-center justify-center text-white font-black text-2xl shadow-lg">
              TS
            </div>
            <h3 className="text-white font-bold text-xl">TrustShip Escrow</h3>
            <p className="text-slate-400 text-xs">Escrow for a Safer Tomorrow</p>
            <div className="pt-2 flex justify-center gap-4 text-xs text-slate-300">
              <span className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700">🔒 Paystack Secured</span>
              <span className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700">📱 WhatsApp Native</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. WHAT OUR USERS ARE SAYING */}
      <section id="reviews" className="relative z-10 border-t border-slate-800/80 bg-[#050A18] py-16 mb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
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
              <div key={i} className="p-6 rounded-2xl bg-[#070C1E] border border-slate-800 space-y-4">
                <p className="text-slate-300 text-xs leading-relaxed italic">"{user.quote}"</p>
                <div className="flex items-center gap-3 pt-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-emerald-400 flex items-center justify-center font-bold text-white text-xs">
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

      {/* 7. READY TO BUY OR SELL SAFELY */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 mb-20 text-center">
        <div className="p-10 rounded-3xl bg-gradient-to-r from-blue-900/30 via-[#070C1E] to-emerald-900/30 border border-slate-800 space-y-6">
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Ready to Buy or Sell Safely?
          </h2>
          <p className="text-slate-300 text-sm max-w-xl mx-auto">
            Join thousands of Nigerians using TrustShip for secure, hassle-free transactions.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <button className="bg-gradient-to-r from-emerald-600 to-blue-500 hover:from-emerald-500 hover:to-blue-400 text-white font-bold px-8 py-3.5 rounded-2xl text-sm transition">
              Start on WhatsApp
            </button>
            <a href="#how-it-works" className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-6 py-3.5 rounded-2xl border border-slate-700 text-sm transition">
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* 8. FOOTER WITH SOCIALS */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-[#070C1E] py-10 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 text-left mb-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-400 flex items-center justify-center text-white font-bold text-sm">TS</div>
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
              <a href="https://wa.me/yourwhatsappbot" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition">💬 WhatsApp</a>
              <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition">𝕏 Twitter</a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-pink-400 transition">📸 Instagram</a>
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
