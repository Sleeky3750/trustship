import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { analyzeBusiness } from "@/lib/ai/intelligence";

export async function GET() {
  try {
    const cookieStore =
      await cookies();

    const businessId =
      cookieStore.get(
        "businessId"
      );

    if (!businessId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You are not logged in.",
        },
        { status: 401 }
      );
    }

    const result =
      await analyzeBusiness(
        businessId.value
      );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "AI insights error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Pulse AI could not analyze the business.",
      },
      { status: 500 }
    );
  }
}