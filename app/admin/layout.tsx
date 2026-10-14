import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col p-6 shadow-xl">
        <div className="mb-8">
          <h1 className="text-xl font-bold tracking-tight text-blue-400">TrustShip Admin</h1>
          <p className="text-xs text-slate-400 mt-1">Escrow Compliance Portal</p>
        </div>

        <nav className="flex flex-col space-y-1.5 flex-1">
          <Link
            href="/admin"
            className="px-4 py-2.5 rounded-xl hover:bg-slate-800 transition text-sm font-medium text-slate-300 hover:text-white"
          >
            📊 Dashboard
          </Link>
          <Link
            href="/admin/transactions"
            className="px-4 py-2.5 rounded-xl hover:bg-slate-800 transition text-sm font-medium text-slate-300 hover:text-white"
          >
            💼 Escrow Transactions
          </Link>
          <Link
            href="/admin/audit-logs"
            className="px-4 py-2.5 rounded-xl hover:bg-slate-800 transition text-sm font-medium text-slate-300 hover:text-white"
          >
            📜 Audit Logs
          </Link>
          <Link
            href="/admin/settings/security"
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 transition text-sm font-medium text-white shadow-sm"
          >
            🔒 Security & 2FA
          </Link>
        </nav>

        <div className="pt-4 border-t border-slate-800 text-xs text-slate-500">
          Environment: {process.env.NODE_ENV || 'development'}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-10">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
