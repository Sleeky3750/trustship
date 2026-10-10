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

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    const workspaceId =
      typeof body.workspaceId === "string"
        ? body.workspaceId
        : "";

    if (!name || !workspaceId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Project name and workspace are required.",
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

    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
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
        message: "Failed to create project.",
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

    const projectId =
      typeof body.projectId === "string"
        ? body.projectId
        : "";

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    if (!projectId || !name) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Project ID and name are required.",
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

    const updated =
      await prisma.project.update({
        where: {
          id: project.id,
        },
        data: {
          name,
          description: description || null,
        },
      });

    return NextResponse.json({
      success: true,
      project: updated,
    });
  } catch (error) {
    console.error("PATCH /api/projects error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update project.",
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

    const projectId =
      typeof body.projectId === "string"
        ? body.projectId
        : "";

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          message: "Project ID is required.",
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

    await prisma.project.delete({
      where: {
        id: project.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Project deleted.",
    });
  } catch (error) {
    console.error(
      "DELETE /api/projects error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete project.",
      },
      { status: 500 }
    );
  }
}