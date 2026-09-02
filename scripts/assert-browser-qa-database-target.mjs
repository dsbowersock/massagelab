import { timingSafeEqual } from "node:crypto"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import {
  fingerprintPostgresTargetIdentities,
  parsePostgresTargetIdentity,
} from "./postgres-target-identity.mjs"

const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/

/** Parses only the non-secret database identity tuple used by the fingerprint. */
export function parseBrowserQaDatabaseTuple(value) {
  return parsePostgresTargetIdentity(value, { label: "Browser QA target" })
}

/** Hashes runtime and direct identities without passwords, parameters, or URL output. */
export function fingerprintBrowserQaDatabaseTarget(runtimeUrl, directUrl) {
  const identity = [
    parseBrowserQaDatabaseTuple(runtimeUrl),
    parseBrowserQaDatabaseTuple(directUrl),
  ]
  return fingerprintPostgresTargetIdentities(identity, "massagelab-browser-qa-database-target")
}

/**
 * Fails closed unless this is an explicitly opted-in, non-Production target
 * and the caller requests either read-only display or an exact approved hash.
 * @param {{
 *   environment?: Record<string, string | undefined>,
 *   mode?: "print" | "expected",
 *   expectedFingerprint?: string,
 * }} [input]
 */
export function assertBrowserQaDatabaseTarget({ environment = process.env, mode, expectedFingerprint } = {}) {
  if (environment.MASSAGELAB_BROWSER_QA_DATABASE !== "1") {
    throw new Error("Browser QA database target requires MASSAGELAB_BROWSER_QA_DATABASE=1.")
  }
  const vercelEnvironment = String(environment.VERCEL_ENV ?? "").trim().toLowerCase()
  if (vercelEnvironment === "production") {
    throw new Error("Browser QA database target refuses the Production environment.")
  }
  if (vercelEnvironment !== "preview" && vercelEnvironment !== "development") {
    throw new Error("Browser QA database target requires VERCEL_ENV=preview or VERCEL_ENV=development.")
  }
  const runtimeUrl = environment.MASSAGELAB_BROWSER_QA_DATABASE_URL?.trim()
  const directUrl = environment.MASSAGELAB_BROWSER_QA_DIRECT_URL?.trim()
  if (!runtimeUrl) throw new Error("Browser QA database target requires MASSAGELAB_BROWSER_QA_DATABASE_URL.")
  if (!directUrl) throw new Error("Browser QA database target requires MASSAGELAB_BROWSER_QA_DIRECT_URL.")
  if (mode !== "print" && mode !== "expected") {
    throw new Error("Browser QA database target requires one exact fingerprint mode.")
  }

  const fingerprint = fingerprintBrowserQaDatabaseTarget(runtimeUrl, directUrl)
  if (mode === "expected") {
    if (!FINGERPRINT_PATTERN.test(expectedFingerprint ?? "")) {
      throw new Error("Approved browser QA fingerprint must be 64 lowercase hexadecimal characters.")
    }
    const actualBytes = Buffer.from(fingerprint, "hex")
    const expectedBytes = Buffer.from(expectedFingerprint, "hex")
    if (!timingSafeEqual(actualBytes, expectedBytes)) {
      throw new Error("Browser QA database target fingerprint does not match the exact approved target.")
    }
  }
  return { fingerprint }
}

/**
 * Returns a fail-closed yes/no gate for private browser rows without printing,
 * connecting, or exposing any target value.
 * @param {Record<string, string | undefined>} [environment]
 */
export function isBrowserQaDatabaseTargetAuthorized(environment = process.env) {
  const runtimeUrl = environment.MASSAGELAB_BROWSER_QA_DATABASE_URL
  const directUrl = environment.MASSAGELAB_BROWSER_QA_DIRECT_URL
  const expectedFingerprint = environment.MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT
  if (!runtimeUrl || !directUrl || !expectedFingerprint) return false
  if (runtimeUrl !== runtimeUrl.trim() || directUrl !== directUrl.trim() || expectedFingerprint !== expectedFingerprint.trim()) return false
  if (environment.DATABASE_URL !== runtimeUrl || environment.DIRECT_URL !== directUrl) return false
  try {
    assertBrowserQaDatabaseTarget({ environment, mode: "expected", expectedFingerprint })
    return true
  } catch {
    return false
  }
}

/** Runs the read-only CLI without ever echoing a connection string. */
export function runBrowserQaDatabaseTargetCli({
  argv = process.argv.slice(2),
  environment = process.env,
  log = console.log,
  error = console.error,
} = {}) {
  try {
    if (argv.length !== 1) throw new Error("Use exactly one browser QA fingerprint mode.")
    const argument = argv[0]
    const mode = argument === "--print-fingerprint" ? "print" : "expected"
    const expectedPrefix = "--expected-fingerprint="
    if (mode === "expected" && !argument.startsWith(expectedPrefix)) {
      throw new Error("Use --print-fingerprint or --expected-fingerprint=<64 lowercase hex>.")
    }
    const expectedFingerprint = mode === "expected" ? argument.slice(expectedPrefix.length) : undefined
    const result = assertBrowserQaDatabaseTarget({ environment, mode, expectedFingerprint })
    log(result.fingerprint)
    return { exitCode: 0, fingerprint: result.fingerprint }
  } catch (caught) {
    error(caught instanceof Error ? caught.message : "Browser QA database target verification failed.")
    return { exitCode: 1 }
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null
if (invokedPath === import.meta.url) {
  const result = runBrowserQaDatabaseTargetCli()
  process.exitCode = result.exitCode
}
