import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { askGroq } from "@/lib/ai/groq";

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
          message: "Message is required",
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
          message: "You are not logged in",
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
          message: "Business account not found",
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
      workspace: workspace.name,
      projects: workspace.projects.map(
        (project) => ({
          name: project.name,
          description: project.description,
          tasks: project.tasks.map((task) => ({
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
You are Pulse AI, the business assistant inside the Pulse
business management platform.

You are speaking directly with the business owner.

BUSINESS:
Name: ${business.businessName}
Business type: ${business.businessType}

CURRENT PULSE DATA:
${JSON.stringify(context, null, 2)}

RECENT CONVERSATION:
${JSON.stringify(recentHistory, null, 2)}

USER'S NEW MESSAGE:
"${message}"

INSTRUCTIONS:

- Give practical, useful answers.
- Use the Pulse data when relevant.
- Do not invent projects, tasks, customers, revenue, deadlines, or business facts.
- If information is missing, clearly say so.
- Keep normal answers concise and easy to read.
- You can help with planning, prioritization, task management,
  business ideas, project progress, marketing, operations,
  and general business decisions.
- If the user asks what they should work on, prioritize HIGH
  priority and IN_PROGRESS tasks appropriately.
- If the user asks about progress, use the actual project/task
  information provided above.
- You cannot directly modify the database from this chat.
- Never claim that you created, deleted, updated, or completed
  anything unless a real API action has actually done it.
- Do not use markdown tables.
- Use short headings or bullet points when they improve clarity.

Answer the user's message now.
`;

    const answer = await askGroq(prompt);

    return NextResponse.json({
      success: true,
      answer,
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