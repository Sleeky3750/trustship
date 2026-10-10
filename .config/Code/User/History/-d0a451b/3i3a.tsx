import LogoutButton from "@/components/LogoutButton";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

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

  const workspaces = await prisma.workspace.findMany({
    where: {
      businessId: business.id,
    },
    include: {
      projects: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const projectCount = workspaces.reduce(
    (sum, workspace) => sum + workspace.projects.length,
    0
  );

  return (
    <main className="min-h-screen bg-gray-100 p-8">

      <div className="max-w-6xl mx-auto">

        <h1 className="text-4xl font-bold">
          👋 Welcome back,
        </h1>

        <p className="text-gray-600 mt-2 mb-8">
          {business.businessName}
        </p>
        
        <LogoutButton />

        <div className="grid md:grid-cols-3 gap-6 mb-10">

          <div className="bg-white rounded-2xl shadow p-6">
            <p className="text-gray-500">
              🏢 Workspaces
            </p>

            <h2 className="text-4xl font-bold mt-2">
              {workspaces.length}
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <p className="text-gray-500">
              📁 Projects
            </p>

            <h2 className="text-4xl font-bold mt-2">
              {projectCount}
            </h2>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <p className="text-gray-500">
              📧 Email
            </p>

            <h2 className="font-semibold mt-2 break-all">
              {business.email}
            </h2>
          </div>

        </div>

        <div className="bg-white rounded-2xl shadow p-6 mb-10">

          <h2 className="text-2xl font-bold mb-6">
            Create Workspace
          </h2>

          <CreateWorkspaceForm />

        </div>

        <div className="bg-white rounded-2xl shadow p-6">

          <h2 className="text-2xl font-bold mb-6">
            Your Workspaces
          </h2>

          {workspaces.length === 0 ? (

            <p className="text-gray-500">
              No workspace yet.
            </p>

          ) : (

            <div className="grid md:grid-cols-2 gap-4">

              {workspaces.map((workspace) => (

                <Link
                  key={workspace.id}
                  href={`/workspace/${workspace.id}`}
                  className="border rounded-xl p-5 hover:bg-gray-50 transition"
                >

                  <h3 className="font-bold text-lg">
                    {workspace.name}
                  </h3>

                  <p className="text-gray-500 mt-2">
                    {workspace.description ||
                      "No description"}
                  </p>

                  <div className="mt-4 text-sm text-gray-400">

                    {workspace.projects.length} project
                    {workspace.projects.length !== 1
                      ? "s"
                      : ""}

                  </div>

                </Link>

              ))}

            </div>

          )}

        </div>

      </div>

    </main>
  );
}