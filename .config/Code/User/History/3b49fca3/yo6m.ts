import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";

const VALID_PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
] as const;

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

    const body = await request.json();

    const taskId =
      typeof body.taskId === "string"
        ? body.taskId
        : "";

    const title =
      typeof body.title === "string"
        ? body.title.trim()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : null;

    const priority =
      typeof body.priority === "string"
        ? body.priority
        : "";

    const dueDate =
      body.dueDate === null ||
      body.dueDate === undefined ||
      body.dueDate === ""
        ? null
        : new Date(body.dueDate);

    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          message: "Task ID is required.",
        },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          message: "Task title is required.",
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

    const updatedTask =
      await prisma.$transaction(async (tx) => {
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

        const priorityChanged =
          priority !== existingTask.priority;

        const titleChanged =
          title !== existingTask.title;

        const descriptionChanged =
          description !== existingTask.description;

        const dueDateChanged =
          dueDate?.getTime() !==
            existingTask.dueDate?.getTime() ||
          (dueDate === null &&
            existingTask.dueDate !== null);

        const task = await tx.task.update({
          where: {
            id: taskId,
          },
          data: {
            title,
            description,
            priority:
              priority as "LOW" | "MEDIUM" | "HIGH",
            dueDate,
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
              message:
                "Task details were updated.",
            },
          });
        }

        return task;
      });

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