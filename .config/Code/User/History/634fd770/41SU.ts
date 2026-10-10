import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

async function getBusinessId() {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("businessId");

  return businessId?.value ?? null;
}

export async function POST(request: Request) {
  try {
    const businessId = await getBusinessId();

    if (!businessId) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
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
        businessId,
      },
    });

    return NextResponse.json({
      success: true,
      workspace,
    });
  } catch (error) {
    console.error(
      "POST /api/workspaces error:",
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
    const businessId = await getBusinessId();

    if (!businessId) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
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
          businessId,
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

    const updatedWorkspace =
      await prisma.workspace.update({
        where: {
          id: workspace.id,
        },
        data: {
          name,
        },
      });

    return NextResponse.json({
      success: true,
      workspace: updatedWorkspace,
    });
  } catch (error) {
    console.error(
      "PATCH /api/workspaces error:",
      error
    );

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
    const businessId = await getBusinessId();

    if (!businessId) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
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
          businessId,
        },
        include: {
          projects: {
            include: {
              tasks: true,
            },
          },
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

    const projectCount = workspace.projects.length;

    const taskCount = workspace.projects.reduce(
      (total, project) =>
        total + project.tasks.length,
      0
    );

    /*
     * We deliberately do NOT automatically delete
     * the workspace yet.
     *
     * This protects the database until we confirm
     * the Prisma relation/cascade rules for:
     *
     * Workspace
     *   -> Project
     *      -> Task
     *         -> TaskActivity
     */

    return NextResponse.json(
      {
        success: false,
        message:
          "Workspace deletion is not enabled yet.",
        details: {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          projectCount,
          taskCount,
        },
      },
      { status: 409 }
    );
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