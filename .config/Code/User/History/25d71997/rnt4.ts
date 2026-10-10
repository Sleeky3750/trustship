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
      type: "DELETE_PROJECT_TASKS";
      projectId: string;
      projectName: string;
      taskCount: number;
    }
  | {
      type: "CREATE_PROJECT";
      workspaceId: string;
      name: string;
      description: string;
    }
  | null;

type Confirmation =
  | {
      type: "DELETE_TASK";
      taskId: string;
      taskTitle: string;
    }
  | {
      type: "DELETE_PROJECT_TASKS";
      projectId: string;
      projectName: string;
      taskCount: number;
    }
  | null;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    const confirmDelete =
      body.confirmDelete === true;

    const confirmDeleteProjectTasks =
      body.confirmDeleteProjectTasks === true;

    const taskId =
      typeof body.taskId === "string"
        ? body.taskId
        : "";

    const projectId =
      typeof body.projectId === "string"
        ? body.projectId
        : "";

    /*
     * AUTH
     */

    const cookieStore = await cookies();

    const businessCookie =
      cookieStore.get("businessId");

    if (!businessCookie) {
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
          id: businessCookie.value,
        },
      });

    if (!business) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Business account not found.",
        },
        { status: 401 }
      );
    }

    /*
     * CONFIRM SINGLE DELETE
     */

    if (confirmDelete) {
      if (!taskId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Task ID is required.",
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
            "That task could not be found. It may already have been deleted.",
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

    /*
     * CONFIRM BULK DELETE
     */

    if (confirmDeleteProjectTasks) {
      if (!projectId) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Project ID is required.",
          },
          { status: 400 }
        );
      }

      const project =
        await prisma.project.findFirst({
          where: {
            id: projectId,
            workspace: {
              businessId: business.id,
            },
          },
          include: {
            tasks: true,
          },
        });

      if (!project) {
        return NextResponse.json({
          success: true,
          answer:
            "That project could not be found.",
          action: null,
        });
      }

      const taskCount =
        project.tasks.length;

      if (taskCount === 0) {
        return NextResponse.json({
          success: true,
          answer:
            `"${project.name}" has no tasks.`,
          action: null,
        });
      }

      await prisma.task.deleteMany({
        where: {
          projectId: project.id,
        },
      });

      return NextResponse.json({
        success: true,
        answer:
          `Deleted all ${taskCount} tasks from "${project.name}".`,
        action: {
          type: "DELETE_PROJECT_TASKS",
          projectId: project.id,
          projectName: project.name,
          taskCount,
        },
      });
    }

    /*
     * NORMAL MESSAGE
     */

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Message is required.",
        },
        { status: 400 }
      );
    }

    /*
     * LOAD BUSINESS CONTEXT
     */

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
            description:
              project.description,

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
              })
            ),
          })
        ),
      })
    );

    /*
     * CONVERSATION CONTEXT
     */

    const history = Array.isArray(
      body.history
    )
      ? body.history
          .filter(
            (item: unknown) =>
              item &&
              typeof item === "object" &&
              "role" in item &&
              "content" in item
          )
          .slice(-10)
      : [];

    /*
     * AI
     */

    const prompt = `
You are Pulse AI.

You are the intelligent business assistant
inside the Pulse business management platform.

Your job is to understand normal human language
and help the business owner manage their work.

BUSINESS
Name: ${business.businessName}
Type: ${business.businessType}

CURRENT PULSE DATA
${JSON.stringify(context, null, 2)}

RECENT CONVERSATION
${JSON.stringify(history, null, 2)}

USER MESSAGE
"${message}"

==================================================
UNDERSTANDING NATURAL LANGUAGE
==================================================

Understand meaning, not exact commands.

Examples:

"finish Business Registration"
means:
UPDATE_TASK_STATUS -> DONE

"I'm working on Business Registration"
means:
UPDATE_TASK_STATUS -> IN_PROGRESS

"make Business Registration urgent"
means:
UPDATE_TASK_PRIORITY -> HIGH

"remove Business Registration"
means:
DELETE_TASK

"delete all tasks in Instagram Marketing Campaign"
means:
DELETE_PROJECT_TASKS

"what should I work on?"
means:
Give a useful recommendation based on
priority, status and project progress.

"how are my projects doing?"
means:
Give a concise progress analysis.

"what is slowing me down?"
means:
Identify incomplete or blocked-looking work.

"what should I do next?"
means:
Recommend the most useful next task.

==================================================
SUPPORTED ACTIONS
==================================================

CREATE_TASK

UPDATE_TASK_STATUS

UPDATE_TASK_PRIORITY

DELETE_TASK

DELETE_PROJECT_TASKS

CREATE_PROJECT

==================================================
IMPORTANT SAFETY RULES
==================================================

Never invent IDs.

Never invent projects.

Never invent tasks.

Never invent workspaces.

Only use entities from CURRENT PULSE DATA.

If the user refers to an entity ambiguously,
ask a clarification question.

For DELETE_TASK:

Only identify ONE task.

For DELETE_PROJECT_TASKS:

The user must clearly mean ALL/EVERY tasks
inside one project.

Examples:

"delete all tasks in X"

"clear all tasks from X"

"remove every task in X"

"wipe the tasks in X"

Do NOT convert a bulk-delete request into
DELETE_TASK for the first task.

For destructive actions, never claim the action
has already happened.

The server handles confirmation and execution.

==================================================
PROJECT INTELLIGENCE
==================================================

When answering project questions consider:

- number of tasks
- completed tasks
- incomplete tasks
- priorities
- overdue-looking tasks
- tasks currently in progress
- projects with little progress
- high priority unfinished work

Be concise but useful.

==================================================
OUTPUT
==================================================

Return ONLY valid JSON.

Normal answer:

{
  "answer": "Your answer",
  "action": null
}

CREATE TASK:

{
  "answer": "I'll create that task.",
  "action": {
    "type": "CREATE_TASK",
    "projectId": "existing id",
    "title": "Task title",
    "description": "Task description",
    "priority": "MEDIUM"
  }
}

UPDATE STATUS:

{
  "answer": "I'll update that task.",
  "action": {
    "type": "UPDATE_TASK_STATUS",
    "taskId": "existing id",
    "status": "DONE"
  }
}

UPDATE PRIORITY:

{
  "answer": "I'll update that priority.",
  "action": {
    "type": "UPDATE_TASK_PRIORITY",
    "taskId": "existing id",
    "priority": "HIGH"
  }
}

DELETE TASK:

{
  "answer": "I found the task.",
  "action": {
    "type": "DELETE_TASK",
    "taskId": "existing id",
    "taskTitle": "existing title"
  }
}

DELETE ALL PROJECT TASKS:

{
  "answer": "I found the project and its tasks.",
  "action": {
    "type": "DELETE_PROJECT_TASKS",
    "projectId": "existing id",
    "projectName": "existing project name",
    "taskCount": 8
  }
}

CREATE PROJECT:

{
  "answer": "I'll create that project.",
  "action": {
    "type": "CREATE_PROJECT",
    "workspaceId": "existing workspace id",
    "name": "Project name",
    "description": "Project description"
  }
}

For normal questions:

{
  "answer": "Useful concise answer",
  "action": null
}

For ambiguity:

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

    const action =
      parsed.action ?? null;

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
            "I couldn't safely identify that project.",
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
                  projectId:
                    project.id,
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
                businessId:
                  business.id,
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
                  status:
                    action.status,
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
                businessId:
                  business.id,
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
     * DELETE ONE TASK
     */

    if (
      action?.type ===
      "DELETE_TASK"
    ) {
      const task =
        await prisma.task.findFirst({
          where: {
            id: action.taskId,
            project: {
              workspace: {
                businessId:
                  business.id,
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

      const confirmation: Confirmation =
        {
          type: "DELETE_TASK",
          taskId: task.id,
          taskTitle: task.title,
        };

      return NextResponse.json({
        success: true,
        answer:
          `Are you sure you want to delete "${task.title}"?`,
        confirmation,
        action: null,
      });
    }

    /*
     * DELETE ALL TASKS
     */

    if (
      action?.type ===
      "DELETE_PROJECT_TASKS"
    ) {
      const project =
        await prisma.project.findFirst({
          where: {
            id: action.projectId,
            workspace: {
              businessId:
                business.id,
            },
          },
          include: {
            tasks: true,
          },
        });

      if (!project) {
        return NextResponse.json({
          success: true,
          answer:
            "I couldn't safely identify that project.",
          action: null,
        });
      }

      const taskCount =
        project.tasks.length;

      if (taskCount === 0) {
        return NextResponse.json({
          success: true,
          answer:
            `"${project.name}" has no tasks to delete.`,
          action: null,
        });
      }

      const confirmation: Confirmation =
        {
          type:
            "DELETE_PROJECT_TASKS",
          projectId: project.id,
          projectName:
            project.name,
          taskCount,
        };

      return NextResponse.json({
        success: true,
        answer:
          `This will delete all ${taskCount} tasks in "${project.name}".`,
        confirmation,
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
            businessId:
              business.id,
          },
        });

      if (!workspace) {
        return NextResponse.json({
          success: true,
          answer:
            "I couldn't safely identify that workspace.",
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

    /*
     * NORMAL AI RESPONSE
     */

    return NextResponse.json({
      success: true,
      answer:
        parsed.answer ||
        "I'm ready to help.",
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