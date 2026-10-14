export default function HomePage() {
  return (
    <div className="bg-[#030611] text-slate-100 min-h-screen flex flex-col justify-between font-sans antialiased selection:bg-blue-500 selection:text-white">
      {/* HEADER */}
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
          <div className="flex items-center gap-3">
            <a
              href="/admin/dashboard"
              className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 px-4 py-2 rounded-xl text-xs font-semibold transition"
            >
              Admin Dashboard
            </a>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="flex-1 max-w-4xl w-0-auto mx-auto px-4 py-20 text-center space-y-6 my-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
          🛡️ Secure Transactions in Nigeria
        </div>
        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
          Automated Escrow, Right on <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">WhatsApp</span>
        </h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
          Protecting buyers and sellers with instant Paystack integration, 4-digit PIN verification, and real-time automated tracking.
        </p>
        <div className="pt-4 flex flex-wrap justify-center gap-4">
          <a
            href="/admin/dashboard"
            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-blue-600/25 transition"
          >
            Open Admin Portal
          </a>
          <a
            href="/terms"
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-6 py-3 rounded-xl border border-slate-700 transition"
          >
            View Terms & Policy
          </a>
        </div>
      </main>

      {/* FOOTER WITH POLICY LINK */}
      <footer className="border-t border-slate-800/80 bg-[#070C1E]/50 py-6 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} TrustShip Escrow Technologies. All rights reserved.</p>
        <div className="mt-2 flex items-center justify-center gap-4 font-medium">
          <a href="/terms" className="text-blue-400 hover:underline">
            Terms of Service & Privacy Policy
          </a>
          <span className="text-slate-700">•</span>
          <a href="mailto:support@trustship.io" className="text-slate-400 hover:underline">
            Support Desk
          </a>
        </div>
      </footer>
    </div>
  );
}
