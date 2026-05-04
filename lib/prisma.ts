import { PrismaClient } from "@prisma/client"
import { neonConfig } from "@neondatabase/serverless"
import { PrismaNeon } from "@prisma/adapter-neon"
import ws from "ws"

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

neonConfig.webSocketConstructor = ws

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim()

  if (!value) {
    throw new Error("DATABASE_URL is required. Use the pooled Neon connection string for Prisma Client.")
  }

  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error("DATABASE_URL must be a valid postgres:// or postgresql:// URL. Check the Vercel Production DATABASE_URL value.")
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the postgres:// or postgresql:// protocol. Check the Vercel Production DATABASE_URL value.")
  }

  return value
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
