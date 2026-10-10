import Link from "next/link";
import ProjectWorkspace from "@/components/project/ProjectWorkspace";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";
import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProjectPage({
  params,
}: PageProps) {
  const business = await getCurrentBusiness();

  if (!business) {
    redirect("/login");
  }

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id,
      workspace: {
        businessId: business.id,
      },
    },
    include: {
      workspace: true,

      tasks: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const tasks = project.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,

    status: task.status as
      | "TODO"
      | "IN_PROGRESS"
      | "DONE",

    priority: task.priority as
      | "LOW"
      | "MEDIUM"
      | "HIGH",

    dueDate: task.dueDate,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    projectId: task.projectId,
  }));

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl p-6">

        {/* Breadcrumb navigation */}
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          <Link
            href="/dashboard"
            className="text-gray-500 hover:text-black"
          >
            Dashboard
          </Link>

          <span className="text-gray-300">
            /
          </span>

          <Link
            href={`/workspace/${project.workspaceId}`}
            className="text-gray-500 hover:text-black"
          >
            {project.workspace.name}
          </Link>

          <span className="text-gray-300">
            /
          </span>

          <span className="font-medium">
            {project.name}
          </span>
        </div>

        {/* Project header */}
        <section className="mb-6 rounded-2xl bg-white p-6 shadow">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-400">
                Project
              </p>

              <h1 className="mt-1 text-3xl font-bold">
                {project.name}
              </h1>

              <p className="mt-2 text-gray-500">
                {project.description ||
                  "Manage tasks and track progress for this project."}
              </p>
            </div>

            <Link
              href={`/workspace/${project.workspaceId}`}
              className="hidden rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 sm:block"
            >
              ← Workspace
            </Link>
          </div>

          <div className="mt-5 text-sm text-gray-400">
            {tasks.length} task
            {tasks.length !== 1 ? "s" : ""}
          </div>
        </section>

        {/* Existing project/task management */}
        <ProjectWorkspace
          project={{
            id: project.id,
            name: project.name,
            description: project.description,
            workspaceName: project.workspace.name,
          }}
          initialTasks={tasks}
        />
      </div>
    </main>
  );
}