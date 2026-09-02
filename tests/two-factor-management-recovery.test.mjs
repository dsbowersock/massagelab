import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const recoveryUrl = new URL("../lib/two-factor-management-recovery.ts", import.meta.url)

/** Verifies the recovery owner exists before compiling it in an isolated test module. */
function loadRecovery() {
  assert.equal(existsSync(fileURLToPath(recoveryUrl)), true, "missing two-factor recovery owner")
  return readFile(recoveryUrl, "utf8").then((source) => (
    loadCompiledModule(source, "lib/two-factor-management-recovery.test.ts")
  ))
}

describe("two-factor management recovery guidance", () => {
  it("maps every public failure pair to fixed actionable guidance", async () => {
    const { resolveTwoFactorManagementRecovery } = await loadRecovery()
    const cases = [
      [401, "AUTHENTICATION_REQUIRED", "Your sign-in session ended. Sign in and try again."],
      [400, "INVALID_REQUEST", "Check the required fields and confirmation, then try again."],
      [403, "UNTRUSTED_REQUEST", "Refresh Account Security and try again from this page."],
      [429, "RATE_LIMITED", "Too many attempts. Wait a little, then try again."],
      [409, "PASSWORD_REQUIRED", "Add a password sign-in method before setting up two-factor authentication."],
      [403, "PRIMARY_PROOF_INVALID", "Your password or Google confirmation was not accepted. Try again."],
      [403, "GOOGLE_PROOF_EXPIRED", "Your Google confirmation expired. Confirm with Google again."],
      [400, "TWO_FACTOR_REQUIRED", "Enter your current authenticator or backup code."],
      [403, "TWO_FACTOR_INVALID", "The authenticator or backup code was not accepted. Check it and try again."],
      [409, "ALREADY_ENABLED", "Two-factor authentication is already enabled. Refresh Account Security."],
      [409, "NOT_ENABLED", "Two-factor authentication is not enabled. Refresh Account Security."],
      [403, "ENROLLMENT_EXPIRED", "This setup expired. Start two-factor setup again."],
      [409, "CONFLICT", "Your security settings changed. Refresh Account Security and try again."],
    ]

    for (const [status, code, message] of cases) {
      assert.deepEqual(
        resolveTwoFactorManagementRecovery(status, { code }),
        { message },
        `${status}:${code}`,
      )
    }
  })

  it("uses fixed public guidance while rejecting wrong status, unknown code, and malformed bodies", async () => {
    const { resolveTwoFactorManagementRecovery } = await loadRecovery()
    const generic = { message: "Something went wrong. Please try again." }

    for (const { label, status, result, expected } of [
      {
        label: "known code with wrong status",
        status: 500,
        result: { code: "AUTHENTICATION_REQUIRED" },
        expected: generic,
      },
      {
        label: "unknown code",
        status: 403,
        result: { code: "PRIVATE_PROVIDER_DETAIL" },
        expected: generic,
      },
      {
        label: "known conflict ignores arbitrary message",
        status: 409,
        result: { code: "CONFLICT", message: "database row account-991 changed" },
        expected: { message: "Your security settings changed. Refresh Account Security and try again." },
      },
      {
        label: "known expiry ignores provider detail",
        status: 403,
        result: { code: "GOOGLE_PROOF_EXPIRED", providerAccountId: "provider-private-991" },
        expected: { message: "Your Google confirmation expired. Confirm with Google again." },
      },
      { label: "null body", status: 403, result: null, expected: generic },
      { label: "array body", status: 403, result: [], expected: generic },
      { label: "string body", status: 403, result: "not-json", expected: generic },
      { label: "empty object", status: 403, result: {}, expected: generic },
    ]) {
      const actual = resolveTwoFactorManagementRecovery(status, result)
      assert.deepEqual(actual, expected, label)
      assert.doesNotMatch(actual.message, /database|account-991|provider-private/i, label)
    }
  })
})
