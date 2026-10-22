// Admin operational + financial overview.
//
// Read-only operational metrics; the underlying API requires `transactions:read`
// so this page is available to every authenticated admin.
export const dynamic = "force-dynamic";

import { requireAdminPage } from "@/lib/admin-guards";
import OverviewView from "./OverviewView";

export default async function AdminOverviewPage() {
  await requireAdminPage();
  return <OverviewView />;
}
