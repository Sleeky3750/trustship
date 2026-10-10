import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { askGroq } from "@/lib/ai/groq";

type AssistantAction =
  | {
      type: "CREATE_TASK";
      projectId: string;
      title: string;
      description: string;
      priority: "LOW" | "MEDIUM" | "HIGH";
    }
  | {
      type: "UPDATE_TASK_STATUS";
      taskId: string;
      status: "TODO" | "IN_PROGRESS" | "DONE";
    }
  | {
      type: "UPDATE_TASK_PRIORITY";
      taskId: string;
      priority: "LOW" | "MEDIUM" | "HIGH";
    }
  | {
      type: "DELETE_TASK";
      taskId: string;
    }
  | {
      type: "CREATE_PROJECT";
      workspaceId: string;
      name: string;
      description: string;
    }
  | null;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    const history = Array.isArray(body.history)
      ? body.history
      : [];

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          message: "Message is required.",
        },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const businessId = cookieStore.get("businessId");

    if (!businessId) {
      return NextResponse.json(
        {
          success: false,
          message: "You are not logged in.",
        },
        { status: 401 }
      );
    }

    const business = await prisma.business.findUnique({
      where: {
        id: businessId.value,
      },
    });

    if (!business) {
      return NextResponse.json(
        {
          success: false,
          message: "Business account not found.",
        },
        { status: 401 }
      );
    }

    const workspaces =
      await prisma.workspace.findMany({
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

    const context = workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      projects: workspace.projects.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        tasks: project.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
        })),
      })),
    }));

    const recentHistory = history
      .slice(-10)
      .filter(
        (item: unknown) =>
          item &&
          typeof item === "object" &&
          "role" in item &&
          "content" in item
      )
      .map(
        (item: {
          role: string;
          content: string;
        }) => ({
          role: item.role,
          content: item.content,
        })
      );

    const prompt = `
You are Pulse AI, the business assistant inside the
Pulse business management platform.

BUSINESS:
${business.businessName}

BUSINESS TYPE:
${business.businessType}

CURRENT PULSE DATA:
${JSON.stringify(context, null, 2)}

RECENT CONVERSATION:
${JSON.stringify(recentHistory, null, 2)}

USER MESSAGE:
"${message}"

You must determine whether the user is asking a normal
question or asking Pulse to perform a supported action.

SUPPORTED ACTIONS:

1. CREATE_TASK

Create a task inside an existing project.

Required:
- projectId
- title
- description
- priority

Priority must be:
LOW, MEDIUM, or HIGH.

2. UPDATE_TASK_STATUS

Change an existing task's status.

Required:
- taskId
- status

Status must be:
TODO, IN_PROGRESS, or DONE.

3. UPDATE_TASK_PRIORITY

Change an existing task's priority.

Required:
- taskId
- priority

Priority must be:
LOW, MEDIUM, or HIGH.

4. DELETE_TASK

Delete an existing task.

Required:
- taskId

Only use this when the user clearly asks to delete,
remove, permanently remove, or get rid of a task.

5. CREATE_PROJECT

Create a project inside an existing workspace.

Required:
- workspaceId
- name
- description

If the workspace cannot be confidently identified,
do not create the project.

IMPORTANT SAFETY RULES:

- Never invent IDs.
- Only use IDs that exist in CURRENT PULSE DATA.
- Never invent projects, workspaces, or tasks.
- If multiple tasks/projects could match the user's
  request and you cannot confidently determine which one,
  action must be null.
- If the user asks for an unsupported action, action must
  be null.
- Never claim an action was completed yourself.
- The server will execute the action after validation.
- For deletion, only produce DELETE_TASK when the user's
  intent is explicit.
- Keep answers concise.

Return ONLY valid JSON.

For a normal question:

{
  "answer": "Your answer",
  "action": null
}

For CREATE_TASK:

{
  "answer": "Creating the task...",
  "action": {
    "type": "CREATE_TASK",
    "projectId": "existing project id",
    "title": "Task title",
    "description": "What needs to be done",
    "priority": "MEDIUM"
  }
}

For UPDATE_TASK_STATUS:

{
  "answer": "Updating the task...",
  "action": {
    "type": "UPDATE_TASK_STATUS",
    "taskId": "existing task id",
    "status": "DONE"
  }
}

For UPDATE_TASK_PRIORITY:

{
  "answer": "Updating the task priority...",
  "action": {
    "type": "UPDATE_TASK_PRIORITY",
    "taskId": "existing task id",
    "priority": "HIGH"
  }
}

For DELETE_TASK:

{
  "answer": "Deleting the task...",
  "action": {
    "type": "DELETE_TASK",
    "taskId": "existing task id"
  }
}

For CREATE_PROJECT:

{
  "answer": "Creating the project...",
  "action": {
    "type": "CREATE_PROJECT",
    "workspaceId": "existing workspace id",
    "name": "Project name",
    "description": "Project description"
  }
}

If clarification is required:

{
  "answer": "Which project do you mean?",
  "action": null
}
`;

    const raw = await askGroq(prompt);

    let parsed: {
      answer?: string;
      action?: AssistantAction;
    };

    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({
        success: true,
        answer: raw,
        action: null,
      });
    }

    let actionResult: unknown = null;

    /*
     * CREATE TASK
     */
    if (parsed.action?.type === "CREATE_TASK") {
      const action = parsed.action;

      const project =
        await prisma.project.findFirst({
          where: {
            id: action.projectId,
            workspace: {
              businessId: business.id,
            },
          },
        });

      if (!project) {
        return NextResponse.json({
          success: true,
          answer:
            "I couldn't safely identify the project for that task. Which project should I add it to?",
          action: null,
        });
      }

      const task = await prisma.$transaction(
        async (tx) => {
          const createdTask =
            await tx.task.create({
              data: {
                title: action.title,
                description: action.description,
                projectId: project.id,
                priority: action.priority,
              },
            });

          await tx.taskActivity.create({
            data: {
              taskId: createdTask.id,
              type: "CREATED",
              message: `Task "${createdTask.title}" was created by Pulse AI.`,
            },
          });

          return createdTask;
        }
      );

      actionResult = {
        type: "CREATE_TASK",
        task,
      };
    }

    /*
     * UPDATE TASK STATUS
     */
    if (
      parsed.action?.type ===
      "UPDATE_TASK_STATUS"
    ) {
      const action = parsed.action;

      const task = await prisma.task.findFirst({
        where: {
          id: action.taskId,
          project: {
            workspace: {
              businessId: business.id,
            },
          },
        },
      });

      if (!task) {
        return NextResponse.json({
          success: true,
          answer:
            "I couldn't safely identify that task.",
          action: null,
        });
      }

      const updatedTask =
        await prisma.$transaction(
          async (tx) => {
            const updated =
              await tx.task.update({
                where: {
                  id: task.id,
                },
                data: {
                  status: action.status,
                },
              });

            await tx.taskActivity.create({
              data: {
                taskId: task.id,
                type: "STATUS_CHANGED",
                message: `Task status changed to ${action.status} by Pulse AI.`,
              },
            });

            return updated;
          }
        );

      actionResult = {
        type: "UPDATE_TASK_STATUS",
        task: updatedTask,
      };
    }

    /*
     * UPDATE TASK PRIORITY
     */
    if (
      parsed.action?.type ===
      "UPDATE_TASK_PRIORITY"
    ) {
      const action = parsed.action;

      const task = await prisma.task.findFirst({
        where: {
          id: action.taskId,
          project: {
            workspace: {
              businessId: business.id,
            },
          },
        },
      });

      if (!task) {
        return NextResponse.json({
          success: true,
          answer:
            "I couldn't safely identify that task.",
          action: null,
        });
      }

      const updatedTask =
        await prisma.$transaction(
          async (tx) => {
            const updated =
              await tx.task.update({
                where: {
                  id: task.id,
                },
                data: {
                  priority: action.priority,
                },
              });

            await tx.taskActivity.create({
              data: {
                taskId: task.id,
                type: "PRIORITY_CHANGED",
                message: `Task priority changed to ${action.priority} by Pulse AI.`,
              },
            });

            return updated;
          }
        );

      actionResult = {
        type: "UPDATE_TASK_PRIORITY",
        task: updatedTask,
      };
    }

    /*
     * DELETE TASK
     */
    if (parsed.action?.type === "DELETE_TASK") {
      const action = parsed.action;

      const task = await prisma.task.findFirst({
        where: {
          id: action.taskId,
          project: {
            workspace: {
              businessId: business.id,
            },
          },
        },
      });

      if (!task) {
        return NextResponse.json({
          success: true,
          answer:
            "I couldn't safely identify that task.",
          action: null,
        });
      }

      const deletedTask =
        await prisma.$transaction(
          async (tx) => {
            await tx.taskActivity.create({
              data: {
                taskId: task.id,
                type: "DELETED",
                message: `Task "${task.title}" was deleted by Pulse AI.`,
              },
            });

            return tx.task.delete({
              where: {
                id: task.id,
              },
            });
          }
        );

      actionResult = {
        type: "DELETE_TASK",
        task: deletedTask,
      };
    }

    /*
     * CREATE PROJECT
     */
    if (
      parsed.action?.type ===
      "CREATE_PROJECT"
    ) {
      const action = parsed.action;

      const workspace =
        await prisma.workspace.findFirst({
          where: {
            id: action.workspaceId,
            businessId: business.id,
          },
        });

      if (!workspace) {
        return NextResponse.json({
          success: true,
          answer:
            "I couldn't safely identify the workspace for that project. Which workspace should I use?",
          action: null,
        });
      }

      const project =
        await prisma.project.create({
          data: {
            name: action.name,
            description: action.description,
            workspaceId: workspace.id,
          },
        });

      actionResult = {
        type: "CREATE_PROJECT",
        project,
      };
    }

    return NextResponse.json({
      success: true,
      answer:
        parsed.answer ||
        "Done.",
      action: actionResult,
    });
  } catch (error) {
    console.error(
      "Pulse AI assistant error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Pulse AI could not process your message.",
      },
      { status: 500 }
    );
  }
}