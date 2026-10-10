import { prisma } from "@/lib/prisma";

export async function getBusinessAIContext(
  businessId: string
) {
  const business =
    await prisma.business.findUnique({
      where: {
        id: businessId,
      },
    });

  if (!business) {
    throw new Error(
      "Business account not found."
    );
  }

  const workspaces =
    await prisma.workspace.findMany({
      where: {
        businessId,
      },
      include: {
        projects: {
          include: {
            tasks: {
              include: {
                activities: {
                  orderBy: {
                    createdAt: "desc",
                  },
                  take: 10,
                },
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

  const projects = workspaces.flatMap(
    (workspace) =>
      workspace.projects.map(
        (project) => ({
          id: project.id,
          name: project.name,
          description:
            project.description,
          workspaceId:
            workspace.id,
          workspaceName:
            workspace.name,

          tasks: project.tasks.map(
            (task) => ({
              id: task.id,
              title: task.title,
              description:
                task.description,
              status: task.status,
              priority:
                task.priority,
              dueDate:
                task.dueDate,
              createdAt:
                task.createdAt,

              activities:
                task.activities.map(
                  (activity) => ({
                    type:
                      activity.type,
                    message:
                      activity.message,
                    createdAt:
                      activity.createdAt,
                  })
                ),
            })
          ),
        })
      )
  );

  const allTasks = projects.flatMap(
    (project) => project.tasks
  );

  const completedTasks =
    allTasks.filter(
      (task) =>
        task.status === "DONE"
    );

  const inProgressTasks =
    allTasks.filter(
      (task) =>
        task.status ===
        "IN_PROGRESS"
    );

  const todoTasks =
    allTasks.filter(
      (task) =>
        task.status === "TODO"
    );

  const highPriorityTasks =
    allTasks.filter(
      (task) =>
        task.priority === "HIGH" &&
        task.status !== "DONE"
    );

  const mediumPriorityTasks =
    allTasks.filter(
      (task) =>
        task.priority === "MEDIUM" &&
        task.status !== "DONE"
    );

  const lowPriorityTasks =
    allTasks.filter(
      (task) =>
        task.priority === "LOW" &&
        task.status !== "DONE"
    );

  const now = new Date();

  const overdueTasks =
    allTasks.filter((task) => {
      if (!task.dueDate) {
        return false;
      }

      return (
        task.dueDate < now &&
        task.status !== "DONE"
      );
    });

  const projectSummaries =
    projects.map((project) => {
      const total =
        project.tasks.length;

      const completed =
        project.tasks.filter(
          (task) =>
            task.status === "DONE"
        ).length;

      const inProgress =
        project.tasks.filter(
          (task) =>
            task.status ===
            "IN_PROGRESS"
        ).length;

      const remaining =
        total - completed;

      const progress =
        total === 0
          ? 0
          : Math.round(
              (completed / total) *
                100
            );

      const highPriority =
        project.tasks.filter(
          (task) =>
            task.priority ===
              "HIGH" &&
            task.status !== "DONE"
        ).length;

      return {
        id: project.id,
        name: project.name,
        workspaceName:
          project.workspaceName,
        description:
          project.description,

        totalTasks: total,
        completedTasks: completed,
        inProgressTasks:
          inProgress,
        remainingTasks:
          remaining,

        highPriorityTasks:
          highPriority,

        progress,
      };
    });

  return {
    business: {
      id: business.id,
      name: business.businessName,
      type: business.businessType,
    },

    totals: {
      workspaces:
        workspaces.length,

      projects:
        projects.length,

      tasks:
        allTasks.length,

      completedTasks:
        completedTasks.length,

      inProgressTasks:
        inProgressTasks.length,

      todoTasks:
        todoTasks.length,

      highPriorityTasks:
        highPriorityTasks.length,

      mediumPriorityTasks:
        mediumPriorityTasks.length,

      lowPriorityTasks:
        lowPriorityTasks.length,

      overdueTasks:
        overdueTasks.length,
    },

    projectSummaries,

    projects,
  };
}