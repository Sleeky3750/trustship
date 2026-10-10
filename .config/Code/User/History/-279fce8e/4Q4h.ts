import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  COOKIE_NAME,
  verifySessionValue,
} from "@/lib/auth/session";

export async function getCurrentBusiness() {
  const cookieStore = await cookies();

  const businessId = verifySessionValue(
    cookieStore.get(COOKIE_NAME)?.value
  );

  if (!businessId) {
    return null;
  }

  return prisma.business.findUnique({
    where: {
      id: businessId,
    },
  });
}