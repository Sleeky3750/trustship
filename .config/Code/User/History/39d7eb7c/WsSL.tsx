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
    <ProjectWorkspace
      project={{
  id: project.id,
  name: project.name,
  description: project.description,
  workspaceId: project.workspace.id,
  workspaceName: project.workspace.name,
}}
      initialTasks={tasks}
    />
  );
}