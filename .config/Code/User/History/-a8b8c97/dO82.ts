import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { askGroq } from "@/lib/ai/groq";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const mode =
      typeof body.mode === "string"
        ? body.mode
        : "GENERAL";

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

    const now = new Date();

    const workspaces = await prisma.workspace.findMany({
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

    const context = workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,

      projects: workspace.projects.map((project) => {
        const totalTasks = project.tasks.length;

        const completedTasks = project.tasks.filter(
          (task) => task.status === "DONE"
        ).length;

        const inProgressTasks = project.tasks.filter(
          (task) => task.status === "IN_PROGRESS"
        ).length;

        const overdueTasks = project.tasks.filter(
          (task) =>
            task.dueDate !== null &&
            task.dueDate < now &&
            task.status !== "DONE"
        );

        const highPriorityTasks = project.tasks.filter(
          (task) =>
            task.priority === "HIGH" &&
            task.status !== "DONE"
        );

        const progress =
          totalTasks > 0
            ? Math.round(
                (completedTasks / totalTasks) * 100
              )
            : 0;

        let health = "HEALTHY";

        if (overdueTasks.length > 0) {
          health = "AT_RISK";
        } else if (
          highPriorityTasks.length >= 2 &&
          progress < 50
        ) {
          health = "NEEDS_ATTENTION";
        }

        return {
          id: project.id,
          name: project.name,
          description: project.description,

          totalTasks,
          completedTasks,
          inProgressTasks,
          progress,

          overdueTasks: overdueTasks.map((task) => ({
            id: task.id,
            title: task.title,
            priority: task.priority,
            dueDate: task.dueDate,
          })),

          highPriorityTasks: highPriorityTasks.map(
            (task) => ({
              id: task.id,
              title: task.title,
              status: task.status,
              dueDate: task.dueDate,
            })
          ),

          health,

          tasks: project.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
          })),
        };
      }),
    }));

    let instruction = "";

    switch (mode) {
      case "TODAY":
        instruction = `
Tell the user what they should focus on today.

Prioritize:
1. Overdue tasks
2. HIGH priority tasks
3. IN_PROGRESS tasks
4. Important unfinished work

Give a short ranked list with reasons.
`;
        break;

      case "PROGRESS":
        instruction = `
Analyze the user's overall project progress.

Explain:
- completed work
- active work
- remaining work
- projects progressing well
- projects falling behind
- important concerns

Keep it concise and practical.
`;
        break;

      case "PRIORITIES":
        instruction = `
Analyze all unfinished work and rank what deserves attention first.

Consider:
- HIGH priority
- overdue tasks
- IN_PROGRESS tasks
- project progress
- obvious dependencies

Give a practical ranked recommendation.
`;
        break;

      case "HEALTH":
        instruction = `
Analyze the health of every project.

For each project:
- State whether it is HEALTHY, NEEDS ATTENTION, or AT RISK.
- Explain why.
- Mention overdue work when present.
- Mention important unfinished tasks.
- Give one practical recommendation.

At the end, identify the single project that needs the most attention.

Use the calculated health information supplied in the data.
Do not invent information.
`;
        break;

      default:
        instruction = `
Give a useful overview of the user's current business projects and tasks.

Highlight the most important things they should know right now.
`;
    }

    const prompt = `
You are Pulse AI, an intelligent business management assistant.

BUSINESS:
${business.businessName}

BUSINESS TYPE:
${business.businessType}

CURRENT DATE:
${now.toISOString()}

CURRENT PULSE DATA:
${JSON.stringify(context, null, 2)}

REQUEST TYPE:
${mode}

INSTRUCTIONS:
${instruction}

IMPORTANT RULES:
- Use only the supplied Pulse data.
- Never invent projects.
- Never invent tasks.
- Never invent deadlines.
- Never claim a task is overdue unless the data identifies it as overdue.
- Never invent progress numbers.
- Keep the answer concise.
- Use simple business-friendly language.
- Do not return JSON.
- Return normal text suitable for displaying inside Pulse.
`;

    const answer = await askGroq(prompt);

    return NextResponse.json({
      success: true,
      mode,
      answer,
    });
  } catch (error) {
    console.error(
      "Pulse AI analysis error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Pulse AI could not analyze your workspace.",
      },
      { status: 500 }
    );
  }
}