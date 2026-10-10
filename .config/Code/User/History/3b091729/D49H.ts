import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
          message: "AI job is not a project planning job",
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

    const output = job.output as {
      name?: string;
      description?: string;
      tasks?: {
        title?: string;
        description?: string;
        priority?: "LOW" | "MEDIUM" | "HIGH";
      }[];
    };

    if (
      !output.name ||
      !output.description ||
      !Array.isArray(output.tasks)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "AI project plan is invalid",
        },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name: output.name,
        description: output.description,
        workspaceId: body.workspaceId,
        tasks: {
          create: output.tasks
            .filter(
              (task) =>
                task.title &&
                task.description &&
                task.priority
            )
            .map((task) => ({
              title: task.title!,
              description: task.description!,
              priority: task.priority!,
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
        message: "Failed to create project from AI plan",
      },
      { status: 500 }
    );
  }
}