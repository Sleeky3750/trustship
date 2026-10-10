import { redirect } from "next/navigation";
import { getCurrentBusiness } from "@/lib/auth/business";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import LogoutButton from "@/components/LogoutButton";
import CreateWorkspaceForm from "@/components/CreateWorkspaceForm";
import PulseAiPanel from "@/components/ai/PulseAiPanel";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const business = await getCurrentBusiness();

if (!business) {
  redirect("/login");
}
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
      projects: {
        include: {
          tasks: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const projectCount = workspaces.reduce(
    (sum, workspace) => sum + workspace.projects.length,
    0
  );

  const taskCount = workspaces.reduce(
    (sum, workspace) =>
      sum +
      workspace.projects.reduce(
        (projectSum, project) => projectSum + project.tasks.length,
        0
      ),
    0
  );

  const openTaskCount = workspaces.reduce(
    (sum, workspace) =>
      sum +
      workspace.projects.reduce(
        (projectSum, project) =>
          projectSum +
          project.tasks.filter((task) => task.status !== "DONE").length,
        0
      ),
    0
  );

  return (
    <main className="min-h-screen bg-[#f7f8fa]">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-xl font-semibold tracking-tight text-gray-950"
            >
              Pulse
            </Link>

            <p className="mt-1 text-sm text-gray-500">
              Your business, organized.
            </p>
          </div>

          <LogoutButton />
        </header>

        {/* Welcome */}
        <section className="mt-12">
          <p className="text-sm font-medium text-gray-500">
            {business.businessName}
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">
            Welcome back.
          </h1>

          <p className="mt-3 max-w-2xl text-gray-500">
            Keep your work moving, or tell Pulse what you want to accomplish.
          </p>
        </section>

        {/* Stats */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-500">Workspaces</p>
            <p className="mt-3 text-3xl font-semibold text-gray-950">
              {workspaces.length}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-500">Projects</p>
            <p className="mt-3 text-3xl font-semibold text-gray-950">
              {projectCount}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-500">Open tasks</p>
            <p className="mt-3 text-3xl font-semibold text-gray-950">
              {openTaskCount}
            </p>
          </div>
        </section>

        {/* Pulse */}
        <section className="mt-8">
          <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-6 sm:px-8">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-950 text-lg text-white">
                  ✦
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Your business assistant
                  </p>

                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-gray-950">
                    What can Pulse help you accomplish?
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                    Ask about your work, understand what needs attention, plan
                    your next move, or let Pulse help organize the work ahead.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-6 sm:px-8">
              <PulseAiPanel />
            </div>
          </div>
        </section>

        {/* Workspace section */}
        <section className="mt-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-950">
                Your workspaces
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Organize your business into focused areas of work.
              </p>
            </div>
          </div>

          <div className="mt-6">
            {workspaces.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
                <h3 className="text-lg font-semibold text-gray-950">
                  Create your first workspace
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                  Start by creating a workspace for a team, department,
                  project area, or part of your business.
                </p>

                <div className="mx-auto mt-6 max-w-md text-left">
                  <CreateWorkspaceForm />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {workspaces.map((workspace) => {
                  const workspaceTaskCount = workspace.projects.reduce(
                    (sum, project) => sum + project.tasks.length,
                    0
                  );

                  const workspaceOpenTasks = workspace.projects.reduce(
                    (sum, project) =>
                      sum +
                      project.tasks.filter(
                        (task) => task.status !== "DONE"
                      ).length,
                    0
                  );

                  return (
                    <Link
                      key={workspace.id}
                      href={`/workspace/${workspace.id}`}
                      className="group rounded-2xl border border-gray-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-950">
                            {workspace.name}
                          </h3>

                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-500">
                            {workspace.description ||
                              "No description added yet."}
                          </p>
                        </div>

                        <span className="text-lg text-gray-300 transition group-hover:text-gray-600">
                          →
                        </span>
                      </div>

                      <div className="mt-6 flex items-center gap-5 text-sm text-gray-500">
                        <span>
                          <strong className="font-semibold text-gray-900">
                            {workspace.projects.length}
                          </strong>{" "}
                          project
                          {workspace.projects.length !== 1 ? "s" : ""}
                        </span>

                        <span>
                          <strong className="font-semibold text-gray-900">
                            {workspaceOpenTasks}
                          </strong>{" "}
                          open task
                          {workspaceOpenTasks !== 1 ? "s" : ""}
                        </span>

                        <span className="ml-auto text-gray-400">
                          {workspaceTaskCount} total
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Create workspace */}
        {workspaces.length > 0 && (
          <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-gray-950">
              Create another workspace
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Add another area of your business when you need one.
            </p>

            <div className="mt-6">
              <CreateWorkspaceForm />
            </div>
          </section>
        )}

        {/* Footer summary */}
        <footer className="mt-12 border-t border-gray-200 py-8">
          <p className="text-sm text-gray-400">
            {taskCount} total task{taskCount !== 1 ? "s" : ""} across your
            business.
          </p>
        </footer>
      </div>
    </main>
  );
}

