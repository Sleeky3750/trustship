'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

// Raw AdminRole enum values -> friendly labels for the sidebar badge.
// Prisma persists SUPPORT/FINANCE (@map) while the spec names are
// SUPPORT_MODERATOR/FINANCE_ADMIN — label both spellings.
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  SUPPORT_MODERATOR: 'Support',
  SUPPORT: 'Support',
  FINANCE_ADMIN: 'Finance',
  FINANCE: 'Finance',
};

// Normalizes any role casing (e.g. "super_admin" / "Super_Admin" / "SUPER_ADMIN").
function normalizeRole(role?: string | null): string {
  return (role || '').trim().toUpperCase();
}

// Always returns a display label — falls back to "Admin" when an
// *authenticated* session's role string is missing or unrecognized, so the
// badge never renders empty. This is only ever called after the session has
// been verified server-side; unauthenticated visitors never see it.
function formatRole(role?: string | null): string {
  const normalized = normalizeRole(role);
  if (!normalized) return 'Admin';
  return (
    ROLE_LABELS[normalized] ??
    normalized
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

// Session verification state from /api/admin/me (server-side truth).
// Chrome (badges, role metadata, nav links) renders ONLY when 'authenticated'.
type SessionState = 'loading' | 'authenticated' | 'unauthenticated';

// Auto-logout after this much inactivity. The server cookie lives 8 hours, so
// closing the tab for an afternoon must not leave a usable session behind: the
// client ends the session itself once this window lapses.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminRole, setAdminRole] = useState<string>('');
  const [sessionState, setSessionState] = useState<SessionState>('loading');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /**
   * Ends the session unconditionally and returns the browser to the login
   * screen. Used by both the explicit "Log Out" button and the idle timeout.
   * `replace` (not `push`) keeps the logged-out page out of history.
   */
  const endSession = useCallback(async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (err) {
      console.error('Logout request failed', err);
    } finally {
      router.replace('/admin/login');
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const res = await fetch('/api/admin/me', { credentials: 'same-origin' });
        if (res.status === 401 || res.status === 404) {
          // Session missing or invalid (expired / removed admin) → back to login.
          // No-op when the login screen itself is the current page.
          if (!cancelled) setSessionState('unauthenticated');
          if (window.location.pathname !== '/admin/login') {
            router.replace('/admin/login');
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          if (data.success && data.admin) {
            setAdminRole(data.admin.role || '');
            setSessionState('authenticated');
          } else {
            // Fail closed: no verified session → no role labels, no nav.
            setSessionState('unauthenticated');
          }
        }
      } catch (err) {
        console.error('Failed to verify admin session for sidebar');
        // Fail closed on network/server errors as well — never assume a role.
        if (!cancelled) setSessionState('unauthenticated');
      }
    }

    // Re-check the session on every navigation (including returning to the
    // dashboard) so a stale tab cannot rely on client state alone. An already
    // verified session stays rendered while the re-check is in flight — only
    // the very first load shows the neutral skeleton, so navigations inside the
    // admin area don't flash the bare layout.
    checkSession();
    return () => {
      cancelled = true;
    };
    // `sessionState` is intentionally omitted from the deps: including it would
    // re-run the effect on every state transition (infinite verify loop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, pathname]);

  // Idle auto-logout: any tracked activity resets the timer; once it lapses the
  // session is ended explicitly rather than left to expire server-side.
  useEffect(() => {
    if (sessionState !== 'authenticated') return;

    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void endSession();
      }, IDLE_TIMEOUT_MS);
    };

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, reset, { passive: true })
    );
    reset();

    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [sessionState, endSession]);

  const handleLogout = async () => {
    try {
      await endSession();
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  // --- Zero role-leakage rules --------------------------------------------
  // 1. The login route renders completely bare: no sidebar, no badges, no
  //    navigation — nothing that could display an internal role label to an
  //    unauthenticated visitor.
  // 2. If /api/admin/me could not confirm a session, also render bare (a
  //    redirect to /admin/login is in flight or the request failed).
  // 3. Otherwise the shell structure renders, but role badges, role metadata
  //    and navigation links are gated behind `verified` — they appear only
  //    after the server-side session check succeeds.
  const isLoginRoute = pathname === '/admin/login';
  if (isLoginRoute || sessionState === 'unauthenticated') {
    return <>{children}</>;
  }

  const verified = sessionState === 'authenticated';

  // Case-insensitive super-admin check (handles "super_admin", "Super_Admin", etc.).
  const isSuperAdmin = normalizeRole(adminRole) === 'SUPER_ADMIN';
  // Payouts are limited to finance roles — mirrors the role allow-list on
  // /api/admin/payouts and its retry endpoint.
  const normalizedRole = normalizeRole(adminRole);
  const canManageFinance =
    normalizedRole === 'SUPER_ADMIN' ||
    normalizedRole === 'FINANCE_ADMIN' ||
    normalizedRole === 'FINANCE';
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#03070A] text-slate-100 font-sans">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between border-b border-slate-800/70 bg-[#03070A] px-4 py-3 z-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="inline-flex items-center justify-center rounded-md p-2 text-slate-300 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            aria-label="Toggle sidebar"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight text-blue-400">TrustShip Admin</h1>
            <p className="text-[11px] text-slate-400">Escrow Compliance Portal</p>
          </div>
        </div>
        {/* Role badge — rendered ONLY after the server-side session check
            succeeds; falls back to "Admin" if the role string is
            missing/unrecognized. */}
        {verified && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            {formatRole(adminRole)}
          </span>
        )}
      </div>

      {/* Admin Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-40 w-64 transform bg-[#03070A] text-slate-100 flex flex-col px-6 pb-6 pt-20 md:p-6 border-r border-slate-800/70 transition-transform duration-200 ease-in-out md:relative md:translate-x-0 md:flex md:flex-col md:h-full`}
      >
        <div className="mb-8 hidden md:block">
          <h1 className="text-xl font-bold tracking-tight text-blue-400">TrustShip Admin</h1>
          <p className="text-xs text-slate-400 mt-1">Escrow Compliance Portal</p>
          {/* Role badge — rendered ONLY after the server-side session check
              succeeds; falls back to "Admin" if the role string is
              missing/unrecognized. */}
          {verified && (
            <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              {formatRole(adminRole)}
            </span>
          )}
        </div>

        <nav className="flex flex-col space-y-1.5 flex-1">
          {verified ? (
            <>
              <Link
                href="/admin"
                onClick={closeSidebar}
                className={`px-4 py-2.5 rounded-xl transition text-sm font-medium ${
                  pathname === '/admin' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                📊 Dashboard
              </Link>
              <Link
                href="/admin/transactions"
                onClick={closeSidebar}
                className={`px-4 py-2.5 rounded-xl transition text-sm font-medium ${
                  pathname === '/admin/transactions' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                💼 Escrow Transactions
              </Link>

              <Link
                href="/admin/logistics"
                onClick={closeSidebar}
                className={`px-4 py-2.5 rounded-xl transition text-sm font-medium ${
                  pathname === '/admin/logistics' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                🚚 Logistics &amp; Tracking
              </Link>

              <Link
                href="/admin/disputes"
                onClick={closeSidebar}
                className={`px-4 py-2.5 rounded-xl transition text-sm font-medium ${
                  pathname.startsWith('/admin/disputes') ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                ⚖️ Disputes
              </Link>

              {/* Payouts are finance-only (the API enforces the same roles). */}
              {canManageFinance && (
                <Link
                  href="/admin/payouts"
                  onClick={closeSidebar}
                  className={`px-4 py-2.5 rounded-xl transition text-sm font-medium ${
                    pathname === '/admin/payouts' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  💸 Payouts
                </Link>
              )}

              {isSuperAdmin && (
                <Link
                  href="/admin/risk"
                  onClick={closeSidebar}
                  className={`px-4 py-2.5 rounded-xl transition text-sm font-medium ${
                    pathname === '/admin/risk' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  🛡️ Fraud Risk
                </Link>
              )}

              {isSuperAdmin && (
                <Link
                  href="/admin/audit-logs"
                  onClick={closeSidebar}
                  className={`px-4 py-2.5 rounded-xl transition text-sm font-medium ${
                    pathname === '/admin/audit-logs' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  📜 Audit Logs
                </Link>
              )}

              {isSuperAdmin && (
                <Link
                  href="/admin/settings/admins"
                  onClick={closeSidebar}
                  className={`px-4 py-2.5 rounded-xl transition text-sm font-medium ${
                    pathname === '/admin/settings/admins' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  👥 Manage Admins
                </Link>
              )}

              <Link
                href="/admin/settings/security"
                onClick={closeSidebar}
                className={`px-4 py-2.5 rounded-xl transition text-sm font-medium ${
                  pathname === '/admin/settings/security' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                🔒 Security &amp; 2FA
              </Link>
            </>
          ) : (
            // Session not yet verified — neutral placeholders only, so no
            // administrative navigation leaks before the server confirms it.
            <div className="flex flex-col space-y-1.5 animate-pulse" aria-hidden="true">
              <div className="h-10 rounded-xl bg-slate-800/60" />
              <div className="h-10 rounded-xl bg-slate-800/60" />
              <div className="h-10 rounded-xl bg-slate-800/60" />
            </div>
          )}
        </nav>

        {verified && (
          <div className="pt-4 border-t border-slate-800 flex flex-col space-y-3">
            <button
              onClick={() => {
                closeSidebar();
                handleLogout();
              }}
              className="w-full text-left px-4 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-slate-800 transition flex items-center gap-2"
            >
              🚪 Log Out
            </button>
            <div className="text-[11px] text-slate-500 px-1">
              Environment: {process.env.NODE_ENV || 'development'}
            </div>
          </div>
        )}
      </aside>

      {/* Mobile drawer backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto w-full p-4 md:p-10">
        <div className="w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
