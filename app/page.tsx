import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  CheckCircle2, 
  Lock, 
  MessageSquare, 
  Package, 
  ChevronRight, 
  Star, 
  ArrowRight, 
  Smartphone, 
  Zap, 
  Users, 
  HelpCircle,
  Menu,
  X
} from 'lucide-react';

// ==========================================
// EXACT BRAND SVG LOGOS & ASSETS
// ==========================================

// TrustShip Shield Logo with Stylized 'T' (Exact Match to image_3.png)
const TrustShipLogo = ({ className = "w-10 h-10", showText = true, showSlogan = false }) => (
  <div className="flex items-center gap-3 select-none">
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg viewBox="0 0 200 230" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-[0_0_15px_rgba(0,223,137,0.3)]">
        <defs>
          <linearGradient id="tsShieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00FF9D" />
            <stop offset="50%" stopColor="#00C875" />
            <stop offset="100%" stopColor="#007A45" />
          </linearGradient>
          <linearGradient id="tsTGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#D0FFE9" />
          </linearGradient>
        </defs>
        {/* Shield Outer Path */}
        <path 
          d="M100 10 L185 45 C185 130 150 190 100 220 C50 190 15 130 15 45 Z" 
          fill="url(#tsShieldGrad)" 
        />
        {/* Shield Inner Dark Inset */}
        <path 
          d="M100 24 L170 54 C170 125 140 175 100 202 C60 175 30 125 30 54 Z" 
          fill="#041810" 
          opacity="0.85"
        />
        {/* Stylized T Mark */}
        <path 
          d="M55 62 H145 V85 H112 V162 L100 175 L88 162 V85 H55 Z" 
          fill="url(#tsTGrad)" 
        />
      </svg>
    </div>

    {showText && (
      <div className="flex flex-col">
        <div className="flex items-center">
          <span className="text-2xl font-black text-white tracking-tight font-sans">Trust</span>
          <span className="text-2xl font-black text-[#00FF9D] tracking-tight relative font-sans">
            Ship
            {/* Small WhatsApp Bubble on the 'p' (matching image_3.png) */}
            <span className="absolute -top-1 -right-3.5 bg-[#25D366] text-white rounded-full p-[2px] shadow-sm">
              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984 0 1.762.459 3.48 1.332 5.001l-1.416 5.169 5.291-1.387c1.467.8 3.117 1.222 4.783 1.223h.004c5.505 0 9.988-4.478 9.989-9.984 0-2.667-1.038-5.175-2.925-7.062a9.923 9.923 0 0 0-7.068-2.944zm5.11 13.916c-.21.593-1.22 1.165-1.688 1.215-.469.05-.922.228-3.084-.627-2.603-1.028-4.286-3.666-4.415-3.84-.13-.174-1.047-1.393-1.047-2.656 0-1.263.66-1.884.896-2.143.235-.26.512-.325.682-.325.17 0 .341.002.49.009.158.007.371-.06.58.441.21.501.716 1.748.778 1.875.062.127.104.276.019.444-.085.168-.128.273-.254.422-.126.149-.265.333-.379.447-.126.126-.258.263-.111.515.147.252.654 1.08 1.403 1.747.964.859 1.777 1.126 2.029 1.252.252.126.399.105.547-.063.148-.168.631-.735.799-.987.168-.252.336-.21.564-.126.228.084 1.448.683 1.699.809.252.126.42.189.482.294.062.105.062.612-.148 1.205z"/>
              </svg>
            </span>
          </span>
        </div>
        {showSlogan && (
          <p className="text-[10px] text-slate-300 font-medium tracking-widest uppercase mt-0.5">
            Buy & Sell <span className="text-[#00FF9D] mx-1">•</span> Safe & Sure
          </p>
        )}
      </div>
    )}
  </div>
);

// Official Flutterwave SVG Mark & Text Logo
const FlutterwaveLogo = ({ className = "w-5 h-5", showWordmark = true }) => (
  <div className="flex items-center gap-2">
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 20 H90 L50 90 Z" fill="#FB923C" opacity="0.2" />
      <path d="M20 25 C35 25, 45 45, 60 45 C75 45, 85 25, 95 25 C85 65, 60 85, 20 25 Z" fill="#F97316" />
      <path d="M5 35 C25 35, 35 60, 55 60 C75 60, 80 40, 95 40 C75 80, 45 85, 5 35 Z" fill="#FBBF24" />
    </svg>
    {showWordmark && (
      <span className="font-extrabold tracking-tight text-white text-sm font-sans">
        flutterwave
      </span>
    )}
  </div>
);

