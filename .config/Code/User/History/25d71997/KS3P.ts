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
      taskTitle: string;
    }
  | {
      type: "CREATE_PROJECT";
      workspaceId: string;
      name: string;
      description: string;
    }
  | null;

type HistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    const confirmDelete =
      body.confirmDelete === true;

    const taskId =
      typeof body.taskId === "string"
        ? body.taskId
        : "";

    const history: HistoryItem[] = Array.isArray(
      body.history
    )
      ? body.history
          .filter(
            (item: unknown): item is HistoryItem =>
              !!item &&
              typeof item === "object" &&
              "role" in item &&
              "content" in item &&
              (item.role === "user" ||
                item.role === "assistant") &&
              typeof item.content === "string"
          )
          .slice(-10)
      : [];

    const cookieStore = await cookies();

    const businessId =
      cookieStore.get("businessId");

    if (!businessId) {
      return NextResponse.json(
        {
          success: false,
          message: "You are not logged in.",
        },
        { status: 401 }
      );
    }

    const business =
      await prisma.business.findUnique({
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

    /*
     * CONFIRMED DELETE
     *
     * This happens BEFORE the AI is called.
     */

    if (confirmDelete) {
      if (!taskId) {
        return NextResponse.json(
          {
            success: false,
            message: "Task ID is required.",
          },
          { status: 400 }
        );
      }

      const task =
        await prisma.task.findFirst({
          where: {
            id: taskId,
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
            "I couldn't find that task. It may already have been deleted.",
          action: null,
        });
      }

      await prisma.task.delete({
        where: {
          id: task.id,
        },
      });

      return NextResponse.json({
        success: true,
        answer:
          `Deleted "${task.title}".`,
        action: {
          type: "DELETE_TASK",
          taskId: task.id,
        },
      });
    }

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          message: "Message is required.",
        },
        { status: 400 }
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
              tasks: {
                orderBy: {
                  createdAt: "asc",
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    const context = workspaces.map(
      (workspace) => ({
        id: workspace.id,
        name: workspace.name,

        projects: workspace.projects.map(
          (project) => ({
            id: project.id,
            name: project.name,
            description: project.description,

            tasks: project.tasks.map(
              (task) => ({
                id: task.id,
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
              })
            ),
          })
        ),
      })
    );

    const prompt = `
You are Pulse AI, the intelligent business assistant
inside the Pulse business management platform.

Understand natural human language.

BUSINESS:
${business.businessName}

BUSINESS TYPE:
${business.businessType}

CURRENT PULSE DATA:
${JSON.stringify(context, null, 2)}

RECENT CONVERSATION:
${JSON.stringify(history, null, 2)}

USER MESSAGE:
"${message}"

SUPPORTED ACTIONS:

CREATE_TASK
Create a task inside an existing project.

UPDATE_TASK_STATUS
Change an existing task between:
TODO
IN_PROGRESS
DONE

UPDATE_TASK_PRIORITY
Change an existing task priority between:
LOW
MEDIUM
HIGH

DELETE_TASK
Request deletion of an existing task.

CREATE_PROJECT
Create a project inside an existing workspace.

NATURAL LANGUAGE:

Understand casual language.

Examples:

"finish Business Registration"
→ UPDATE_TASK_STATUS → DONE

"I'm working on Business Registration"
→ UPDATE_TASK_STATUS → IN_PROGRESS

"make Business Registration urgent"
→ UPDATE_TASK_PRIORITY → HIGH

"remove Business Registration"
→ DELETE_TASK

"create a project for social media"
→ CREATE_PROJECT

"add a task to Marketing"
→ CREATE_TASK

ENTITY RULES:

- Match natural wording to existing entities.
- Exact names are preferred.
- Partial names are allowed when unambiguous.
- Never invent IDs.
- Never invent projects.
- Never invent tasks.
- Never invent workspaces.
- If multiple entities could match, ask for clarification.
- If an entity does not exist, do not invent it.

DELETION:

If the user asks to delete an existing task,
return DELETE_TASK.

The server will ask for confirmation.

Do NOT pretend the deletion has happened.

OUTPUT:

Return ONLY valid JSON.

Normal response:

{
  "answer": "Your concise response",
  "action": null
}

DELETE_TASK:

{
  "answer": "I found the task you want to delete.",
  "action": {
    "type": "DELETE_TASK",
    "taskId": "existing task id",
    "taskTitle": "existing task title"
  }
}

CREATE_TASK:

{
  "answer": "I'll add that task.",
  "action": {
    "type": "CREATE_TASK",
    "projectId": "existing project id",
    "title": "Task title",
    "description": "Task description",
    "priority": "MEDIUM"
  }
}

UPDATE_TASK_STATUS:

{
  "answer": "I'll update that task.",
  "action": {
    "type": "UPDATE_TASK_STATUS",
    "taskId": "existing task id",
    "status": "DONE"
  }
}

UPDATE_TASK_PRIORITY:

{
  "answer": "I'll update that task's priority.",
  "action": {
    "type": "UPDATE_TASK_PRIORITY",
    "taskId": "existing task id",
    "priority": "HIGH"
  }
}

CREATE_PROJECT:

{
  "answer": "I'll create that project.",
  "action": {
    "type": "CREATE_PROJECT",
    "workspaceId": "existing workspace id",
    "name": "Project name",
    "description": "Project description"
  }
}

If clarification is required:

{
  "answer": "Which task do you mean?",
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

    const action = parsed.action;

    /*
     * CREATE TASK
     */

    if (action?.type === "CREATE_TASK") {
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
            "I couldn't identify that project safely. Which project should I use?",
          action: null,
        });
      }

      const task =
        await prisma.$transaction(
          async (tx) => {
            const created =
              await tx.task.create({
                data: {
                  title: action.title,
                  description:
                    action.description,
                  projectId: project.id,
                  priority:
                    action.priority,
                },
              });

            await tx.taskActivity.create({
              data: {
                taskId: created.id,
                type: "CREATED",
                message:
                  `Task "${created.title}" was created by Pulse AI.`,
              },
            });

            return created;
          }
        );

      return NextResponse.json({
        success: true,
        answer:
          parsed.answer ||
          `Created "${task.title}".`,
        action: {
          type: "CREATE_TASK",
          task,
        },
      });
    }

    /*
     * UPDATE STATUS
     */

    if (
      action?.type ===
      "UPDATE_TASK_STATUS"
    ) {
      const task =
        await prisma.task.findFirst({
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

      const updated =
        await prisma.$transaction(
          async (tx) => {
            const result =
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
                message:
                  `Task status changed to ${action.status} by Pulse AI.`,
              },
            });

            return result;
          }
        );

      return NextResponse.json({
        success: true,
        answer:
          parsed.answer ||
          `Updated "${updated.title}".`,
        action: {
          type: "UPDATE_TASK_STATUS",
          task: updated,
        },
      });
    }

    /*
     * UPDATE PRIORITY
     */

    if (
      action?.type ===
      "UPDATE_TASK_PRIORITY"
    ) {
      const task =
        await prisma.task.findFirst({
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

      const updated =
        await prisma.$transaction(
          async (tx) => {
            const result =
              await tx.task.update({
                where: {
                  id: task.id,
                },
                data: {
                  priority:
                    action.priority,
                },
              });

            await tx.taskActivity.create({
              data: {
                taskId: task.id,
                type: "PRIORITY_CHANGED",
                message:
                  `Task priority changed to ${action.priority} by Pulse AI.`,
              },
            });

            return result;
          }
        );

      return NextResponse.json({
        success: true,
        answer:
          parsed.answer ||
          `Updated "${updated.title}".`,
        action: {
          type: "UPDATE_TASK_PRIORITY",
          task: updated,
        },
      });
    }

    /*
     * DELETE REQUEST
     */

    if (action?.type === "DELETE_TASK") {
      const task =
        await prisma.task.findFirst({
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

      return NextResponse.json({
        success: true,
        answer:
          `Are you sure you want to delete "${task.title}"?`,
        confirmation: {
          type: "DELETE_TASK",
          taskId: task.id,
          taskTitle: task.title,
        },
        action: null,
      });
    }

    /*
     * CREATE PROJECT
     */

    if (
      action?.type ===
      "CREATE_PROJECT"
    ) {
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
            "I couldn't identify that workspace safely.",
          action: null,
        });
      }

      const project =
        await prisma.project.create({
          data: {
            name: action.name,
            description:
              action.description,
            workspaceId:
              workspace.id,
          },
        });

      return NextResponse.json({
        success: true,
        answer:
          parsed.answer ||
          `Created "${project.name}".`,
        action: {
          type: "CREATE_PROJECT",
          project,
        },
      });
    }

    return NextResponse.json({
      success: true,
      answer:
        parsed.answer ||
        "I can help with that.",
      action: null,
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