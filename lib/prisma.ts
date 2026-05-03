import { PrismaClient } from "@prisma/client"
import { neonConfig } from "@neondatabase/serverless"
import { PrismaNeon } from "@prisma/adapter-neon"
import ws from "ws"

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

neonConfig.webSocketConstructor = ws

function databaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Use the pooled Neon connection string for Prisma Client.")
  }

  return process.env.DATABASE_URL
}

const adapter = new PrismaNeon({ connectionString: databaseUrl() })

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
