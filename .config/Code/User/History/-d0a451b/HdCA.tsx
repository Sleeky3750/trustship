import { cookies } from "next/headers";
import { redirect } from "next/navigation";
 import { prisma } from "@/lib/prisma";
import CreateWorkspaceForm from "@/components/CreateWorkspaceForm";

export default async function DashboardPage() {
  const cookieStore = await cookies();

  const businessId = cookieStore.get("businessId");
 

  if (!businessId) {
    redirect("/login");
  }

  const business = await prisma.business.findUnique({
  where: {
    id: businessId.value,
  },
});

if (!business) {
  redirect("/login");
}

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="bg-white shadow-xl rounded-2xl p-10 w-full max-w-2xl">
        <h1 className="text-4xl font-bold mb-4">
          Welcome to Pulse 🚀
        </h1>

        <p className="text-gray-600 text-lg mb-8">
          You are logged in.
        </p>

        <div className="border rounded-xl p-6">
          <h2 className="text-2xl font-semibold mb-2">
            Dashboard
          </h2>
          <CreateWorkspaceForm />

          <p className="text-gray-500">
            Business ID:
          </p>

          

<div className="font-mono break-all space-y-3">
  <p>
    <strong>Business:</strong> {business.businessName}
  </p>

  <p>
    <strong>Email:</strong> {business.email}
  </p>

  <p>
    <strong>Phone:</strong> {business.phone}
  </p>

  <p>
    <strong>Business Type:</strong> {business.businessType}
  </p>
</div>
        </div>
      </div>
    </main>
  );
}