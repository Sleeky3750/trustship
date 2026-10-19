'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Raw AdminRole enum values -> friendly labels for the sidebar badge.
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  FINANCE: 'Finance',
  SUPPORT: 'Support',
};

function formatRole(role: string): string {
  if (!role) return '';
  return (
    ROLE_LABELS[role] ??
    role
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminRole, setAdminRole] = useState<string>('');

  useEffect(() => {
    async function checkRole() {
      try {
        const res = await fetch('/api/admin/me');
        if (res.status === 401 || res.status === 404) {
          // Session missing or invalid (expired / removed admin) → back to login.
          // No-op when the login screen itself is the current page.
          if (window.location.pathname !== '/admin/login') {
            router.replace('/admin/login');
          }
          return;
        }
        const data = await res.json();
        if (data.success && data.admin) {
          setAdminRole(data.admin.role);
        }
      } catch (err) {
        console.error('Failed to load admin role for sidebar');
      }
    }
    checkRole();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.push('/admin/login');
      router.refresh();
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const isSuperAdmin = adminRole === 'SUPER_ADMIN';

  return (
    <div className="flex h-screen bg-[#03070A] text-slate-100 font-sans">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-[#03070A] text-slate-100 flex flex-col p-6 border-r border-slate-800/70">
        <div className="mb-8">
          <h1 className="text-xl font-bold tracking-tight text-blue-400">TrustShip Admin</h1>
          <p className="text-xs text-slate-400 mt-1">Escrow Compliance Portal</p>
          {adminRole && (
            <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              {formatRole(adminRole)}
            </span>
          )}
        </div>

        <nav className="flex flex-col space-y-1.5 flex-1">
          <Link
            href="/admin"
            className={`px-4 py-2.5 rounded-xl transition text-sm font-medium ${
              pathname === '/admin' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            📊 Dashboard
          </Link>
          <Link
            href="/admin/transactions"
            className={`px-4 py-2.5 rounded-xl transition text-sm font-medium ${
              pathname === '/admin/transactions' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            💼 Escrow Transactions
          </Link>

          {isSuperAdmin && (
            <Link
              href="/admin/audit-logs"
              className={`px-4 py-2.5 rounded-xl transition text-sm font-medium ${
                pathname === '/admin/audit-logs' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              📜 Audit Logs
            </Link>
          )}

          <Link
            href="/admin/settings/security"
            className={`px-4 py-2.5 rounded-xl transition text-sm font-medium ${
              pathname === '/admin/settings/security' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            🔒 Security & 2FA
          </Link>
        </nav>

        <div className="pt-4 border-t border-slate-800 flex flex-col space-y-3">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-slate-800 transition flex items-center gap-2"
          >
            🚪 Log Out
          </button>
          <div className="text-[11px] text-slate-500 px-1">
            Environment: {process.env.NODE_ENV || 'development'}
          </div>
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
