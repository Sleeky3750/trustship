import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Clear the admin session cookie
    const response = NextResponse.json({
      success: true,
      message: "Admin logged out successfully",
    });

    // Remove the admin session cookie set by /api/admin/login
    response.cookies.delete('admin_token');

    return response;
  } catch (error: any) {
    console.error("Admin logout error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}