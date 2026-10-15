import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 font-sans overflow-x-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-emerald-500/10 blur-[140px] rounded-full pointer-events-none" />

      {/* Navigation */}
      <nav className="relative z-10 max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-slate-950 font-black text-lg shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
            TS
          </div>
          <span className="text-xl font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
            TrustShip
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/login"
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 hover:bg-slate-800 transition-all duration-300 shadow-sm"
          >
            Admin Portal
          </Link>
          <a
            href="https://wa.me/?text=Hello%20TrustShip,%20I%20want%20to%20start%20an%20escrow%20transaction."
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all duration-300 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
          >
            Launch on WhatsApp
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-16 pb-24 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium animate-pulse">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          Secure WhatsApp Escrow Infrastructure
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] text-white">
          Trade Safely on WhatsApp <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
            Backed by Instant Escrow.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-400 leading-relaxed font-normal">
          TrustShip protects buyers and sellers directly inside WhatsApp chats. Automated deposits, verified inspections, and instant fund releases.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <a
            href="https://wa.me/?text=Hello%20TrustShip,%20I%20want%20to%20start%20an%20escrow%20transaction."
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400 transition-all duration-300 shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-1"
          >
            Start WhatsApp Escrow Now
          </a>
          <Link
            href="/admin/login"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 font-semibold text-sm hover:bg-slate-800 hover:text-white hover:border-slate-700 transition-all duration-300"
          >
            Access Admin Dashboard
          </Link>
        </div>
      </section>

      {/* Official Partner Logos Section */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-500 mb-8">
          Powered & Secured By Industry Leaders
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Meta / WhatsApp Card */}
          <div className="group p-6 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1 flex items-center gap-5 backdrop-blur-md">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center p-3 group-hover:scale-110 transition-transform duration-300 border border-slate-700/50">
              <img
                src="/logos/meta.svg"
                alt="Meta Logo"
                className="w-full h-full object-contain filter brightness-90 group-hover:brightness-100 transition-all"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = '<span class="text-2xl">💬</span>';
                }}
              />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">Meta WhatsApp Cloud API</h3>
              <p className="text-xs text-slate-400 mt-0.5">Native chat automation & secure inbound encryption.</p>
            </div>
          </div>

          {/* Flutterwave / Payment Card */}
          <div className="group p-6 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1 flex items-center gap-5 backdrop-blur-md">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center p-3 group-hover:scale-110 transition-transform duration-300 border border-slate-700/50">
              <img
                src="/logos/flutterwave.svg"
                alt="Flutterwave Logo"
                className="w-full h-full object-contain filter brightness-90 group-hover:brightness-100 transition-all"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = '<span class="text-2xl">💳</span>';
                }}
              />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">Flutterwave & Paystack</h3>
              <p className="text-xs text-slate-400 mt-0.5">Instant secure escrow holding & automated disbursements.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition-all duration-300 space-y-4 hover:-translate-y-1 group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all duration-300">
              01
            </div>
            <h3 className="text-lg font-bold text-white">In-Chat Deal Setup</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Initiate escrows instantly by typing simple commands directly inside your active WhatsApp conversation.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition-all duration-300 space-y-4 hover:-translate-y-1 group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all duration-300">
              02
            </div>
            <h3 className="text-lg font-bold text-white">Bank-Grade Holding</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Funds are securely locked in escrow. Neither buyer nor seller can access them until delivery is verified.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition-all duration-300 space-y-4 hover:-translate-y-1 group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all duration-300">
              03
            </div>
            <h3 className="text-lg font-bold text-white">Immutable Audit Logs</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Every deposit, release, and admin action is cryptographically tracked with IP logging and role enforcement.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl mx-auto px-6 py-12 border-t border-slate-900 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p>© {new Date().getFullYear()} TrustShip Escrow Technologies. All rights reserved.</p>
        <div className="flex gap-6">
          <Link href="/admin/login" className="hover:text-slate-400 transition">Admin Login</Link>
          <a href="https://wa.me" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition">Support Chat</a>
        </div>
      </footer>
    </div>
  );
}
