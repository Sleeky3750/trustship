// Admin refund management. Read requires refunds:read; lifecycle actions are
// permission-gated in the API and mirrored in the UI.
export const dynamic = "force-dynamic";

import { requireAdminPage } from "@/lib/admin-guards";
import RefundsView from "./RefundsView";

export default async function AdminRefundsPage() {
  await requireAdminPage();
  return <RefundsView />;
}
