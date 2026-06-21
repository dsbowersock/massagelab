import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"
import { config } from "dotenv"
import ws from "ws"

config({ path: ".env.local" })
config()

neonConfig.webSocketConstructor = ws

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim()
  if (!value) throw new Error("DATABASE_URL is required to read anatomy media view requests.")

  return value
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: databaseUrl() }),
})

/**
 * Emits the open desired-view queue in a compact JSON shape that a later
 * automation can consume without scraping the admin UI.
 */
async function main() {
  const requests = await prisma.anatomyMediaViewRequest.findMany({
    where: { status: "OPEN" },
    select: {
      id: true,
      entityType: true,
      entitySlug: true,
      requestedView: true,
      reason: true,
      requestNote: true,
      sourceUrl: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "asc" }],
  })

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    openRequestCount: requests.length,
    requests: requests.map((request) => ({
      id: request.id,
      entityType: request.entityType,
      entitySlug: request.entitySlug,
      requestedView: request.requestedView,
      reason: request.reason,
      requestNote: request.requestNote,
      sourceUrl: request.sourceUrl,
      createdAt: request.createdAt.toISOString(),
    })),
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
