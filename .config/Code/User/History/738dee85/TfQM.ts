import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/auth/business";

export async function POST(req: Request) {
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

    const body = await req.json();

    const type =
      typeof body.type === "string"
        ? body.type
        : "";

    if (!type || body.input === undefined) {
      return NextResponse.json(
        {
          success: false,
          message: "AI job type and input are required.",
        },
        { status: 400 }
      );
    }

    const job = await prisma.aIJob.create({
      data: {
        businessId: business.id,
        type,
        input: body.input,
      },
    });

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error) {
    console.error(
      "POST /api/ai/create-job error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create AI job.",
      },
      { status: 500 }
    );
  }
}