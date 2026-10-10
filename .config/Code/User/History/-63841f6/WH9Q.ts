import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";

const VALID_PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
] as const;

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

    const title =
      typeof body.title === "string"
        ? body.title.trim()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : null;

    const projectId =
      typeof body.projectId === "string"
        ? body.projectId
        : "";

    const priority =
      typeof body.priority === "string"
        ? body.priority
        : "MEDIUM";

    const dueDate =
      body.dueDate === null ||
      body.dueDate === undefined ||
      body.dueDate === ""
        ? null
        : new Date(body.dueDate);

    if (!title || !projectId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Task title and project are required.",
        },
        { status: 400 }
      );
    }

    if (
      !VALID_PRIORITIES.includes(
        priority as (typeof VALID_PRIORITIES)[number]
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid task priority.",
        },
        { status: 400 }
      );
    }

    if (
      dueDate !== null &&
      Number.isNaN(dueDate.getTime())
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid due date.",
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
        const createdTask =
          await tx.task.create({
            data: {
              title,
              description,
              projectId,
              priority:
                priority as "LOW" | "MEDIUM" | "HIGH",
              dueDate,
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
    console.error(
      "POST /api/tasks error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong.",
      },
      { status: 500 }
    );
  }
}