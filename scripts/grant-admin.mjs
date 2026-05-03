import { PrismaClient } from "@prisma/client"
import { neonConfig } from "@neondatabase/serverless"
import { PrismaNeon } from "@prisma/adapter-neon"
import { config } from "dotenv"
import ws from "ws"

config({ path: ".env.local" })
config()

const emails = [
  ...(process.env.ADMIN_EMAILS ?? "").split(","),
  ...process.argv.slice(2),
]
  .map((email) => email.trim().replace(/^['"]|['"]$/g, "").toLowerCase())
  .filter(Boolean)

const uniqueEmails = [...new Set(emails)]

if (uniqueEmails.length === 0) {
  throw new Error("Set ADMIN_EMAILS in .env.local or pass one or more emails to npm run admin:grant -- you@example.com")
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DIRECT_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL is required to grant admin roles.")
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
      console.warn(`No user found for ${maskEmail(email)}. Sign in with Google once, then rerun this command if needed.`)
      continue
    }

    await prisma.userRole.upsert({
      where: {
        userId_role: {
          userId: user.id,
          role: "ADMIN",
        },
      },
      create: {
        userId: user.id,
        role: "ADMIN",
      },
      update: {},
    })

    granted += 1
    console.log(`Granted ADMIN to ${maskEmail(email)}.`)
  }

  console.log(`Done. Granted: ${granted}. Missing users: ${missing}.`)
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
