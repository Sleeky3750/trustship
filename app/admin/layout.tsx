import AdminShell from "./components/AdminShell";

// Admin routes must render per-request so the proxy can attach a fresh CSP
// nonce to every HTML response (static HTML generated at build time cannot be
// stamped with a request-specific nonce). See proxy.ts.
export const dynamic = "force-dynamic";

// Server layout: keeps route-segment config in a Server Component and hands
// all interactive chrome (sidebar, badges, nav) to the client shell, which
// only renders it after /api/admin/me verifies the session.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
