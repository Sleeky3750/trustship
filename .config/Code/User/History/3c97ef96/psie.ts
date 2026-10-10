import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const existingBusiness = await prisma.business.findUnique({
  where: {
    email: body.email,
  },
});

if (existingBusiness) {
  return NextResponse.json(
    {
      success: false,
      message: "Email already exists.",
    },
    { status: 400 }
  );
}
const hashedPassword = await bcrypt.hash(body.password, 10);

    console.log("Request body:", body);

    const business = await prisma.business.create({
      data: {
        businessName: body.businessName,
        email: body.email,
        phone: body.phone,
        businessType: body.businessType,
        password: hashedPassword,
      },
    });

    return NextResponse.json({
  success: true,
  message: "Business created successfully.",
  business: {
    id: business.id,
    businessName: business.businessName,
    email: business.email,
    phone: business.phone,
    businessType: business.businessType,
  },
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