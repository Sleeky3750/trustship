import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";

const validPriorities = [
  "LOW",
  "MEDIUM",
  "HIGH",
] as const;

const validStatuses = [
  "TODO",
  "IN_PROGRESS",
  "DONE",
] as const;

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
        : "";

    const projectId =
      typeof body.projectId === "string"
        ? body.projectId
        : "";

    const priority = validPriorities.includes(
      body.priority
    )
      ? body.priority
      : "MEDIUM";

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

    if (
      dueDate &&
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
              description: description || null,
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
    console.error("POST /api/tasks error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create task.",
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

    const data: {
      title?: string;
      description?: string | null;
      priority?: (typeof validPriorities)[number];
      status?: (typeof validStatuses)[number];
      dueDate?: Date | null;
    } = {};

    const changes: string[] = [];

    if (typeof body.title === "string") {
      const title = body.title.trim();

      if (!title) {
        return NextResponse.json(
          {
            success: false,
            message: "Task title cannot be empty.",
          },
          { status: 400 }
        );
      }

      data.title = title;

      if (title !== task.title) {
        changes.push("title updated");
      }
    }

    if (typeof body.description === "string") {
      data.description =
        body.description.trim() || null;

      if (
        data.description !==
        task.description
      ) {
        changes.push("description updated");
      }
    }

    if (
      body.priority !== undefined
    ) {
      if (
        !validPriorities.includes(
          body.priority
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid priority.",
          },
          { status: 400 }
        );
      }

      data.priority = body.priority;

      if (body.priority !== task.priority) {
        changes.push(
          `priority changed to ${body.priority}`
        );
      }
    }

    if (body.status !== undefined) {
      if (
        !validStatuses.includes(
          body.status
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid status.",
          },
          { status: 400 }
        );
      }

      data.status = body.status;

      if (body.status !== task.status) {
        changes.push(
          `status changed to ${body.status}`
        );
      }
    }

    if (body.dueDate !== undefined) {
      if (!body.dueDate) {
        data.dueDate = null;

        if (task.dueDate) {
          changes.push("due date removed");
        }
      } else {
        const parsedDate =
          new Date(body.dueDate);

        if (
          Number.isNaN(parsedDate.getTime())
        ) {
          return NextResponse.json(
            {
              success: false,
              message: "Invalid due date.",
            },
            { status: 400 }
          );
        }

        data.dueDate = parsedDate;

        changes.push("due date updated");
      }
    }

    if (changes.length === 0) {
      return NextResponse.json({
        success: true,
        task,
      });
    }

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

          let activityType:
            | "UPDATED"
            | "STATUS_CHANGED"
            | "PRIORITY_CHANGED" =
            "UPDATED";

          if (
            data.status &&
            data.priority === undefined
          ) {
            activityType = "STATUS_CHANGED";
          } else if (
            data.priority &&
            data.status === undefined
          ) {
            activityType =
              "PRIORITY_CHANGED";
          }

          await tx.taskActivity.create({
            data: {
              taskId: task.id,
              type: activityType,
              message: `Task "${updated.title}": ${changes.join(
                ", "
              )}.`,
            },
          });

          return updated;
        }
      );

    return NextResponse.json({
      success: true,
      task: updatedTask,
    });
  } catch (error) {
    console.error("PATCH /api/tasks error:", error);

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
        id: task.id,
      },
    });

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