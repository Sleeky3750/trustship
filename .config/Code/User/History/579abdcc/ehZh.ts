import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refineProjectPlan } from "@/lib/ai/projectPlanner";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.jobId) {
      return NextResponse.json(
        {
          success: false,
          message: "jobId is required",
        },
        { status: 400 }
      );
    }

    if (!body.instruction?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Refinement instruction is required",
        },
        { status: 400 }
      );
    }

    if (!body.currentPlan) {
      return NextResponse.json(
        {
          success: false,
          message: "currentPlan is required",
        },
        { status: 400 }
      );
    }

    const job = await prisma.aIJob.findUnique({
      where: {
        id: body.jobId,
      },
    });

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          message: "AI job not found",
        },
        { status: 404 }
      );
    }

    if (job.type !== "PROJECT_PLANNING") {
      return NextResponse.json(
        {
          success: false,
          message:
            "AI job is not a project planning job",
        },
        { status: 400 }
      );
    }

    if (job.status !== "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          message: "AI job is not completed",
        },
        { status: 400 }
      );
    }

    const refinedPlan = await refineProjectPlan({
      currentPlan: body.currentPlan,
      instruction: body.instruction.trim(),
    });

    return NextResponse.json({
      success: true,
      output: refinedPlan,
    });
  } catch (error) {
    console.error(
      "AI plan refinement error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to refine project plan",
      },
      { status: 500 }
    );
  }
}