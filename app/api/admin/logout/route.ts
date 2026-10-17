import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Clear the admin session cookie
    const response = NextResponse.json({
      success: true,
      message: "Admin logged out successfully",
    });

    // Remove the admin session cookie
    response.cookies.delete('trustship_admin_session');

    return response;
  } catch (error: any) {
    console.error("Admin logout error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}