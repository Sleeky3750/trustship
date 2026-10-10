import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";
import CreateProjectForm from "@/components/CreateProjectForm";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function WorkspacePage({ params }: PageProps) {
  const business = await getCurrentBusiness();

  if (!business) {
    redirect("/login");
  }

  const { id } = await params;

  const workspace = await prisma.workspace.findFirst({
    where: {
      id,
      businessId: business.id,
    },
    include: {
      projects: {
        include: {
          tasks: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!workspace) {
    notFound();
  }

  const totalTasks = workspace.projects.reduce(
    (sum, project) => sum + project.tasks.length,
    0
  );

  const openTasks = workspace.projects.reduce(
    (sum, project) =>
      sum +
      project.tasks.filter((task) => task.status !== "DONE").length,
    0
  );

  return (
    <main className="min-h-screen bg-[#f7f8fa]">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        {/* Top navigation */}
        <header className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-xl font-semibold tracking-tight text-gray-950"
          >
            Pulse
          </Link>

          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-500 transition hover:text-gray-950"
          >
            ← Dashboard
          </Link>
        </header>

        {/* Workspace header */}
        <section className="mt-12">
          <p className="text-sm font-medium text-gray-500">
            Workspace
          </p>

          <div className="mt-2 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">
                {workspace.name}
              </h1>

              <p className="mt-3 max-w-2xl text-gray-500">
                {workspace.description ||
                  "Keep your projects and tasks organized in one place."}
              </p>
            </div>

            <div className="flex gap-3 text-sm text-gray-500">
              <span className="rounded-full border border-gray-200 bg-white px-4 py-2">
                {workspace.projects.length} project
                {workspace.projects.length !== 1 ? "s" : ""}
              </span>

              <span className="rounded-full border border-gray-200 bg-white px-4 py-2">
                {openTasks} open task
                {openTasks !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </section>

        {/* Workspace stats */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-500">Projects</p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {workspace.projects.length}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-500">Total tasks</p>
            <p className="mt-2 text-3xl font-semibold text-gray-950">
              {totalTasks}
            </p>
          </div>
        </section>

        {/* Create project */}
        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-gray-950">
            Create a project
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Start a focused piece of work inside this workspace.
          </p>

          <div className="mt-6">
            <CreateProjectForm workspaceId={workspace.id} />
          </div>
        </section>

        {/* Projects */}
        <section className="mt-10">
          <div>
            <h2 className="text-xl font-semibold text-gray-950">
              Projects
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Everything being worked on in this workspace.
            </p>
          </div>

          <div className="mt-6">
            {workspace.projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
                <h3 className="text-lg font-semibold text-gray-950">
                  No projects yet
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  Create your first project above to start organizing work.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {workspace.projects.map((project) => {
                  const projectOpenTasks = project.tasks.filter(
                    (task) => task.status !== "DONE"
                  ).length;

                  return (
                    <Link
                      key={project.id}
                      href={`/project/${project.id}`}
                      className="group rounded-2xl border border-gray-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-950">
                            {project.name}
                          </h3>

                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-500">
                            {project.description ||
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
                            {project.tasks.length}
                          </strong>{" "}
                          task
                          {project.tasks.length !== 1 ? "s" : ""}
                        </span>

                        <span>
                          <strong className="font-semibold text-gray-900">
                            {projectOpenTasks}
                          </strong>{" "}
                          open
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <footer className="mt-12 border-t border-gray-200 py-8">
          <Link
            href="/dashboard"
            className="text-sm text-gray-400 transition hover:text-gray-700"
          >
            ← Back to dashboard
          </Link>
        </footer>
      </div>
    </main>
  );
}

