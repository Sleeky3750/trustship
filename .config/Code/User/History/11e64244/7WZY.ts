import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";

const VALID_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "DONE",
] as const;

type TaskStatus =
  (typeof VALID_STATUSES)[number];

export async function PATCH(
  request: Request
) {
  try {
    const business =
      await getCurrentBusiness();

    if (!business) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const data = body as {
      taskId?: unknown;
      status?: unknown;
    };

    const taskId =
      typeof data.taskId === "string"
        ? data.taskId.trim()
        : "";

    const status =
      typeof data.status === "string"
        ? data.status
        : "";

    if (!taskId || !status) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Task ID and status are required.",
        },
        { status: 400 }
      );
    }

    if (
      !VALID_STATUSES.includes(
        status as TaskStatus
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid task status.",
        },
        { status: 400 }
      );
    }

    const newStatus =
      status as TaskStatus;

    const result =
      await prisma.$transaction(
        async (tx) => {
          const existingTask =
            await tx.task.findFirst({
              where: {
                id: taskId,
                project: {
                  workspace: {
                    businessId:
                      business.id,
                  },
                },
              },
            });

          if (!existingTask) {
            return null;
          }

          if (
            existingTask.status ===
            newStatus
          ) {
            return existingTask;
          }

          const updatedTask =
            await tx.task.update({
              where: {
                id: existingTask.id,
              },
              data: {
                status: newStatus,
              },
            });

          await tx.taskActivity.create({
            data: {
              taskId: updatedTask.id,
              type: "STATUS_CHANGED",
              message:
                `Status changed from ${existingTask.status} to ${updatedTask.status}.`,
            },
          });

          return updatedTask;
        }
      );

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          message: "Task not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      task: result,
    });
  } catch (error) {
    console.error(
      "PATCH /api/tasks/update error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to update task.",
      },
      { status: 500 }
    );
  }
}