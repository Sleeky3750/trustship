import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { TaskStatus } from "@/types/models";

export async function PATCH(request: Request) {
  try {
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

    const validStatuses: TaskStatus[] = [
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

    const existingTask = await prisma.task.findUnique({
      where: {
        id: taskId,
      },
    });

    if (!existingTask) {
      return NextResponse.json(
        {
          success: false,
          message: "Task not found.",
        },
        { status: 404 }
      );
    }

    if (existingTask.status === status) {
      return NextResponse.json({
        success: true,
        task: existingTask,
      });
    }

    const updatedTask = await prisma.task.update({
      where: {
        id: taskId,
      },
      data: {
        status,
        activities: {
          create: {
            type: "STATUS_CHANGED",
            message: `Task moved from ${existingTask.status} to ${status}.`,
          },
        },
      },
      include: {
        activities: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
      task: updatedTask,
    });
  } catch (error) {
    console.error("PATCH /api/tasks/update error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update task.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          message: "Task ID is required.",
        },
        { status: 400 }
      );
    }

    const existingTask = await prisma.task.findUnique({
      where: {
        id: taskId,
      },
    });

    if (!existingTask) {
      return NextResponse.json(
        {
          success: false,
          message: "Task not found.",
        },
        { status: 404 }
      );
    }

    await prisma.task.delete({
      where: {
        id: taskId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("DELETE /api/tasks/update error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete task.",
      },
      { status: 500 }
    );
  }
}