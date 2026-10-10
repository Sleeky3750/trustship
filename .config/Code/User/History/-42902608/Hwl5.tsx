import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";
import { notFound, redirect } from "next/navigation";

import CreateProjectForm from "@/components/CreateProjectForm";
import WorkspaceActions from "@/components/WorkspaceActions";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function WorkspacePage({
  params,
}: PageProps) {
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
        orderBy: {
          createdAt: "desc",
        },
        include: {
          _count: {
            select: {
              tasks: true,
            },
          },
        },
      },
    },
  });

  if (!workspace) {
    notFound();
  }

  const projectCount = workspace.projects.length;

  const taskCount = workspace.projects.reduce(
    (total, project) =>
      total + project._count.tasks,
    0
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl p-6">

        {/* Navigation */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-500 hover:text-black"
          >
            ← Back to Dashboard
          </Link>

          <WorkspaceActions
            workspaceId={workspace.id}
            workspaceName={workspace.name}
          />
        </div>

        {/* Workspace Header */}
        <section className="rounded-2xl bg-black p-7 text-white shadow">
          <p className="text-sm text-gray-400">
            Workspace
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            {workspace.name}
          </h1>

          <p className="mt-3 max-w-2xl text-gray-300">
            {workspace.description ||
              "Organize projects and tasks for this workspace."}
          </p>

          <div className="mt-6 flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-gray-400">
                Projects
              </span>

              <p className="mt-1 text-xl font-semibold">
                {projectCount}
              </p>
            </div>

            <div>
              <span className="text-gray-400">
                Tasks
              </span>

              <p className="mt-1 text-xl font-semibold">
                {taskCount}
              </p>
            </div>
          </div>
        </section>

        {/* Create Project */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold">
            Create a project
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Turn work into projects, then manage tasks inside each project.
          </p>

          <div className="mt-5">
            <CreateProjectForm
              workspaceId={workspace.id}
            />
          </div>
        </section>

        {/* Projects */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">
              Projects
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Everything being worked on in this workspace.
            </p>
          </div>

          {workspace.projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
              <div className="text-3xl">
                📁
              </div>

              <h3 className="mt-3 font-semibold">
                No projects yet
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Create your first project above to start managing work.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {workspace.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/project/${project.id}`}
                  className="group rounded-xl border p-5 transition hover:border-black hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold group-hover:underline">
                        {project.name}
                      </h3>

                      <p className="mt-2 text-sm text-gray-500">
                        {project.description ||
                          "No description"}
                      </p>
                    </div>

                    <span className="text-gray-400">
                      →
                    </span>
                  </div>

                  <div className="mt-5 text-xs font-medium text-gray-400">
                    {project._count.tasks} task
                    {project._count.tasks !== 1
                      ? "s"
                      : ""}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}