import PulseAssistant from "@/components/ai/PulseAssistant";
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

  const aiJobs = await prisma.aIJob.findMany({
    where: {
      businessId: business.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  const projectCount = workspaces.reduce(
    (sum, workspace) =>
      sum + workspace.projects.length,
    0
  );

  function getActivityTitle(
    type: string,
    input: unknown
  ) {
    if (
      input &&
      typeof input === "object" &&
      "action" in input &&
      input.action === "REFINE"
    ) {
      return "Plan refined with Pulse AI";
    }

    switch (type) {
      case "PROJECT_PLANNING":
        return "Project plan generated";

      case "TASK_ANALYSIS":
        return "Task analysis completed";

      case "RESEARCH":
        return "AI research completed";

      case "PROGRESS_ANALYSIS":
        return "Progress analysis completed";

      case "ASSISTANT":
        return "AI assistant activity";

      default:
        return "AI activity";
    }
  }

  function getActivityIcon(
    type: string,
    input: unknown
  ) {
    if (
      input &&
      typeof input === "object" &&
      "action" in input &&
      input.action === "REFINE"
    ) {
      return "✨";
    }

    switch (type) {
      case "PROJECT_PLANNING":
        return "📋";

      case "TASK_ANALYSIS":
        return "✅";

      case "RESEARCH":
        return "🔎";

      case "PROGRESS_ANALYSIS":
        return "📊";

      case "ASSISTANT":
        return "🤖";

      default:
        return "✨";
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "COMPLETED":
        return "Completed";

      case "PROCESSING":
        return "Processing";

      case "QUEUED":
        return "Queued";

      case "FAILED":
        return "Failed";

      default:
        return status;
    }
  }

  function getStatusClass(status: string) {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-700";

      case "PROCESSING":
        return "bg-blue-100 text-blue-700";

      case "QUEUED":
        return "bg-yellow-100 text-yellow-700";

      case "FAILED":
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">
            👋 Welcome back,
          </h1>

          <p className="mb-8 mt-2 text-gray-600">
            {business.businessName}
          </p>

          <LogoutButton />
        </div>

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
              workspaces={workspaces.map(
                (workspace) => ({
                  id: workspace.id,
                  name: workspace.name,
                })
              )}
            />
          </div>
        )}

        {workspaces.length === 0 && (
          <div className="mb-10 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <h2 className="text-xl font-semibold">
              Create a workspace first
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Once you have a workspace, Pulse AI
              can create projects and tasks inside it.
            </p>
          </div>
        )}

        <div className="mb-10 rounded-2xl bg-white p-6 shadow">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                🤖 AI Activity
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Recent activity from Pulse AI.
              </p>
            </div>

            {aiJobs.length > 0 && (
              <span className="text-sm text-gray-400">
                Last {aiJobs.length}
              </span>
            )}
          </div>

          {aiJobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
              <p className="text-gray-500">
                No AI activity yet.
              </p>

              <p className="mt-1 text-sm text-gray-400">
                Your Pulse AI activity will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {aiJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-start gap-4 rounded-xl border border-gray-100 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-50 text-lg">
                    {getActivityIcon(
                      job.type,
                      job.input
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="font-medium">
                        {getActivityTitle(
                          job.type,
                          job.input
                        )}
                      </h3>

                      <span
                        className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                          job.status
                        )}`}
                      >
                        {getStatusLabel(job.status)}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-gray-400">
                      {job.createdAt.toLocaleString()}
                    </p>

                    {job.error && (
                      <p className="mt-2 text-sm text-red-600">
                        {job.error}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
                    {workspace.projects.length !==
                    1
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