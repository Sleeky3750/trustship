// Server Component entry for the administrative audit trail.
//
// The SUPER_ADMIN role check happens HERE, at render time on the server, before
// any audit data is fetched or streamed. The client sidebar also hides the link
// for non-super-admins, but that is cosmetic only — this guard is the actual
// authorization boundary for the page (the API route enforces the same rule).
//
// Dynamic rendering keeps the per-request CSP nonce (see proxy.ts) and ensures
// the session is re-evaluated on every navigation rather than cached HTML.
export const dynamic = "force-dynamic";

import { requireSuperAdminPage } from "@/lib/admin-guards";
import AuditLogsView from "./AuditLogsView";

export default async function AdminAuditLogsPage() {
  await requireSuperAdminPage();

  return <AuditLogsView />;
}
