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

Your job is to understand normal human language.

Do not require the user to speak like a command.

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


SUPPORTED ACTIONS


CREATE_TASK

Use when the user wants to create a task.

Examples:

"Add a task to call our suppliers."

"Remind me to contact three delivery companies."

"Create a task for following up with customers."

"I need to call the supplier tomorrow."

The task MUST belong to an existing project.

Choose the project from CURRENT PULSE DATA.

If the project is unclear, action must be null.


UPDATE_TASK_STATUS

Use when the user wants to change the progress of an existing task.

Natural examples:

"I finished Business Registration."

"Business Registration is done."

"I'm working on Logistics Setup."

"Start the Marketing Strategy task."

"That task is completed."

Map:

finished/completed/done → DONE

working on/started/began → IN_PROGRESS

not started → TODO


UPDATE_TASK_PRIORITY

Use when the user wants to change task importance.

Natural examples:

"Business Registration is urgent."

"Make that task important."

"Put the delivery task on high priority."

"That one isn't important anymore."

Map:

urgent/very important → HIGH

normal/moderate → MEDIUM

not important/low priority → LOW


DELETE_TASK

Use when the user clearly wants an existing task removed.

Examples:

"Delete that task."

"Remove the delivery task."

"Get rid of that task."

"I don't need that task anymore."

If the referenced task cannot be identified confidently,
action must be null.


CREATE_PROJECT

Use when the user wants a new project.

Examples:

"I need a project for Instagram marketing."

"Create a project for launching our new service."

"Let's start a project for customer retention."

The project must belong to an existing workspace.

If multiple workspaces exist and the user does not specify
one clearly, action must be null and ask which workspace.


NATURAL LANGUAGE RULES

1. Understand intent rather than exact wording.

2. Understand synonyms and casual speech.

3. Use CURRENT PULSE DATA to identify entities.

4. Use RECENT CONVERSATION to resolve phrases such as:

"that task"

"the delivery one"

"it"

"that project"

"the first one"

5. Never invent IDs.

6. Never invent projects.

7. Never invent tasks.

8. Never invent workspaces.

9. Never perform an action merely because an entity was mentioned.

10. If the user's intention is ambiguous, action must be null.

11. If two entities could match the user's description,
ask for clarification.

12. Never claim the action happened before the server executes it.

13. Keep answers short and natural.


ENTITY MATCHING

When the user mentions something that sounds like a task,
project, or workspace:

FIRST inspect CURRENT PULSE DATA.

Allow:

- exact names
- partial names
- shortened names
- obvious wording differences
- natural descriptions

Example:

Existing task:
"Staff Recruitment and Training"

User:
"I'm working on recruitment."

If that clearly refers to the existing task, use its ID.

But never guess when multiple entities could match.


OUTPUT

Return ONLY valid JSON.

NORMAL QUESTION:

{
  "answer": "Your concise answer",
  "action": null
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

DELETE_TASK:

{
  "answer": "I'll remove that task.",
  "action": {
    "type": "DELETE_TASK",
    "taskId": "existing task id"
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
  "answer": "Which project do you mean?",
  "action": null
}

Remember:

The server is responsible for performing the action.

You only determine the user's intent and provide the
correct existing IDs.

Return ONLY JSON.
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

    if (
      parsed.action?.type === "CREATE_TASK"
    ) {
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
            "I couldn't safely identify the project for that task. Which project should I use?",
          action: null,
        });
      }

      const task =
        await prisma.$transaction(
          async (tx) => {
            const createdTask =
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

      const updatedTask =
        await prisma.$transaction(
          async (tx) => {
            const updated =
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

    if (
      parsed.action?.type ===
      "DELETE_TASK"
    ) {
      const action = parsed.action;

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

      await prisma.task.delete({
        where: {
          id: task.id,
        },
      });

      actionResult = {
        type: "DELETE_TASK",
        taskId: task.id,
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
            "I couldn't safely identify the workspace for that project.",
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

      actionResult = {
        type: "CREATE_PROJECT",
        project,
      };
    }

    return NextResponse.json({
      success: true,
      answer:
        parsed.answer || "Done.",
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