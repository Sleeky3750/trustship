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

    const { name, description, workspaceId } = body;

    if (!name || !workspaceId) {
      return NextResponse.json(
        {
          success: false,
          message: "Project name and workspace are required.",
        },
        { status: 400 }
      );
    }

    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        businessId: business.id,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        {
          success: false,
          message: "Workspace not found.",
        },
        { status: 404 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        workspaceId,
      },
    });

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    console.error("POST /api/projects error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong.",
      },
      { status: 500 }
    );
  }
}