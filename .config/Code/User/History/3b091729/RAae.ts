import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";

type ProjectPlan = {
  name: string;
  description: string;
  tasks: {
    title: string;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
  }[];
};

export async function POST(req: Request) {
  try {
    /*
     * AUTHENTICATION
     */
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

    const body = await req.json();

    const jobId =
      typeof body.jobId === "string"
        ? body.jobId
        : "";

    const workspaceId =
      typeof body.workspaceId === "string"
        ? body.workspaceId
        : "";

    if (!jobId) {
      return NextResponse.json(
        {
          success: false,
          message: "jobId is required.",
        },
        { status: 400 }
      );
    }

    if (!workspaceId) {
      return NextResponse.json(
        {
          success: false,
          message: "workspaceId is required.",
        },
        { status: 400 }
      );
    }

    /*
     * SECURITY CHECK #1
     *
     * The AI job MUST belong to the
     * currently logged-in business.
     */
    const job = await prisma.aIJob.findFirst({
      where: {
        id: jobId,
        businessId: business.id,
      },
    });

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          message: "AI job not found.",
        },
        { status: 404 }
      );
    }

    /*
     * Make sure this is the correct
     * type of AI job.
     */
    if (job.type !== "PROJECT_PLANNING") {
      return NextResponse.json(
        {
          success: false,
          message:
            "AI job is not a project planning job.",
        },
        { status: 400 }
      );
    }

    /*
     * The AI job must actually be completed
     * before its result can create a project.
     */
    if (job.status !== "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          message:
            "AI job has not completed yet.",
        },
        { status: 400 }
      );
    }

    if (
      !job.output ||
      typeof job.output !== "object"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "AI job has no project plan.",
        },
        { status: 400 }
      );
    }

    /*
     * SECURITY CHECK #2
     *
     * The workspace MUST belong to the
     * currently logged-in business.
     */
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

    /*
     * Read the original AI output.
     */
    const originalOutput =
      job.output as Partial<ProjectPlan>;

    /*
     * Optional edited plan supplied by the client.
     */
    const plan =
      body.plan as
        | Partial<ProjectPlan>
        | undefined;

    /*
     * Build a strictly validated plan.
     *
     * Never blindly trust AI output or
     * client-provided task data.
     */
    const output: ProjectPlan = {
      name:
        typeof plan?.name === "string"
          ? plan.name.trim()
          : typeof originalOutput.name ===
              "string"
            ? originalOutput.name.trim()
            : "",

      description:
        typeof plan?.description === "string"
          ? plan.description.trim()
          : typeof originalOutput.description ===
              "string"
            ? originalOutput.description.trim()
            : "",

      tasks: Array.isArray(plan?.tasks)
        ? plan.tasks
            .filter(
              (task) =>
                task &&
                typeof task.title ===
                  "string" &&
                typeof task.description ===
                  "string" &&
                [
                  "LOW",
                  "MEDIUM",
                  "HIGH",
                ].includes(
                  task.priority
                )
            )
            .map((task) => ({
              title: task.title.trim(),
              description:
                task.description.trim(),
              priority: task.priority,
            }))
            .filter(
              (task) =>
                task.title.length > 0 &&
                task.description.length > 0
            )
        : [],
    };

    if (!output.name) {
      return NextResponse.json(
        {
          success: false,
          message: "Project name is required.",
        },
        { status: 400 }
      );
    }

    if (!output.description) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Project description is required.",
        },
        { status: 400 }
      );
    }

    if (output.tasks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "At least one valid task is required.",
        },
        { status: 400 }
      );
    }

    /*
     * CREATE EVERYTHING IN ONE TRANSACTION.
     *
     * The project is created inside the already
     * verified workspace.
     */
    const project =
      await prisma.$transaction(
        async (tx) => {
          const createdProject =
            await tx.project.create({
              data: {
                name: output.name,
                description:
                  output.description,
                workspaceId:
                  workspace.id,

                tasks: {
                  create:
                    output.tasks.map(
                      (task) => ({
                        title:
                          task.title,
                        description:
                          task.description,
                        priority:
                          task.priority,
                      })
                    ),
                },
              },

              include: {
                tasks: true,
              },
            });

          /*
           * Record task creation activity.
           */
          if (
            createdProject.tasks.length > 0
          ) {
            await tx.taskActivity.createMany({
              data:
                createdProject.tasks.map(
                  (task) => ({
                    taskId: task.id,
                    type: "CREATED",
                    message: `Task "${task.title}" was created.`,
                  })
                ),
            });
          }

          return createdProject;
        }
      );

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    console.error(
      "AI project creation error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to create project from AI plan.",
      },
      { status: 500 }
    );
  }
}