import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";

export async function POST(request: Request) {
  try {
    const business = await getCurrentBusiness();

    if (!business) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      title,
      description,
      projectId,
      priority,
      dueDate,
    } = body;

    if (!title || !projectId) {
      return NextResponse.json(
        {
          success: false,
          message: "Task title and project are required.",
        },
        { status: 400 }
      );
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          businessId: business.id,
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          message: "Project not found.",
        },
        { status: 404 }
      );
    }

    const task = await prisma.$transaction(
      async (tx) => {
        const createdTask = await tx.task.create({
          data: {
            title,
            description,
            projectId,
            priority: priority ?? "MEDIUM",
            dueDate: dueDate
              ? new Date(dueDate)
              : null,
          },
        });

        await tx.taskActivity.create({
          data: {
            taskId: createdTask.id,
            type: "CREATED",
            message: `Task "${createdTask.title}" was created.`,
          },
        });

        return createdTask;
      }
    );

    return NextResponse.json({
      success: true,
      task,
    });
  } catch (error) {
    console.error("POST /api/tasks error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong.",
      },
      { status: 500 }
    );
  }
}