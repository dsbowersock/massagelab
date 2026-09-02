#!/usr/bin/env node

import { resolve } from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"
import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"
import { config as loadDotenv } from "dotenv"
import ws from "ws"

import { deliverAccountSecurityEmailIntent } from "../lib/account-security-email-intents.ts"
import { formatOperationalError } from "./operational-error-redaction.mjs"
import { fingerprintPostgresTargetIdentities, parsePostgresTargetIdentity } from "./postgres-target-identity.mjs"

const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/

function parseDirectTarget(connectionString) {
  if (!connectionString?.trim()) {
    throw new Error("AUTH_SECURITY_NOTICE_RETRY_DATABASE_URL is required.")
  }
  const normalizedConnectionString = connectionString.trim()
  const identity = parsePostgresTargetIdentity(normalizedConnectionString, {
    label: "AUTH_SECURITY_NOTICE_RETRY_DATABASE_URL",
    requireDirectNeon: true,
  })
  return {
    connectionString: normalizedConnectionString,
    identity,
  }
}

/** Returns only a SHA-256 binding for the direct role/host/port/database tuple. */
export function fingerprintAccountSecurityEmailRetryTarget(connectionString) {
  const { identity } = parseDirectTarget(connectionString)
  return fingerprintPostgresTargetIdentities(
    [identity],
    "massagelab-account-security-email-retry-target",
  )
}

function parseArgs(args) {
  if (args.length === 1 && args[0] === "--print-fingerprint") return { mode: "fingerprint" }
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
  return { mode: "retry", expectedFingerprint, maxRows }
}

/**
 * Scans one bounded due set and delegates every selected row to the existing
 * claim/lease/CAS delivery owner. Exported execution has no live defaults.
 */
export async function runAccountSecurityEmailRetryCli({
  args,
  env,
  createPrismaClient,
  deliverIntent,
  now = new Date(),
  writeLine = (line) => process.stdout.write(`${line}\n`),
}) {
  const options = parseArgs(args)
  const { connectionString } = parseDirectTarget(env.AUTH_SECURITY_NOTICE_RETRY_DATABASE_URL)
  const actualFingerprint = fingerprintAccountSecurityEmailRetryTarget(connectionString)
  if (options.mode === "fingerprint") {
    writeLine(actualFingerprint)
    return actualFingerprint
  }
  if (env.AUTH_SECURITY_NOTICE_RETRY_DATABASE !== "1") {
    throw new Error("AUTH_SECURITY_NOTICE_RETRY_DATABASE=1 is required.")
  }
  if (env.AUTH_SECURITY_NOTICE_RETRY_SEND !== "1") {
    throw new Error("AUTH_SECURITY_NOTICE_RETRY_SEND=1 is required.")
  }
  if (options.expectedFingerprint !== actualFingerprint) {
    throw new Error("The expected fingerprint does not match the selected target.")
  }
  if (typeof createPrismaClient !== "function") {
    throw new Error("An explicitly injected createPrismaClient factory is required.")
  }
  if (typeof deliverIntent !== "function") {
    throw new Error("An explicitly injected deliverIntent worker is required.")
  }
  const capturedNow = now instanceof Date && Number.isFinite(now.getTime()) ? new Date(now) : null
  if (!capturedNow) throw new Error("A valid retry time is required.")

  const prisma = createPrismaClient(connectionString)
  const summary = { selected: 0, delivered: 0, failed: 0, ambiguous: 0, busy: 0 }
  try {
    const due = await prisma.accountSecurityEmailIntent.findMany({
      where: {
        OR: [
          { status: { in: ["PENDING", "FAILED"] } },
          { status: "PROCESSING", claimExpiresAt: { lt: capturedNow } },
        ],
      },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: options.maxRows,
      select: { id: true },
    })
    const boundedDue = due.slice(0, options.maxRows)
    summary.selected = boundedDue.length
    for (const { id } of boundedDue) {
      const result = await deliverIntent({ prismaClient: prisma, intentId: id, now: capturedNow })
      if (result?.status === "DELIVERED") summary.delivered += 1
      else if (result?.status === "FAILED") summary.failed += 1
      else if (result?.status === "AMBIGUOUS") summary.ambiguous += 1
      else summary.busy += 1
    }
  } finally {
    await prisma.$disconnect()
  }
  writeLine(`account_security_notice_retry_selected=${summary.selected} delivered=${summary.delivered} failed=${summary.failed} ambiguous=${summary.ambiguous} busy=${summary.busy}`)
  return summary
}

function createAccountSecurityEmailRetryPrismaClient(connectionString) {
  neonConfig.webSocketConstructor = ws
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })
}

/** Returns bounded operator context without exposing recipients, URLs, or secret-bearing tokens. */
export function formatAccountSecurityEmailRetryError(error) {
  return formatOperationalError(error)
}

async function main() {
  loadDotenv({ path: ".env.local", override: false, quiet: true })
  loadDotenv({ path: ".env", override: false, quiet: true })
  await runAccountSecurityEmailRetryCli({
    args: process.argv.slice(2),
    env: process.env,
    createPrismaClient: createAccountSecurityEmailRetryPrismaClient,
    deliverIntent: deliverAccountSecurityEmailIntent,
  })
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ""
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`Account-security notice retry failed. ${formatAccountSecurityEmailRetryError(error)}\n`)
    process.exitCode = 1
  })
}
