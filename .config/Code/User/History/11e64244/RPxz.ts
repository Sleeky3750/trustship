import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";

export async function PATCH(request: Request) {
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

    const { taskId, status } = await request.json();

    if (!taskId || !status) {
      return NextResponse.json(
        {
          success: false,
          message: "Task ID and status are required.",
        },
        { status: 400 }
      );
    }

    const validStatuses = [
      "TODO",
      "IN_PROGRESS",
      "DONE",
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid task status.",
        },
        { status: 400 }
      );
    }

    const task = await prisma.$transaction(
      async (tx) => {
        const existingTask =
          await tx.task.findFirst({
            where: {
              id: taskId,
              project: {
                workspace: {
                  businessId: business.id,
                },
              },
            },
          });

        if (!existingTask) {
          throw new Error("Task not found.");
        }

        if (existingTask.status === status) {
          return existingTask;
        }

        const updatedTask =
          await tx.task.update({
            where: {
              id: taskId,
            },
            data: {
              status,
            },
          });

        await tx.taskActivity.create({
          data: {
            taskId: updatedTask.id,
            type: "STATUS_CHANGED",
            message: `Status changed from ${existingTask.status} to ${updatedTask.status}.`,
          },
        });

        return updatedTask;
      }
    );

    return NextResponse.json({
      success: true,
      task,
    });
  } catch (error) {
    console.error(
      "PATCH /api/tasks/update error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update task.",
      },
      { status: 500 }
    );
  }
}