// Official WhatsApp Vector Logo
const WhatsAppIcon = ({ className = "w-5 h-5" }) => (
  <svg className={`${className} fill-current text-[#25D366]`} viewBox="0 0 24 24">
    <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984 0 1.762.459 3.48 1.332 5.001l-1.416 5.169 5.291-1.387c1.467.8 3.117 1.222 4.783 1.223h.004c5.505 0 9.988-4.478 9.989-9.984 0-2.667-1.038-5.175-2.925-7.062a9.923 9.923 0 0 0-7.068-2.944zm5.11 13.916c-.21.593-1.22 1.165-1.688 1.215-.469.05-.922.228-3.084-.627-2.603-1.028-4.286-3.666-4.415-3.84-.13-.174-1.047-1.393-1.047-2.656 0-1.263.66-1.884.896-2.143.235-.26.512-.325.682-.325.17 0 .341.002.49.009.158.007.371-.06.58.441.21.501.716 1.748.778 1.875.062.127.104.276.019.444-.085.168-.128.273-.254.422-.126.149-.265.333-.379.447-.126.126-.258.263-.111.515.147.252.654 1.08 1.403 1.747.964.859 1.777 1.126 2.029 1.252.252.126.399.105.547-.063.148-.168.631-.735.799-.987.168-.252.336-.21.564-.126.228.084 1.448.683 1.699.809.252.126.42.189.482.294.062.105.062.612-.148 1.205z"/>
  </svg>
);

// Curved Sketch Arrow Annotation SVG
const CurvedArrowAnnotation = ({ text = "You buy. We hold. You're safe." }) => (
  <div className="relative inline-flex flex-col items-center select-none pointer-events-none">
    <span className="font-serif italic text-[#00FF9D] text-lg font-bold tracking-wide -rotate-6 transform drop-shadow-[0_2px_8px_rgba(0,255,157,0.4)]">
      {text}
    </span>
    <svg className="w-20 h-10 text-[#00FF9D] mt-1 -rotate-12" viewBox="0 0 100 50" fill="none">
      <path 
        d="M10,10 Q50,45 85,20" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        fill="none" 
        strokeDasharray="4 2"
      />
      <path 
        d="M75,25 L87,19 L82,10" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  </div>
);

