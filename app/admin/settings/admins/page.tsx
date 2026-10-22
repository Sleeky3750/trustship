// Server Component entry for the admin-account management screen.
//
// Guarded at render time: only a SUPER_ADMIN session may reach it. The write
// path (createAdminAction) re-checks the same rule inside the Data Access Layer,
// because a Server Action is its own entry point and never inherits this guard.
export const dynamic = "force-dynamic";

import { requireSuperAdminPage } from "@/lib/admin-guards";
import { listAdminAccounts } from "@/lib/admin-management";
import ManageAdminsView from "./ManageAdminsView";

export default async function ManageAdminsPage() {
  const session = await requireSuperAdminPage();

  // listAdminAccounts re-authorizes from the session cookie (defence in depth).
  const result = await listAdminAccounts();
  const initialAdmins = result.success ? result.admins : [];

  return (
    <ManageAdminsView
      initialAdmins={initialAdmins}
      currentAdminId={session.id}
      loadError={result.success ? undefined : result.error}
    />
  );
}
