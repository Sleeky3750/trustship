// Admin payout queue.
//
// Payouts move real money, so the page requires an authenticated admin; the
// mutating endpoints additionally restrict retry/enqueue to FINANCE_ADMIN and
// SUPER_ADMIN (reflected in the UI via `canManage`).
export const dynamic = "force-dynamic";

import { requireAdminPage } from "@/lib/admin-guards";
import PayoutsView from "./PayoutsView";

export default async function AdminPayoutsPage() {
  await requireAdminPage();

  return <PayoutsView />;
}
