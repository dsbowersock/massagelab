#!/usr/bin/env node

import process from "node:process"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"
import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"
import { config as loadDotenv } from "dotenv"
import ws from "ws"
import { ensureVerifiedUserBackgroundCredits } from "../lib/commerce/credit-service.ts"

const DEFAULT_BATCH_SIZE = 100
const MAX_BACKFILL_LIMIT = 10_000

export function parseBackgroundCreditBackfillArgs(args) {
  let dryRun = false
  let limit

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--dry-run") {
      dryRun = true
      continue
    }

    let rawLimit
    if (argument === "--limit") {
      rawLimit = args[index + 1]
      index += 1
    } else if (argument.startsWith("--limit=")) {
      rawLimit = argument.slice("--limit=".length)
    } else {
      throw new Error("Supported options are --dry-run and --limit.")
    }

    const parsedLimit = Number(rawLimit)
    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      throw new Error("--limit must be a positive integer.")
    }
    if (parsedLimit > MAX_BACKFILL_LIMIT) {
      throw new Error(`--limit must be at most ${MAX_BACKFILL_LIMIT}.`)
    }
    limit = parsedLimit
  }

  return { dryRun, limit }
}

/**
 * Scans only verified users without wallets in stable ID order. The cursor and
 * optional limit make interrupted runs resumable while the shared provisioner
 * remains the single authority for verification and idempotency.
 */
export async function runBackgroundCreditBackfill({
  prismaClient,
  dryRun = false,
  limit,
  batchSize = DEFAULT_BATCH_SIZE,
  ensureCredits = ensureVerifiedUserBackgroundCredits,
}) {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("batchSize must be a positive integer.")
  }

  const alreadyProvisionedAtStart = await prismaClient.user.count({
    where: {
      emailVerified: { not: null },
      backgroundCreditWallet: { isNot: null },
    },
  })
  const maximumEligible = limit ?? Number.POSITIVE_INFINITY
  let cursor
  let eligible = 0
  let granted = 0
  let concurrentlyProvisioned = 0

  while (eligible < maximumEligible) {
    const remaining = maximumEligible - eligible
    const users = await prismaClient.user.findMany({
      where: {
        emailVerified: { not: null },
        backgroundCreditWallet: null,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: Math.min(batchSize, remaining),
      select: { id: true },
    })

    if (users.length === 0) {
      break
    }

    eligible += users.length
    cursor = users.at(-1).id

    if (dryRun) {
      continue
    }

    for (const user of users) {
      const result = await ensureCredits(prismaClient, user.id)
      if (result.granted) {
        granted += 1
      } else {
        concurrentlyProvisioned += 1
      }
    }
  }

  return {
    eligible,
    granted,
    alreadyProvisioned: alreadyProvisionedAtStart + concurrentlyProvisioned,
    dryRun,
  }
}

export function formatBackgroundCreditBackfillSummary(result) {
  return `eligible=${result.eligible} granted=${result.granted} alreadyProvisioned=${result.alreadyProvisioned} dryRun=${result.dryRun}`
}

/** Returns actionable error text while replacing any URL or secret-bearing token wholesale. */
export function formatBackgroundCreditBackfillError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error.")
  return message
    .split(/\s+/)
    .map((token) => (
      token.includes("://") || /\b(?:password|passwd|pwd|token|secret)=/i.test(token)
        ? "[redacted]"
        : token
    ))
    .join(" ")
    .slice(0, 500)
}

function isolatedDirectConnectionString() {
  loadDotenv({ path: ".env.local", override: false, quiet: true })
  loadDotenv({ path: ".env", override: false, quiet: true })
  const value = process.env.BACKGROUND_CREDIT_BACKFILL_DATABASE_URL?.trim()
  if (!value) {
    throw new Error("BACKGROUND_CREDIT_BACKFILL_DATABASE_URL is required.")
  }

  const parsed = new URL(value)
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol)
    || !parsed.hostname.endsWith(".neon.tech")
    || parsed.hostname.includes("-pooler.")
  ) {
    throw new Error("BACKGROUND_CREDIT_BACKFILL_DATABASE_URL must be a direct Neon connection.")
  }

  return value
}

async function main() {
  const options = parseBackgroundCreditBackfillArgs(process.argv.slice(2))
  neonConfig.webSocketConstructor = ws
  const adapter = new PrismaNeon({ connectionString: isolatedDirectConnectionString() })
  const prisma = new PrismaClient({ adapter })

  try {
    const result = await runBackgroundCreditBackfill({ prismaClient: prisma, ...options })
    console.log(formatBackgroundCreditBackfillSummary(result))
  } finally {
    await prisma.$disconnect()
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ""
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error("Background credit backfill failed.", formatBackgroundCreditBackfillError(error))
    process.exitCode = 1
  })
}
