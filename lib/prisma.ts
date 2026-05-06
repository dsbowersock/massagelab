import { PrismaClient } from "@prisma/client"
import { neonConfig } from "@neondatabase/serverless"
import { PrismaNeon } from "@prisma/adapter-neon"
import ws from "ws"

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

neonConfig.webSocketConstructor = ws

let prismaClient: PrismaClient | undefined

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

function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString: databaseUrl() })

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })
}

function getPrismaClient() {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  prismaClient ??= createPrismaClient()

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaClient
  }

  return prismaClient
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient()
    const value = Reflect.get(client, property, client)

    return typeof value === "function" ? value.bind(client) : value
  },
  set(_target, property, value) {
    return Reflect.set(getPrismaClient(), property, value)
  },
  has(_target, property) {
    return property in getPrismaClient()
  },
  ownKeys() {
    return Reflect.ownKeys(getPrismaClient())
  },
  getOwnPropertyDescriptor(_target, property) {
    const descriptor = Reflect.getOwnPropertyDescriptor(getPrismaClient(), property)

    if (descriptor) {
      descriptor.configurable = true
    }

    return descriptor
  },
})
