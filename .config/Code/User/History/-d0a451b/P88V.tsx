import PulseInsights from "@/components/ai/PulseInsights";
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
    (total, workspace) =>
      total + workspace.projects.length,
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

  const hasWorkspaces = workspaces.length > 0;
  const hasProjects = projectCount > 0;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl p-6">

        {/* Header */}
        <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">
              Pulse Dashboard
            </p>

            <h1 className="mt-1 text-4xl font-bold tracking-tight">
              Welcome back 👋
            </h1>

            <p className="mt-2 text-gray-600">
              {business.businessName}
            </p>
          </div>

          <LogoutButton />
        </header>

        {/* Overview */}
        <section className="mb-10">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">
              Overview
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              A quick look at your business workspace.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">
                🏢 Workspaces
              </p>

              <p className="mt-2 text-4xl font-bold">
                {workspaces.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">
                📁 Projects
              </p>

              <p className="mt-2 text-4xl font-bold">
                {projectCount}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">
                📧 Business email
              </p>

              <p className="mt-3 break-all font-semibold">
                {business.email}
              </p>
            </div>
          </div>
        </section>

        {/* Getting Started / Workspace creation */}
        {!hasWorkspaces ? (
          <section className="mb-10 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-gray-500">
                GET STARTED
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Create your first workspace
              </h2>

              <p className="mt-2 text-gray-600">
                A workspace is where your projects,
                tasks, and Pulse AI activity will live.
              </p>
            </div>

            <div className="mt-6">
              <CreateWorkspaceForm />
            </div>
          </section>
        ) : (
          <>
            {/* Existing workspace creation */}
            <section className="mb-10 rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-5">
                <h2 className="text-2xl font-bold">
                  Create Workspace
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Add another workspace for a different
                  area of your business.
                </p>
              </div>

              <CreateWorkspaceForm />
            </section>

            {/* Pulse Intelligence */}
            <section className="mb-10">
              <PulseInsights />
            </section>

            {/* Project planning */}
            <section className="mb-10 rounded-2xl bg-white p-6 shadow-sm">
              <ProjectPlanner
                businessId={business.id}
                workspaces={workspaces.map(
                  (workspace) => ({
                    id: workspace.id,
                    name: workspace.name,
                  })
                )}
              />
            </section>

            {/* AI Assistant */}
            <section className="mb-10">
              <PulseAssistant />
            </section>
          </>
        )}

        {/* Workspaces */}
        <section className="mb-10 rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              Your Workspaces
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Manage the areas of your business you're
              working on.
            </p>
          </div>

          {!hasWorkspaces ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
              <div className="text-3xl">
                🏢
              </div>

              <h3 className="mt-3 font-semibold">
                No workspaces yet
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Create your first workspace above to
                start organizing your work.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {workspaces.map((workspace) => (
                <Link
                  key={workspace.id}
                  href={`/workspace/${workspace.id}`}
                  className="rounded-xl border border-gray-200 p-5 transition hover:border-gray-300 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold">
                        {workspace.name}
                      </h3>

                      <p className="mt-2 text-sm text-gray-500">
                        {workspace.description ||
                          "No description"}
                      </p>
                    </div>

                    <span className="text-gray-400">
                      →
                    </span>
                  </div>

                  <div className="mt-5 text-sm text-gray-400">
                    {workspace.projects.length} project
                    {workspace.projects.length !== 1
                      ? "s"
                      : ""}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* AI Activity */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
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
              <div className="text-2xl">
                🤖
              </div>

              <p className="mt-3 font-medium">
                No AI activity yet
              </p>

              <p className="mt-1 text-sm text-gray-400">
                Your AI activity will appear here as
                you use Pulse.
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
                        {getStatusLabel(
                          job.status
                        )}
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
        </section>

      </div>
    </main>
  );
}