// MAIN APP COMPONENT
export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatStep, setChatStep] = useState(0);

  // Dynamic Chat Simulation Data
  const chatMessages = [
    { type: 'bot', text: '👋 Welcome to TrustShip Escrow! What transaction are you initializing today?' },
    { type: 'buyer', text: 'I am paying N350,000 for a MacBook Air M1 from @SellerGamer' },
    { type: 'bot', text: '🔒 TrustShip Escrow Link Generated! Payment held safely via Flutterwave.' },
    { type: 'seller', text: 'Package dispatched via Courier! Tracking Ref: #TS-9921' },
    { type: 'buyer', text: 'Item received & verified! Releasing funds now.' },
    { type: 'bot', text: '✅ PIN Verified! N350,000 released instantly to Seller.' }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setChatStep((prev) => (prev + 1) % chatMessages.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-[#03070A] text-slate-100 min-h-screen font-sans selection:bg-[#00FF9D] selection:text-black overflow-x-hidden relative">
      
      {/* Background Radial Glow Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-[#00FF9D]/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-[#00B368]/10 rounded-full blur-[160px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-[#051F14]/40 rounded-full blur-[180px]" />
      </div>

      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-50 bg-[#03070A]/85 backdrop-blur-md border-b border-emerald-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          <a href="#" className="hover:opacity-90 transition">
            <TrustShipLogo className="w-10 h-10" showText={true} showSlogan={true} />
          </a>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#how-it-works" className="hover:text-[#00FF9D] transition">How It Works</a>
            <a href="#why-trust-us" className="hover:text-[#00FF9D] transition">Why Trust Us</a>
            <a href="#security" className="hover:text-[#00FF9D] transition">Security</a>
            <a href="#reviews" className="hover:text-[#00FF9D] transition">Reviews</a>
            <a href="#faqs" className="hover:text-[#00FF9D] transition">FAQs</a>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <a 
              href="https://wa.me/" 
              target="_blank" 
              rel="noreferrer" 
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 border border-emerald-800/40 hover:bg-emerald-950/30 transition"
            >
              <WhatsAppIcon className="w-4 h-4" />
              Chat on WhatsApp
            </a>
            <a 
              href="https://wa.me/" 
              className="bg-[#00FF9D] hover:bg-[#00E08A] text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-[#00FF9D]/20 transition flex items-center gap-1.5"
            >
              Get Started
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          <button 
            className="md:hidden p-2 text-slate-300 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#06120D] border-b border-emerald-900/40 px-4 py-6 space-y-4">
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 hover:text-[#00FF9D]">How It Works</a>
            <a href="#why-trust-us" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 hover:text-[#00FF9D]">Why Trust Us</a>
            <a href="#security" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 hover:text-[#00FF9D]">Security</a>
            <a href="#reviews" onClick={() => setMobileMenuOpen(false)} className="block text-slate-300 hover:text-[#00FF9D]">Reviews</a>
            <div className="pt-4 flex flex-col gap-3">
              <a href="https://wa.me/" className="w-full text-center py-3 rounded-xl border border-emerald-700/50 text-slate-200 flex items-center justify-center gap-2 text-sm font-semibold">
                <WhatsAppIcon className="w-4 h-4" /> Chat on WhatsApp
              </a>
              <a href="https://wa.me/" className="w-full text-center py-3 rounded-xl bg-[#00FF9D] text-black font-bold text-sm">
                Get Started
              </a>
            </div>
          </div>
        )}
      </header>

      {/* ================= HERO SECTION (DARK) ================= */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20 lg:pt-20 lg:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
            
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-950/80 border border-[#00FF9D]/30 text-[#00FF9D] text-xs font-bold tracking-wide shadow-inner">
              <span className="w-2 h-2 rounded-full bg-[#00FF9D] animate-ping" />
              100% SECURE NATIVE WHATSAPP ESCROW
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.08]">
              Buy & Sell with <br className="hidden sm:inline" />
              Confidence on <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF9D] via-[#00D278] to-emerald-400">
                TrustShip
              </span>
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto lg:mx-0 font-normal">
              TrustShip is a WhatsApp-integrated escrow service that keeps your money safe, your transactions secure, and your mind at ease. Powered by <strong className="text-white underline decoration-[#00FF9D]">Flutterwave</strong>, we hold payment until you verify receipt.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <a 
                href="https://wa.me/" 
                className="w-full sm:w-auto bg-[#00FF9D] hover:bg-[#00E08A] text-slate-950 font-black px-8 py-4 rounded-2xl text-base shadow-xl shadow-[#00FF9D]/20 transition flex items-center justify-center gap-3"
              >
                <WhatsAppIcon className="w-5 h-5 text-black" />
                Start on WhatsApp
              </a>

              <a 
                href="#how-it-works" 
                className="w-full sm:w-auto bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-bold px-7 py-4 rounded-2xl border border-slate-800 text-base transition flex items-center justify-center gap-2"
              >
                How It Works
                <ArrowRight className="w-4 h-4 text-[#00FF9D]" />
              </a>
            </div>

            {/* Micro Stats */}
            <div className="pt-6 border-t border-emerald-950/60 grid grid-cols-3 gap-4 text-center lg:text-left">
              <div>
                <p className="text-2xl font-black text-white">₦250M+</p>
                <p className="text-xs text-slate-400">Protected Volume</p>
              </div>
              <div>
                <p className="text-2xl font-black text-[#00FF9D]">0%</p>
                <p className="text-xs text-slate-400">Scam Guarantee</p>
              </div>
              <div>
                <p className="text-2xl font-black text-white">&lt; 2 Mins</p>
                <p className="text-xs text-slate-400">Escrow Creation</p>
              </div>
            </div>

          </div>

          {/* Right Column: Phone Mockup with Annotation */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
            
            {/* Hand-drawn Annotation Positioned Top Right */}
            <div className="hidden sm:block absolute -top-8 -right-4 z-20">
              <CurvedArrowAnnotation text="Same WhatsApp. More Security." />
            </div>

            {/* Phone Frame */}
            <div className="w-full max-w-[320px] bg-[#08140E] border-[8px] border-slate-800 rounded-[44px] shadow-2xl shadow-[#00FF9D]/15 overflow-hidden relative">
              
              {/* WhatsApp Header Mock */}
              <div className="bg-[#0b1b13] px-4 py-3.5 flex items-center gap-3 border-b border-emerald-900/50">
                <div className="w-9 h-9 rounded-full bg-[#00FF9D] flex items-center justify-center font-bold text-black text-sm">
                  TS
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-white font-bold text-xs">TrustShip Escrow Bot</p>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00FF9D] fill-current text-black" />
                  </div>
                  <p className="text-[10px] text-[#00FF9D]">Official Verified Business</p>
                </div>
              </div>

              {/* Chat Simulation Area */}
              <div className="p-4 space-y-3 min-h-[360px] max-h-[400px] overflow-y-auto bg-[#040C08] flex flex-col justify-end">
                {chatMessages.slice(0, chatStep + 1).map((msg, idx) => (
                  <div 
                    key={idx}
                    className={`max-w-[85%] p-3 rounded-2xl text-xs leading-snug transition-all duration-300 animate-fadeIn ${
                      msg.type === 'buyer' 
                        ? 'bg-[#005c4b] text-white self-end rounded-br-none shadow-sm'
                        : msg.type === 'seller'
                        ? 'bg-[#1f2c34] text-slate-200 self-end rounded-br-none'
                        : 'bg-[#11241B] text-slate-100 self-start rounded-bl-none border border-emerald-800/40'
                    }`}
                  >
                    <p>{msg.text}</p>
                    <span className="text-[9px] text-slate-400 block text-right mt-1">12:44 PM ✓✓</span>
                  </div>
                ))}
              </div>

              {/* Chat Input Footer */}
              <div className="bg-[#0b1b13] p-2.5 flex items-center gap-2 border-t border-emerald-900/40">
                <div className="flex-1 bg-[#14281E] rounded-full px-3 py-1.5 text-[11px] text-slate-400">
                  Type seller username...
                </div>
                <div className="w-7 h-7 rounded-full bg-[#00FF9D] flex items-center justify-center text-black font-bold">
                  ➔
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ================= TRUST BAR (DARK) ================= */}
      <section className="relative z-10 border-y border-emerald-950/80 bg-[#040D08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center justify-between">
            
            {/* Badge 1: Flutterwave */}
            <div className="flex items-center gap-4 bg-emerald-950/20 p-4 rounded-2xl border border-emerald-900/30">
              <div className="w-12 h-12 rounded-full bg-emerald-950 flex items-center justify-center shrink-0 border border-emerald-800/50">
                <FlutterwaveLogo className="w-6 h-6" showWordmark={false} />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Powered by Flutterwave</p>
                <p className="text-xs text-slate-400">Secure Payments</p>
              </div>
            </div>

            {/* Badge 2: WhatsApp API */}
            <div className="flex items-center gap-4 bg-emerald-950/20 p-4 rounded-2xl border border-emerald-900/30">
              <div className="w-12 h-12 rounded-full bg-emerald-950 flex items-center justify-center shrink-0 border border-emerald-800/50">
                <WhatsAppIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">WhatsApp API</p>
                <p className="text-xs text-slate-400">Seamless Communication</p>
              </div>
            </div>

            {/* Badge 3: 100% Scam Protection */}
            <div className="flex items-center gap-4 bg-emerald-950/20 p-4 rounded-2xl border border-emerald-900/30">
              <div className="w-12 h-12 rounded-full bg-emerald-950 flex items-center justify-center shrink-0 border border-emerald-800/50 text-[#00FF9D]">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">100% Scam Protection</p>
                <p className="text-xs text-slate-400">Your Safety, Our Priority</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ================= WHY YOU NEED TRUSTSHIP (CLEAN WHITE SECTION) ================= */}
      <section id="why-trust-us" className="relative z-10 bg-white text-slate-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold tracking-wider uppercase">
              THE TRUSTSHIP ADVANTAGE
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
              Why You Need TrustShip
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              Online transactions on Instagram, Twitter, and marketplaces carry high risks. TrustShip removes the fear by holding funds securely until both parties are satisfied.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: "Eliminates Scam Risks", desc: "No more fake payment screenshots or unfulfilled orders." },
              { icon: Lock, title: "Secure Payments", desc: "Funds held in regulated Flutterwave escrow accounts." },
              { icon: Smartphone, title: "WhatsApp Native", desc: "Complete transactions inside WhatsApp with zero app installs." },
              { icon: Users, title: "Build Trust", desc: "Sellers gain instant credibility by offering escrow payment." },
              { icon: Zap, title: "Fast Payouts", desc: "Automated instant payout to seller upon buyer confirmation." },
              { icon: CheckCircle2, title: "Dispute Protection", desc: "Our human support team steps in if items aren't as described." },
              { icon: Package, title: "Waybill Safe", desc: "Perfect for inter-state deliveries across Nigeria." },
              { icon: Star, title: "100% Protection", desc: "Guaranteed money-back if transaction requirements fail." },
            ].map((item, idx) => (
              <div 
                key={idx}
                className="p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-500/50 transition duration-300 group hover:-translate-y-1 shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition">
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-2">{item.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS (DARK) ================= */}
      <section id="how-it-works" className="relative z-10 border-t border-emerald-950/80 bg-[#020A06] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-16 gap-6">
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-widest text-[#00FF9D]">
                SIMPLE. SECURE. SEAMLESS.
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                How TrustShip Works
              </h2>
              <p className="text-slate-400 text-sm">
                A 4-step process designed to keep you safe on every transaction.
              </p>
            </div>

            {/* Handwritten Annotation on Top Right */}
            <div className="hidden md:block">
              <CurvedArrowAnnotation text="You buy. We hold. You're safe." />
            </div>
          </div>

          {/* 4 Steps Horizontal Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            
            <div className="p-6 rounded-2xl bg-[#06140D] border border-emerald-900/40 relative space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-full bg-[#00FF9D] text-black font-black flex items-center justify-center text-sm">
                  1
                </span>
                <MessageSquare className="w-5 h-5 text-slate-400" />
              </div>
              <h3 className="font-bold text-white text-lg">Start on WhatsApp</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Chat with our TrustShip bot and specify what item you're buying or selling.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#06140D] border border-emerald-900/40 relative space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-full bg-[#00FF9D] text-black font-black flex items-center justify-center text-sm">
                  2
                </span>
                <Lock className="w-5 h-5 text-slate-400" />
              </div>
              <h3 className="font-bold text-white text-lg">Pay via Flutterwave</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Buyer pays into the TrustShip Flutterwave escrow wallet. Funds are safely locked.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#06140D] border border-emerald-900/40 relative space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-full bg-[#00FF9D] text-black font-black flex items-center justify-center text-sm">
                  3
                </span>
                <Package className="w-5 h-5 text-slate-400" />
              </div>
              <h3 className="font-bold text-white text-lg">Confirm Delivery</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Seller ships item. Buyer inspects goods upon arrival and enters secret release PIN.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#06140D] border border-emerald-900/40 relative space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-full bg-[#00FF9D] text-black font-black flex items-center justify-center text-sm">
                  4
                </span>
                <CheckCircle2 className="w-5 h-5 text-slate-400" />
              </div>
              <h3 className="font-bold text-white text-lg">Transaction Complete</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Funds are instantly transferred to the seller's bank account. Simple & safe!
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ================= YOUR SECURITY MATTERS (CLEAN WHITE SECTION) ================= */}
      <section id="security" className="relative z-10 bg-white text-slate-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold tracking-wider uppercase">
                DON'T BE SCARED. BE SMART.
              </div>

              <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
                Your Security Matters
              </h2>

              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                We know online trust isn't given easily. Here is exactly why you can conduct high-value transactions on TrustShip with complete peace of mind:
              </p>

              <div className="space-y-4">
                {[
                  "Regulated banking infrastructure powered by Flutterwave.",
                  "WhatsApp API integration for verified, scam-proof buyer & seller identity.",
                  "100% Held Funds Guarantee: Payments never leave escrow without your explicit approval PIN.",
                  "24/7 Dispute resolution center for damaged or non-delivered goods."
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                      ✓
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 font-medium">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Visual Stack */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="relative w-full max-w-md h-[340px] flex items-center justify-center">
                
                {/* Flutterwave Floating Card */}
                <div className="absolute top-0 left-0 bg-white text-slate-900 p-4 rounded-2xl shadow-2xl border border-slate-200 transform -rotate-6 w-52 z-10">
                  <FlutterwaveLogo className="w-5 h-5" showWordmark={true} />
                  <p className="text-[11px] font-bold text-slate-700 mt-2">Secure Payments You Can Trust 🔒</p>
                </div>

                {/* WhatsApp API Floating Card */}
                <div className="absolute top-4 right-0 bg-white text-slate-900 p-4 rounded-2xl shadow-2xl border border-slate-200 transform rotate-6 w-52 z-10">
                  <div className="flex items-center gap-2">
                    <WhatsAppIcon className="w-5 h-5" />
                    <span className="font-extrabold text-xs text-slate-800">WhatsApp API</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-700 mt-2">Real Conversations. Real Safety.</p>
                </div>

                {/* Central Dark TrustShip Badge */}
                <div className="relative z-20 bg-[#06180F] border-2 border-[#00FF9D] p-8 rounded-3xl text-center space-y-3 shadow-2xl shadow-[#00FF9D]/20 w-64 transform hover:scale-105 transition duration-300">
                  <TrustShipLogo className="w-14 h-14 mx-auto" showText={false} />
                  <p className="text-xl font-black text-white">TrustShip</p>
                  <p className="text-xs text-[#00FF9D] font-bold uppercase tracking-wider">
                    Escrow for a Safer Tomorrow
                  </p>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ================= TESTIMONIALS (DARK) ================= */}
      <section id="reviews" className="relative z-10 border-t border-emerald-950/80 bg-[#020A06] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
          
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#00FF9D]">
              REAL PEOPLE. REAL STORIES.
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Loved by Nigerian Buyers & Sellers
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {[
              {
                quote: "I was scared to buy an iPhone 15 online from an Instagram seller in Abuja. TrustShip held my money till the item was delivered safely to Lagos. 10/10!",
                name: "Amaka O.",
                location: "Lagos",
                role: "Buyer"
              },
              {
                quote: "As a sneaker vendor, buyers kept suspecting me of being a scammer. Using TrustShip gave my business instant credibility!",
                name: "Tunde E.",
                location: "Abuja",
                role: "Sneaker Seller"
              },
              {
                quote: "The fact that it works directly inside WhatsApp without downloading extra apps makes it super convenient for all my customers.",
                name: "Ngozi K.",
                location: "Port Harcourt",
                role: "Fashion Merchant"
              }
            ].map((review, i) => (
              <div key={i} className="p-6 rounded-2xl bg-[#06120D] border border-emerald-950 space-y-4">
                <div className="flex text-amber-400 gap-1 text-sm">
                  ★★★★★
                </div>
                <p className="text-slate-300 text-xs leading-relaxed italic">
                  "{review.quote}"
                </p>
                <div className="pt-2 border-t border-emerald-950 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-white">{review.name}</p>
                    <p className="text-slate-400">{review.location}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-[#00FF9D] text-[10px] font-bold">
                    {review.role}
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ================= FINAL CTA BANNER (DARK) ================= */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="p-10 sm:p-14 rounded-3xl bg-gradient-to-br from-[#062014] via-[#04140D] to-[#020A06] border border-[#00FF9D]/30 space-y-6 shadow-2xl shadow-[#00FF9D]/10">
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Ready to Buy or Sell Safely?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
            Join thousands of smart Nigerians taking the risk out of online commerce today.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <a 
              href="https://wa.me/" 
              className="bg-[#00FF9D] hover:bg-[#00E08A] text-slate-950 font-black px-8 py-4 rounded-2xl text-sm transition flex items-center justify-center gap-2"
            >
              <WhatsAppIcon className="w-5 h-5 text-black" />
              Start on WhatsApp Now
            </a>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="relative z-10 border-t border-emerald-950/80 bg-[#020704] py-12 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          <div className="space-y-4">
            <TrustShipLogo className="w-8 h-8" showText={true} showSlogan={true} />
            <p className="text-slate-400 text-xs leading-relaxed">
              Nigeria's most trusted WhatsApp-native escrow platform. Safe transactions, zero scams.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-white">Quick Links</p>
            <p><a href="#how-it-works" className="hover:text-[#00FF9D]">How It Works</a></p>
            <p><a href="#why-trust-us" className="hover:text-[#00FF9D]">Why Trust Us</a></p>
            <p><a href="#security" className="hover:text-[#00FF9D]">Security & Verification</a></p>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-white">Legal & Support</p>
            <p><a href="#" className="hover:text-[#00FF9D]">Terms of Service</a></p>
            <p><a href="#" className="hover:text-[#00FF9D]">Privacy Policy</a></p>
            <p><a href="mailto:trustship.app@gmail.com" className="hover:text-[#00FF9D]">trustship.app@gmail.com</a></p>
          </div>

          <div className="space-y-3">
            <p className="font-bold text-white">Connect With Us</p>
            <div className="flex items-center gap-4 text-base">
              <a href="https://wa.me/" className="hover:text-[#00FF9D]"><WhatsAppIcon className="w-5 h-5" /></a>
              <a href="#" className="hover:text-[#00FF9D]">𝕏</a>
              <a href="#" className="hover:text-[#00FF9D]">📸</a>
            </div>
          </div>

        </div>

        <div className="border-t border-emerald-950/60 pt-6 text-center text-slate-600 max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} TrustShip Escrow Technologies. All rights reserved. Powered by Flutterwave.</p>
        </div>
      </footer>

    </div>
  );
}