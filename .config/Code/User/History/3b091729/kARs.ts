import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ProjectPlan = {
  name: string;
  description: string;
  tasks: {
    title: string;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
  }[];
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.jobId) {
      return NextResponse.json(
        {
          success: false,
          message: "jobId is required",
        },
        { status: 400 }
      );
    }

    if (!body.workspaceId) {
      return NextResponse.json(
        {
          success: false,
          message: "workspaceId is required",
        },
        { status: 400 }
      );
    }

    const job = await prisma.aIJob.findUnique({
      where: {
        id: body.jobId,
      },
    });

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          message: "AI job not found",
        },
        { status: 404 }
      );
    }

    if (job.type !== "PROJECT_PLANNING") {
      return NextResponse.json(
        {
          success: false,
          message:
            "AI job is not a project planning job",
        },
        { status: 400 }
      );
    }

    if (job.status !== "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          message: "AI job has not completed yet",
        },
        { status: 400 }
      );
    }

    if (!job.output || typeof job.output !== "object") {
      return NextResponse.json(
        {
          success: false,
          message: "AI job has no project plan",
        },
        { status: 400 }
      );
    }

    const originalOutput = job.output as Partial<ProjectPlan>;

    const plan = body.plan as Partial<ProjectPlan> | undefined;

    const output: ProjectPlan = {
      name:
        typeof plan?.name === "string"
          ? plan.name.trim()
          : typeof originalOutput.name === "string"
            ? originalOutput.name.trim()
            : "",

      description:
        typeof plan?.description === "string"
          ? plan.description.trim()
          : typeof originalOutput.description ===
              "string"
            ? originalOutput.description.trim()
            : "",

      tasks: Array.isArray(plan?.tasks)
        ? plan.tasks
            .filter(
              (task) =>
                task &&
                typeof task.title === "string" &&
                typeof task.description ===
                  "string" &&
                ["LOW", "MEDIUM", "HIGH"].includes(
                  task.priority
                )
            )
            .map((task) => ({
              title: task.title.trim(),
              description: task.description.trim(),
              priority: task.priority,
            }))
            .filter(
              (task) =>
                task.title.length > 0 &&
                task.description.length > 0
            )
        : [],
    };

    if (!output.name) {
      return NextResponse.json(
        {
          success: false,
          message: "Project name is required",
        },
        { status: 400 }
      );
    }

    if (!output.description) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Project description is required",
        },
        { status: 400 }
      );
    }

    if (output.tasks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "At least one valid task is required",
        },
        { status: 400 }
      );
    }

    const workspace = await prisma.workspace.findUnique(
      {
        where: {
          id: body.workspaceId,
        },
      }
    );

    if (!workspace) {
      return NextResponse.json(
        {
          success: false,
          message: "Workspace not found",
        },
        { status: 404 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name: output.name,
        description: output.description,
        workspaceId: body.workspaceId,
        tasks: {
          create: output.tasks.map((task) => ({
            title: task.title,
            description: task.description,
            priority: task.priority,
          })),
        },
      },
      include: {
        tasks: true,
      },
    });

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    console.error(
      "AI project creation error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to create project from AI plan",
      },
      { status: 500 }
    );
  }
}