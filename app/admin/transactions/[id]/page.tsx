// Admin transaction detail page.
export const dynamic = "force-dynamic";
import { requireAdminPage } from "@/lib/admin-guards";
import TransactionDetailView from "./TransactionDetailView";

export default async function AdminTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  return <TransactionDetailView id={id} />;
}
