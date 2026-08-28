#!/usr/bin/env node

import process from "node:process"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"
import { config as loadDotenv } from "dotenv"
import ws from "ws"

const COLLISION_QUERY = `
SELECT COUNT(*)::int AS normalized_collision_count
FROM (
  SELECT lower(btrim("email"))
  FROM "User"
  WHERE "email" IS NOT NULL
  GROUP BY lower(btrim("email"))
  HAVING COUNT(*) > 1
) collisions
`

/** Validates that maintenance runs cannot silently use a pooled database endpoint. */
export function requireDirectNormalizedEmailCheckUrl(env) {
  const value = env.AUTH_NORMALIZED_EMAIL_CHECK_DATABASE_URL?.trim()
  if (!value) {
    throw new Error("AUTH_NORMALIZED_EMAIL_CHECK_DATABASE_URL is required.")
  }

  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error("AUTH_NORMALIZED_EMAIL_CHECK_DATABASE_URL must be a valid direct Neon connection.")
  }
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol)
    || !parsed.hostname.endsWith(".neon.tech")
    || parsed.hostname.includes("-pooler.")
    || parsed.pathname.replace(/^\/+/, "").length === 0
  ) {
    throw new Error("AUTH_NORMALIZED_EMAIL_CHECK_DATABASE_URL must be a direct non-pooler Neon connection.")
  }
  return value
}

/** Replaces connection URLs and secret-bearing tokens before terminal output. */
export function formatNormalizedEmailCheckError(error) {
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

export async function countNormalizedEmailCollisions(prismaClient) {
  const rows = await prismaClient.$queryRawUnsafe(COLLISION_QUERY)
  const count = Number(rows?.[0]?.normalized_collision_count)
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Normalized email collision query returned an invalid count.")
  }
  return count
}

function createNormalizedEmailCheckPrismaClient(connectionString) {
  neonConfig.webSocketConstructor = ws
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })
}

/**
 * Runs the count-only preflight through an injectable client while preserving
 * production CLI output and exit semantics without exposing database values.
 */
export async function runNormalizedEmailCollisionCheckCli({
  env,
  createPrismaClient,
  writeLine = (line) => process.stdout.write(`${line}\n`),
  setExitCode = (code) => {
    process.exitCode = code
  },
}) {
  const connectionString = requireDirectNormalizedEmailCheckUrl(env)
  if (typeof createPrismaClient !== "function") {
    throw new Error("An explicitly injected createPrismaClient factory is required.")
  }
  const prisma = createPrismaClient(connectionString)
  try {
    const count = await countNormalizedEmailCollisions(prisma)
    writeLine(`normalized_collision_count=${count}`)
    if (count !== 0) setExitCode(1)
    return count
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  loadDotenv({ path: ".env.local", override: false, quiet: true })
  loadDotenv({ path: ".env", override: false, quiet: true })
  await runNormalizedEmailCollisionCheckCli({
    env: process.env,
    createPrismaClient: createNormalizedEmailCheckPrismaClient,
  })
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ""
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`Normalized email collision check failed. ${formatNormalizedEmailCheckError(error)}\n`)
    process.exitCode = 1
  })
}
