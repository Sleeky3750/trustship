import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";

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

    const { id } = await params;

    const task = await prisma.task.findFirst({
      where: {
        id,
        project: {
          workspace: {
            businessId: business.id,
          },
        },
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