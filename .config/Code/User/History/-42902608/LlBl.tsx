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
      },
    },
  });

  if (!workspace) {
    notFound();
  }

  const projectCount = workspace.projects.length;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl p-6">

        {/* Navigation */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-500 transition hover:text-black"
          >
            ← Back to Dashboard
          </Link>

          <WorkspaceActions
            workspaceId={workspace.id}
            workspaceName={workspace.name}
          />
        </div>

        {/* Workspace Header */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">
                WORKSPACE
              </p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight">
                {workspace.name}
              </h1>

              <p className="mt-3 max-w-2xl text-gray-600">
                {workspace.description ||
                  "Organize your projects and tasks in this workspace."}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Projects
              </p>

              <p className="mt-1 text-2xl font-bold">
                {projectCount}
              </p>
            </div>
          </div>
        </section>

        {/* Create Project */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold">
              Create Project
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Start a new project inside this workspace.
            </p>
          </div>

          <CreateProjectForm
            workspaceId={workspace.id}
          />
        </section>

        {/* Projects */}
        <section className="mt-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Projects
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Projects belonging to {workspace.name}.
              </p>
            </div>

            {projectCount > 0 && (
              <span className="text-sm text-gray-400">
                {projectCount} project
                {projectCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {projectCount === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
              <div className="text-4xl">
                📁
              </div>

              <h3 className="mt-4 text-lg font-semibold">
                No projects yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                Create your first project above. Once
                you have a project, you can start adding
                tasks and tracking progress.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {workspace.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/project/${project.id}`}
                  className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold transition group-hover:text-blue-600">
                        {project.name}
                      </h3>

                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-600">
                        {project.description ||
                          "No description provided."}
                      </p>
                    </div>

                    <span className="shrink-0 text-gray-400 transition group-hover:translate-x-1 group-hover:text-black">
                      →
                    </span>
                  </div>

                  <div className="mt-5 border-t pt-4 text-xs text-gray-400">
                    Open project
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