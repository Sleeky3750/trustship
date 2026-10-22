// Admin support scripts. Viewing requires support_scripts:read; editing is
// gated by support_scripts:manage (mirrored in the UI).
export const dynamic = "force-dynamic";

import { requireAdminPage } from "@/lib/admin-guards";
import SupportScriptsView from "./SupportScriptsView";

export default async function AdminSupportScriptsPage() {
  await requireAdminPage();
  return <SupportScriptsView />;
}
