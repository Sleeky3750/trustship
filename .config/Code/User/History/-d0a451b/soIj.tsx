import LogoutButton from "@/components/LogoutButton";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import CreateWorkspaceForm from "@/components/CreateWorkspaceForm";
import ProjectPlanner from "@/components/ai/ProjectPlanner";

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

  const defaultWorkspaceId = workspaces[0]?.id ?? "";

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-4xl font-bold">
          👋 Welcome back,
        </h1>

        <p className="mb-8 mt-2 text-gray-600">
          {business.businessName}
        </p>

        <LogoutButton />

        <div className="mb-10 mt-6 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-gray-500">
              🏢 Workspaces
            </p>

            <h2 className="mt-2 text-4xl font-bold">
              {workspaces.length}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-gray-500">
              📁 Projects
            </p>

            <h2 className="mt-2 text-4xl font-bold">
              {projectCount}
            </h2>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow">
            <p className="text-gray-500">
              📧 Email
            </p>

            <h2 className="mt-2 break-all font-semibold">
              {business.email}
            </h2>
          </div>
        </div>

        <div className="mb-10 rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-6 text-2xl font-bold">
            Create Workspace
          </h2>

          <CreateWorkspaceForm />
        </div>

        {workspaces.length > 0 && (
          <div className="mb-10 rounded-2xl bg-white p-6 shadow">
            <ProjectPlanner
              businessId={business.id}
              workspaceId={defaultWorkspaceId}
            />
          </div>
        )}

        {workspaces.length === 0 && (
          <div className="mb-10 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <h2 className="text-xl font-semibold">
              Create a workspace first
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Once you have a workspace, Pulse AI can
              create projects and tasks inside it.
            </p>
          </div>
        )}

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-6 text-2xl font-bold">
            Your Workspaces
          </h2>

          {workspaces.length === 0 ? (
            <p className="text-gray-500">
              No workspace yet.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {workspaces.map((workspace) => (
                <Link
                  key={workspace.id}
                  href={`/workspace/${workspace.id}`}
                  className="rounded-xl border p-5 transition hover:bg-gray-50"
                >
                  <h3 className="text-lg font-bold">
                    {workspace.name}
                  </h3>

                  <p className="mt-2 text-gray-500">
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