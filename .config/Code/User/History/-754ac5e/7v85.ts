import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    console.error(
      "DELETE /api/tasks/delete error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete task.",
      },
      { status: 500 }
    );
  }
}