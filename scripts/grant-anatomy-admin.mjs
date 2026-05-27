import { PrismaClient } from "@prisma/client"
import { neonConfig } from "@neondatabase/serverless"
import { PrismaNeon } from "@prisma/adapter-neon"
import { config } from "dotenv"
import ws from "ws"

config({ path: ".env.local" })
config()

const emails = [
  ...(process.env.ANATOMY_ADMIN_EMAILS ?? "").split(","),
  ...process.argv.slice(2),
]
  .map((email) => email.trim().replace(/^['"]|['"]$/g, "").toLowerCase())
  .filter(Boolean)

const uniqueEmails = [...new Set(emails)]

if (uniqueEmails.length === 0) {
  throw new Error("Set ANATOMY_ADMIN_EMAILS in .env.local or pass one or more emails to npm run anatomy:grant-admin -- you@example.com")
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DIRECT_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL is required to grant anatomy admin roles.")
}

neonConfig.webSocketConstructor = ws

const adapter = new PrismaNeon({ connectionString })
const prisma = new PrismaClient({ adapter, log: ["error"] })

function maskEmail(email) {
  const [name, domain] = email.split("@")
  if (!name || !domain) return "configured email"
  const visibleName = name.length <= 2 ? `${name[0] ?? ""}*` : `${name.slice(0, 2)}***`
  return `${visibleName}@${domain}`
}

async function main() {
  let granted = 0
  let missing = 0

  for (const email of uniqueEmails) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (!user) {
      missing += 1
      console.warn(`No user found for ${maskEmail(email)}. Sign in once, then rerun this command if needed.`)
      continue
    }

    await prisma.userRole.upsert({
      where: {
        userId_role: {
          userId: user.id,
          role: "ANATOMY_ADMIN",
        },
      },
      create: {
        userId: user.id,
        role: "ANATOMY_ADMIN",
        status: "VERIFIED",
        source: "anatomy-admin-grant",
        verifiedAt: new Date(),
      },
      update: {
        status: "VERIFIED",
        source: "anatomy-admin-grant",
        verifiedAt: new Date(),
        revokedAt: null,
      },
    })

    granted += 1
    console.log(`Granted ANATOMY_ADMIN to ${maskEmail(email)}.`)
  }

  console.log(`Done. Granted: ${granted}. Missing users: ${missing}.`)
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
