import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";

export async function POST(request: Request) {
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

    const title =
      typeof body.title === "string"
        ? body.title.trim()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : null;

    const projectId =
      typeof body.projectId === "string"
        ? body.projectId
        : "";

    const priority =
      body.priority ?? "MEDIUM";

    const dueDate =
      body.dueDate
        ? new Date(body.dueDate)
        : null;

    if (!title || !projectId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Task title and project are required.",
        },
        { status: 400 }
      );
    }

    const project =
      await prisma.project.findFirst({
        where: {
          id: projectId,
          workspace: {
            businessId: business.id,
          },
        },
      });

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          message: "Project not found.",
        },
        { status: 404 }
      );
    }

    const task = await prisma.$transaction(
      async (tx) => {
        const createdTask =
          await tx.task.create({
            data: {
              title,
              description,
              projectId,
              priority,
              dueDate,
            },
          });

        await tx.taskActivity.create({
          data: {
            taskId: createdTask.id,
            type: "CREATED",
            message: `Task "${createdTask.title}" was created.`,
          },
        });

        return createdTask;
      }
    );

    return NextResponse.json({
      success: true,
      task,
    });
  } catch (error) {
    console.error(
      "POST /api/tasks error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong.",
      },
      { status: 500 }
    );
  }
}

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

    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          message: "Task ID is required.",
        },
        { status: 400 }
      );
    }

    const task =
      await prisma.task.findFirst({
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

    const data: {
      title?: string;
      description?: string | null;
      priority?: "LOW" | "MEDIUM" | "HIGH";
      dueDate?: Date | null;
      status?: "TODO" | "IN_PROGRESS" | "DONE";
    } = {};

    if (typeof body.title === "string") {
      const title = body.title.trim();

      if (!title) {
        return NextResponse.json(
          {
            success: false,
            message: "Task title is required.",
          },
          { status: 400 }
        );
      }

      data.title = title;
    }

    if (
      typeof body.description === "string" ||
      body.description === null
    ) {
      data.description =
        typeof body.description === "string"
          ? body.description.trim()
          : null;
    }

    if (
      body.priority === "LOW" ||
      body.priority === "MEDIUM" ||
      body.priority === "HIGH"
    ) {
      data.priority = body.priority;
    }

    if ("dueDate" in body) {
      data.dueDate = body.dueDate
        ? new Date(body.dueDate)
        : null;
    }

    if (
      body.status === "TODO" ||
      body.status === "IN_PROGRESS" ||
      body.status === "DONE"
    ) {
      data.status = body.status;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No changes were provided.",
        },
        { status: 400 }
      );
    }

    const statusChanged =
      data.status !== undefined &&
      data.status !== task.status;

    const updatedTask =
      await prisma.$transaction(
        async (tx) => {
          const updated =
            await tx.task.update({
              where: {
                id: task.id,
              },
              data,
            });

          if (statusChanged) {
            await tx.taskActivity.create({
              data: {
                taskId: task.id,
                type: "STATUS_CHANGED",
                message: `Task status changed from ${task.status} to ${updated.status}.`,
              },
            });
          }

          return updated;
        }
      );

    return NextResponse.json({
      success: true,
      task: updatedTask,
    });
  } catch (error) {
    console.error(
      "PATCH /api/tasks error:",
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

    const body = await request.json();

    const taskId =
      typeof body.taskId === "string"
        ? body.taskId
        : "";

    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          message: "Task ID is required.",
        },
        { status: 400 }
      );
    }

    const task =
      await prisma.task.findFirst({
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

    await prisma.$transaction(
      async (tx) => {
        await tx.taskActivity.deleteMany({
          where: {
            taskId: task.id,
          },
        });

        await tx.task.delete({
          where: {
            id: task.id,
          },
        });
      }
    );

    return NextResponse.json({
      success: true,
      message: "Task deleted.",
    });
  } catch (error) {
    console.error(
      "DELETE /api/tasks error:",
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