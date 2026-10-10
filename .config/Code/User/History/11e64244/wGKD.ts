import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const { taskId, status } = body;

    const task = await prisma.$transaction(
      async (tx) => {
        const existingTask = await tx.task.findUnique({
          where: {
            id: taskId,
          },
        });

        if (!existingTask) {
          throw new Error("Task not found.");
        }

        if (existingTask.status === status) {
          return existingTask;
        }

        const updatedTask = await tx.task.update({
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
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update task.",
      },
      { status: 500 }
    );
  }
}

