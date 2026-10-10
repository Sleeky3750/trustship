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
      projects: workspace.projects.map(
        (project) => ({
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
        })
      ),
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
You are Pulse AI, the business assistant inside
the Pulse business management platform.

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

Your job is to understand whether the user is:

1. Asking a normal question.
2. Asking Pulse to perform a supported action.

SUPPORTED ACTIONS:

CREATE_TASK
- Create a new task inside an existing project.
- You must identify the correct project from the provided data.
- If the project cannot be identified confidently, do not create the task.

UPDATE_TASK_STATUS
- Change an existing task status.
- Allowed statuses:
  TODO
  IN_PROGRESS
  DONE
- You must identify the correct existing task.
- If the task cannot be identified confidently, do not update it.

If the request is not a supported action, action must be null.

Return ONLY valid JSON using exactly this structure:

{
  "answer": "Your response to the user",
  "action": null
}

OR:

{
  "answer": "Short confirmation of the action",
  "action": {
    "type": "CREATE_TASK",
    "projectId": "existing project id",
    "title": "Task title",
    "description": "Task description",
    "priority": "MEDIUM"
  }
}

OR:

{
  "answer": "Short confirmation of the action",
  "action": {
    "type": "UPDATE_TASK_STATUS",
    "taskId": "existing task id",
    "status": "DONE"
  }
}

IMPORTANT:
- Never invent IDs.
- Never invent projects or tasks.
- Never claim an action was completed.
- The server will perform the action after validating it.
- If the user's request is ambiguous, action must be null and ask a clarification question in answer.
- Keep answer concise.
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