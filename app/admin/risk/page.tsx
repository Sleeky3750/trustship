// Fraud risk overview.
//
// Risk scoring exposes counterparty behaviour, so the page requires an
// authenticated admin session (same bar as /api/admin/risk).
export const dynamic = "force-dynamic";

import { requireAdminPage } from "@/lib/admin-guards";
import RiskView from "./RiskView";

export default async function AdminRiskPage() {
  await requireAdminPage();

  return <RiskView />;
}
