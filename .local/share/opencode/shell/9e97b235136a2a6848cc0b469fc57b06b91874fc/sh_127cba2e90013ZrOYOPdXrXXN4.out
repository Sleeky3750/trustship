import { PrismaClient } from "@prisma/client"

// Prevent multiple PrismaClient instances in serverless environments
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma || new PrismaClient()

// In development, connect to the database on first access
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}