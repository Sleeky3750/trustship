import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";
import { generateProjectPlan } from "@/lib/ai/projectPlanner";

export async function POST() {
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

    const job = await prisma.aIJob.findFirst({
      where: {
        businessId: business.id,
        status: "QUEUED",
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (!job) {
      return NextResponse.json({
        success: true,
        message: "No queued AI jobs.",
      });
    }

    await prisma.aIJob.update({
      where: {
        id: job.id,
      },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
        attempts: {
          increment: 1,
        },
      },
    });

    try {
      let output: unknown;

      switch (job.type) {
        case "PROJECT_PLANNING": {
          const input = job.input as {
            projectIdea?: string;
          };

          if (!input.projectIdea) {
            throw new Error(
              "PROJECT_PLANNING job requires projectIdea."
            );
          }

          output = await generateProjectPlan(
            input.projectIdea
          );

          break;
        }

        default:
          throw new Error(
            `Unsupported AI job type: ${job.type}`
          );
      }

      await prisma.aIJob.update({
        where: {
          id: job.id,
        },
        data: {
          status: "COMPLETED",
          output: output as object,
          completedAt: new Date(),
          error: null,
        },
      });

      return NextResponse.json({
        success: true,
        jobId: job.id,
        output,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "AI job failed.";

      await prisma.aIJob.update({
        where: {
          id: job.id,
        },
        data: {
          status: "FAILED",
          error: message,
        },
      });

      return NextResponse.json(
        {
          success: false,
          jobId: job.id,
          message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(
      "POST /api/ai/process error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to process AI job.",
      },
      { status: 500 }
    );
  }
}