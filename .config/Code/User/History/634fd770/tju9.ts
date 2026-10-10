import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";

export async function POST(request: Request) {
  try {
    const business = await getCurrentBusiness();

    if (!business) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Workspace name is required.",
        },
        { status: 400 }
      );
    }

    const workspace = await prisma.workspace.create({
      data: {
        name,
        description: description || null,
        businessId: business.id,
      },
    });

    return NextResponse.json({
      success: true,
      workspace,
    });
  } catch (error) {
    console.error("POST /api/workspaces error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create workspace.",
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
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const workspaceId =
      typeof body.workspaceId === "string"
        ? body.workspaceId
        : "";

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    if (!workspaceId || !name) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Workspace ID and name are required.",
        },
        { status: 400 }
      );
    }

    const workspace =
      await prisma.workspace.findFirst({
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

    const updated =
      await prisma.workspace.update({
        where: {
          id: workspace.id,
        },
        data: {
          name,
          description: description || null,
        },
      });

    return NextResponse.json({
      success: true,
      workspace: updated,
    });
  } catch (error) {
    console.error("PATCH /api/workspaces error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update workspace.",
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
        { success: false, message: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const workspaceId =
      typeof body.workspaceId === "string"
        ? body.workspaceId
        : "";

    if (!workspaceId) {
      return NextResponse.json(
        {
          success: false,
          message: "Workspace ID is required.",
        },
        { status: 400 }
      );
    }

    const workspace =
      await prisma.workspace.findFirst({
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

    await prisma.workspace.delete({
      where: {
        id: workspace.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Workspace deleted.",
    });
  } catch (error) {
    console.error(
      "DELETE /api/workspaces error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete workspace.",
      },
      { status: 500 }
    );
  }
}