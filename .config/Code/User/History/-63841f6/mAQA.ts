import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      title,
      description,
      projectId,
      priority,
      dueDate,
    } = body;

    if (!title || !projectId) {
      return NextResponse.json(
        {
          success: false,
          message: "Task title is required.",
        },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        projectId,
        priority: priority ?? "MEDIUM",
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    return NextResponse.json({
      success: true,
      task,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong.",
      },
      { status: 500 }
    );
  }
}