```tsx
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: {
        id,
      },
      include: {
        activities: {
          orderBy: {
            createdAt: "desc",
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

    return NextResponse.json({
      success: true,
      activities: task.activities,
    });
  } catch (error) {
    console.error(
      "GET /api/tasks/[id]/activities error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load task activities.",
      },
      { status: 500 }
    );
  }
}
```
