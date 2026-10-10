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
You are Pulse AI, an intelligent business management assistant.

Your job is to understand what the user means in natural human language and,
when appropriate, convert their request into one supported action.

Do NOT require the user to use exact command words.
Understand casual wording, shortened sentences, implied intent, and references
to tasks or projects from the provided Pulse data.

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


========================
SUPPORTED ACTIONS
========================

CREATE_TASK

Use when the user wants Pulse to create/add a new task.

Examples:

"Add a task to call three customers."

"Create something for following up with customers."

"I need to remember to contact our suppliers."

"Put a task under Logistics Setup to call delivery partners."

The task must belong to an existing project.

Choose the project from CURRENT PULSE DATA.

If the project is not clear enough, action must be null and ask the user
which project they mean.


UPDATE_TASK_STATUS

Use when the user wants to change the status/progress of an existing task.

Understand natural phrases such as:

"I finished Business Registration."
→ DONE

"Business Registration is completed."
→ DONE

"I'm working on Business Registration."
→ IN_PROGRESS

"I've started working on Business Registration."
→ IN_PROGRESS

"Business Registration hasn't been started."
→ TODO

"Mark Business Registration as done."
→ DONE

Allowed statuses:

TODO
IN_PROGRESS
DONE


UPDATE_TASK_PRIORITY

Use when the user wants to change how urgent/important an existing task is.

Understand natural phrases such as:

"Business Registration is urgent."
→ HIGH

"Make Business Registration a priority."
→ HIGH

"Business Registration isn't that important."
→ LOW

"Make the delivery task medium priority."
→ MEDIUM

"That task should be high priority."
→ HIGH

Allowed priorities:

LOW
MEDIUM
HIGH


DELETE_TASK

Use when the user clearly wants an existing task removed.

Understand phrases such as:

"Delete that task."

"Remove the delivery task."

"Get rid of the customer follow-up task."

"I don't need that task anymore."

"Take that task off my list."

Only use DELETE_TASK when the user's intention to remove the task is clear.

If "that task", "the delivery task", "it", etc. refers to something from the
recent conversation, use the conversation and CURRENT PULSE DATA to resolve it.

If the reference cannot be resolved confidently, action must be null and ask
for clarification.


CREATE_PROJECT

Use when the user wants to create a new project.

Understand phrases such as:

"I need a new project for Instagram marketing."

"Let's start an Instagram campaign project."

"Create a project for launching our new service."

"I want somewhere to organize our marketing work."

The project must belong to an existing workspace.

If the workspace is obvious from CURRENT PULSE DATA, use it.

If multiple workspaces exist and the user does not specify which one,
ask for clarification instead of guessing.


========================
NATURAL LANGUAGE RULES
========================

1. Understand meaning, not exact wording.

2. Treat synonyms as equivalent.

Examples:

finished = completed = done

urgent = important = priority = high priority

start = begin = working on = in progress

remove = delete = get rid of = take off the list

create = add = make = start

3. Understand conversational references.

Examples:

"Make that one urgent."

"Delete the delivery one."

"I finished it."

"Put that on high priority."

Use RECENT CONVERSATION and CURRENT PULSE DATA to resolve references.

4. Never invent IDs.

5. Never invent task names, project names, or workspace names.

6. When matching a user's wording to an existing task/project, allow small
differences in wording.

For example:

User: "the delivery setup task"

Existing task: "Logistics Setup"

If the match is clearly supported by the data, use the existing ID.

7. Do not perform an action merely because the user mentions a task.

Example:

"Business Registration is taking too long."

This is NOT automatically a status or priority change.

8. If the user's intention is unclear, action must be null.

9. Never claim an action was completed before the server executes it.

10. Keep answers short and natural.

11. If the user asks a normal question about their business, projects or tasks,
do NOT create an action.

12. If the user asks for analysis, summaries, recommendations, or information,
return action null.


========================
IMPORTANT ENTITY MATCHING
========================

When the user refers to a task, project, or workspace:

FIRST look at CURRENT PULSE DATA.

Try to match the user's wording to the existing entity.

Consider:

- exact name
- partial name
- obvious shortened name
- natural synonyms
- recent conversation references

Do not invent an entity simply because the user asks for one.

If two existing entities could reasonably match, ask the user to clarify.


========================
OUTPUT FORMAT
========================

Return ONLY valid JSON.

For a normal conversation:

{
  "answer": "Your concise response",
  "action": null
}

For CREATE_TASK:

{
  "answer": "I'll add that task.",
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
  "answer": "I'll update that task.",
  "action": {
    "type": "UPDATE_TASK_STATUS",
    "taskId": "existing task id",
    "status": "DONE"
  }
}

For UPDATE_TASK_PRIORITY:

{
  "answer": "I'll update that task's priority.",
  "action": {
    "type": "UPDATE_TASK_PRIORITY",
    "taskId": "existing task id",
    "priority": "HIGH"
  }
}

For DELETE_TASK:

{
  "answer": "I'll remove that task.",
  "action": {
    "type": "DELETE_TASK",
    "taskId": "existing task id"
  }
}

For CREATE_PROJECT:

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

The server performs the action.

You only identify the user's intent and provide the correct action data.

Never invent IDs.

Never invent entities.

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