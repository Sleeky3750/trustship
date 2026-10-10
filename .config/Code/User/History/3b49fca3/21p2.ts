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

    const {
      taskId,
      title,
      description,
      priority,
      dueDate,
    } = await request.json();

    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          message: "Task ID is required.",
        },
        { status: 400 }
      );
    }

    const updatedTask = await prisma.$transaction(
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

        const newDueDate = dueDate
          ? new Date(dueDate)
          : null;

        const priorityChanged =
          priority &&
          priority !== existingTask.priority;

        const titleChanged =
          title !== existingTask.title;

        const descriptionChanged =
          description !==
          existingTask.description;

        const dueDateChanged =
          newDueDate?.getTime() !==
            existingTask.dueDate?.getTime() ||
          (newDueDate === null &&
            existingTask.dueDate !== null);

        const task = await tx.task.update({
          where: {
            id: taskId,
          },
          data: {
            title,
            description,
            priority,
            dueDate: newDueDate,
          },
        });

        if (priorityChanged) {
          await tx.taskActivity.create({
            data: {
              taskId: task.id,
              type: "PRIORITY_CHANGED",
              message: `Priority changed from ${existingTask.priority} to ${task.priority}.`,
            },
          });
        }

        if (
          titleChanged ||
          descriptionChanged ||
          dueDateChanged
        ) {
          await tx.taskActivity.create({
            data: {
              taskId: task.id,
              type: "UPDATED",
              message: "Task details were updated.",
            },
          });
        }

        return task;
      }
    );

    return NextResponse.json({
      success: true,
      task: updatedTask,
    });
  } catch (error) {
    console.error(
      "PATCH /api/tasks/edit error:",
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