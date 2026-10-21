// Admin logistics dashboard.
//
// Server Component: any authenticated admin can see the shipments board (it is
// operational, not financial). The session is verified at render time so the
// page never streams for an anonymous visitor.
export const dynamic = "force-dynamic";

import { requireAdminPage } from "@/lib/admin-guards";
import LogisticsView from "./LogisticsView";

export default async function AdminLogisticsPage() {
  await requireAdminPage();

  return <LogisticsView />;
}
