import { PrismaClient } from "@prisma/client"
import { neonConfig } from "@neondatabase/serverless"
import { PrismaNeon } from "@prisma/adapter-neon"
import ws from "ws"
import { config } from "dotenv"
import { anatomyTerms, getAnatomySources } from "../lib/anatomy.js"

config({ path: ".env.local" })
config()

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DIRECT_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL is required to seed the Neon database.")
}

neonConfig.webSocketConstructor = ws

const adapter = new PrismaNeon({ connectionString })
const prisma = new PrismaClient({ adapter, log: ['error'] })

function toEnum(value, fallback = "OTHER") {
  return String(value || fallback).replace(/-/g, "_").toUpperCase()
}

function bodySystemsForTerm(term) {
  if (term.kind === "bone") return ["skeletal"]
  if (term.kind === "muscle") return ["muscular"]
  return []
}

async function main() {
  for (const source of getAnatomySources()) {
    await prisma.anatomySource.upsert({
      where: { slug: source.id },
      create: {
        slug: source.id,
        label: source.label,
        url: source.url ?? null,
        license: source.license ?? null,
        attribution: source.attribution,
      },
      update: {
        label: source.label,
        url: source.url ?? null,
        license: source.license ?? null,
        attribution: source.attribution,
      },
    })
  }

  for (const term of anatomyTerms) {
    const anatomyTerm = await prisma.anatomyTerm.upsert({
      where: { slug: term.id },
      create: {
        slug: term.id,
        kind: toEnum(term.kind),
        preferredName: term.name,
        summary: term.definition ?? null,
        regions: term.regions,
        bodySystems: bodySystemsForTerm(term),
        difficulty: toEnum(term.difficulty, "MEDIUM"),
        status: "PUBLISHED",
      },
      update: {
        kind: toEnum(term.kind),
        preferredName: term.name,
        summary: term.definition ?? null,
        regions: term.regions,
        bodySystems: bodySystemsForTerm(term),
        difficulty: toEnum(term.difficulty, "MEDIUM"),
        status: "PUBLISHED",
      },
    })

    for (const alias of term.aliases ?? []) {
      await prisma.anatomyAlias.upsert({
        where: {
          termId_alias: {
            termId: anatomyTerm.id,
            alias,
          },
        },
        create: {
          termId: anatomyTerm.id,
          alias,
        },
        update: {},
      })
    }

    for (const sourceRef of term.sourceRefs ?? []) {
      const source = await prisma.anatomySource.findUnique({ where: { slug: sourceRef } })

      if (source) {
        await prisma.anatomySourceRef.upsert({
          where: {
            termId_sourceId: {
              termId: anatomyTerm.id,
              sourceId: source.id,
            },
          },
          create: {
            termId: anatomyTerm.id,
            sourceId: source.id,
          },
          update: {},
        })
      }
    }
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
