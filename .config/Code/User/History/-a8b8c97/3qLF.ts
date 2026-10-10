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

    const now = new Date();

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
                priority: task.priority,
                dueDate: task.dueDate,
                overdue:
                  task.dueDate !== null &&
                  task.dueDate < now &&
                  task.status !== "DONE",
              })
            ),
          })
        ),
      })
    );

    let instruction = "";

    switch (mode) {
      case "TODAY":
        instruction = `
Tell the user what they should focus on today.

Prioritize:
1. HIGH priority tasks
2. Overdue tasks
3. IN_PROGRESS tasks
4. Tasks that are important for active projects

Give a practical short list.

Do not invent tasks.
`;
        break;

      case "PROGRESS":
        instruction = `
Analyze the user's overall business project progress.

Identify:
- projects with good progress
- projects that are falling behind
- completed work
- remaining work
- important blockers or concerns

Give a concise business-friendly summary.

Do not invent information.
`;
        break;

      case "PRIORITIES":
        instruction = `
Analyze all current tasks and tell the user what deserves attention first.

Consider:
- HIGH priority
- overdue tasks
- IN_PROGRESS tasks
- project importance
- dependencies implied by task descriptions

Give a ranked practical recommendation.

Do not invent information.
`;
        break;

      default:
        instruction = `
Give a useful overview of the user's current projects and tasks.

Highlight the most important things they should know right now.

Do not invent information.
`;
    }

    const prompt = `
You are Pulse AI, an intelligent business management
assistant.

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

IMPORTANT:
- Use only the supplied Pulse data.
- Never invent projects or tasks.
- Never invent deadlines.
- Never claim something is overdue unless the supplied data says overdue=true.
- Keep the response concise and practical.
- Use simple language.
- Do not return JSON.
- Return normal text suitable for displaying directly inside the Pulse dashboard.
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