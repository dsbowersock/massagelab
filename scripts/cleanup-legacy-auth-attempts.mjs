#!/usr/bin/env node

import process from "node:process"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"
import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"
import { config as loadDotenv } from "dotenv"
import ws from "ws"

import { formatOperationalError } from "./operational-error-redaction.mjs"
import { fingerprintPostgresTargetIdentities, parsePostgresTargetIdentity } from "./postgres-target-identity.mjs"

const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/

/** Parses only direct Neon targets and returns the non-secret tuple used for target binding. */
function parseDirectTarget(connectionString) {
  if (!connectionString?.trim()) {
    throw new Error("AUTH_LEGACY_ATTEMPT_CLEANUP_DATABASE_URL is required.")
  }

  const normalizedConnectionString = connectionString.trim()
  const identity = parsePostgresTargetIdentity(normalizedConnectionString, {
    label: "AUTH_LEGACY_ATTEMPT_CLEANUP_DATABASE_URL",
    requireDirectNeon: true,
  })

  return {
    connectionString: normalizedConnectionString,
    identity,
  }
}

/** Produces a secret-free stable binding for an explicitly approved database target. */
export function fingerprintLegacyAuthAttemptTarget(connectionString) {
  const { identity } = parseDirectTarget(connectionString)
  return fingerprintPostgresTargetIdentities(
    [identity],
    "massagelab-direct-neon-operational-target",
  )
}

function parseCleanupArgs(args) {
  if (args.length === 1 && args[0] === "--print-fingerprint") {
    return { mode: "fingerprint" }
  }

  let expectedFingerprint
  let rawMaxRows
  for (const argument of args) {
    if (argument.startsWith("--expected-fingerprint=")) {
      if (expectedFingerprint !== undefined) throw new Error("--expected-fingerprint may be provided once.")
      expectedFingerprint = argument.slice("--expected-fingerprint=".length)
    } else if (argument.startsWith("--max-rows=")) {
      if (rawMaxRows !== undefined) throw new Error("--max-rows may be provided once.")
      rawMaxRows = argument.slice("--max-rows=".length)
    } else {
      throw new Error("Use --print-fingerprint or provide --expected-fingerprint and --max-rows.")
    }
  }

  if (!FINGERPRINT_PATTERN.test(expectedFingerprint ?? "")) {
    throw new Error("--expected-fingerprint must be 64 lowercase hex characters.")
  }
  const maxRows = Number(rawMaxRows)
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 100) {
    throw new Error("--max-rows must be an integer in the range 1..100.")
  }
  return { mode: "cleanup", expectedFingerprint, maxRows }
}

/** Builds the single bounded statement executed inside one database transaction. */
function buildLegacyAuthAttemptCleanupSql(maxRows) {
  return `
WITH doomed AS (
  SELECT "id"
  FROM "AuthAttempt"
  ORDER BY "updatedAt", "id"
  LIMIT ${maxRows}
  FOR UPDATE SKIP LOCKED
)
DELETE FROM "AuthAttempt" AS legacy
USING doomed
WHERE legacy."id" = doomed."id";
`
}

function createCleanupPrismaClient(connectionString) {
  neonConfig.webSocketConstructor = ws
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })
}

/** Owns client lifetime and guarantees the bounded statement runs through one transaction client. */
export async function executeCleanupTransaction({
  connectionString,
  sql,
  createPrismaClient,
}) {
  if (typeof createPrismaClient !== "function") {
    throw new Error("An explicitly injected createPrismaClient factory is required.")
  }
  const prisma = createPrismaClient(connectionString)
  try {
    return await prisma.$transaction((transaction) => transaction.$executeRawUnsafe(sql))
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * Enforces all target and batch gates before constructing a client. Injection keeps
 * tests on a controlled executor and proves fingerprint mode never connects.
 */
export async function runLegacyAuthAttemptCleanupCli({
  args,
  env,
  createPrismaClient,
  writeLine = (line) => process.stdout.write(`${line}\n`),
}) {
  const options = parseCleanupArgs(args)
  const { connectionString } = parseDirectTarget(env.AUTH_LEGACY_ATTEMPT_CLEANUP_DATABASE_URL)
  const actualFingerprint = fingerprintLegacyAuthAttemptTarget(connectionString)

  if (options.mode === "fingerprint") {
    writeLine(actualFingerprint)
    return actualFingerprint
  }
  if (env.AUTH_LEGACY_ATTEMPT_CLEANUP !== "1") {
    throw new Error("AUTH_LEGACY_ATTEMPT_CLEANUP=1 is required.")
  }
  if (options.expectedFingerprint !== actualFingerprint) {
    throw new Error("The expected fingerprint does not match the selected target.")
  }
  if (typeof createPrismaClient !== "function") {
    throw new Error("An explicitly injected createPrismaClient factory is required.")
  }

  const deletedCount = Number(await executeCleanupTransaction({
    connectionString,
    sql: buildLegacyAuthAttemptCleanupSql(options.maxRows),
    createPrismaClient,
  }))
  if (!Number.isInteger(deletedCount) || deletedCount < 0 || deletedCount > options.maxRows) {
    throw new Error("Cleanup returned an invalid affected-row count.")
  }
  writeLine(`legacy_auth_attempt_rows_deleted=${deletedCount}`)
  return deletedCount
}

export function formatCleanupError(error) {
  return formatOperationalError(error)
}

async function main() {
  loadDotenv({ path: ".env.local", override: false, quiet: true })
  loadDotenv({ path: ".env", override: false, quiet: true })
  await runLegacyAuthAttemptCleanupCli({
    args: process.argv.slice(2),
    env: process.env,
    createPrismaClient: createCleanupPrismaClient,
  })
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ""
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`Legacy cleanup failed. ${formatCleanupError(error)}\n`)
    process.exitCode = 1
  })
}
