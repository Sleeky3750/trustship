// Admin dispute resolution queue.
//
// Dispute moderation is an administrative function (fault allocation moves
// money), so it requires an authenticated admin session — the same bar the
// board's API applies.
export const dynamic = "force-dynamic";

import { requireAdminPage } from "@/lib/admin-guards";
import DisputesListView from "./DisputesListView";

export default async function AdminDisputesPage() {
  await requireAdminPage();

  return <DisputesListView />;
}
