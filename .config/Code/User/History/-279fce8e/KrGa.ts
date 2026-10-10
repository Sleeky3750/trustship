import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function getCurrentBusiness() {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("businessId")?.value;

  if (!businessId) {
    return null;
  }

  const business = await prisma.business.findUnique({
    where: {
      id: businessId,
    },
  });

  return business;
}