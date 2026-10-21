// Split-view dispute moderation board for one case.
//
// Guarded server-side: fault allocation moves money, so the page requires an
// authenticated admin just like the API it calls.
export const dynamic = "force-dynamic";

import { requireAdminPage } from "@/lib/admin-guards";
import DisputeBoardView from "./DisputeBoardView";

export default async function AdminDisputeBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;

  return <DisputeBoardView transactionRef={decodeURIComponent(id)} />;
}
