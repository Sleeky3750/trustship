import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";

export async function DELETE(request: Request) {
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

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        project: {
          workspace: {
            businessId: business.id,
          },
        },
      },
    });

    if (!task) {
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