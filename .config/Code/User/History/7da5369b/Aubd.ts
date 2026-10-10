import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  generateRecommendations,
} from "@/lib/ai/recommendations";

export async function GET() {
  try {
    const cookieStore = await cookies();

    const businessId =
      cookieStore.get("businessId");

    if (!businessId) {
      return NextResponse.json(
        {
          success: false,
          message: "You are not logged in.",
        },
        { status: 401 }
      );
    }

    const result =
      await generateRecommendations(
        businessId.value
      );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "AI recommendations error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Pulse AI could not generate recommendations.",
      },
      { status: 500 }
    );
  }
}