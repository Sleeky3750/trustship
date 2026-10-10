import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const business = await prisma.business.findUnique({
      where: {
        email: body.email,
      },
    });
    

    if (!business) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password.",
        },
        { status: 400 }
      );
    }

    const validPassword = await bcrypt.compare(
      body.password,
      business.password
    );
    

    if (!validPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password.",
        },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
  success: true,
  message: "Login successful.",
  business: {
    id: business.id,
    businessName: business.businessName,
    email: business.email,
  },
});

response.cookies.set("businessId", business.id, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
});

return response;
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong.",
      },
      { status: 500 }
    );
  }
}