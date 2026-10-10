import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const {
      taskId,
      title,
      description,
      priority,
      dueDate,
    } = body;

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
          await tx.task.findUnique({
            where: {
              id: taskId,
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

        const task =
          await tx.task.update({
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