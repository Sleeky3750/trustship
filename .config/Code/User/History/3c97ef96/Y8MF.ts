import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    console.log("Request body:", body);

    const business = await prisma.business.create({
      data: {
        businessName: body.businessName,
        email: body.email,
        phone: body.phone,
        businessType: body.businessType,
        password: body.password,
      },
    });

    return NextResponse.json({
      success: true,
      business,
    });
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