import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const recoveryUrl = new URL("../lib/two-factor-management-recovery.ts", import.meta.url)

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

  it("fails closed for wrong status, unknown code, arbitrary messages, provider detail, and malformed JSON", async () => {
    const { resolveTwoFactorManagementRecovery } = await loadRecovery()
    const generic = { message: "Something went wrong. Please try again." }

    for (const [status, result] of [
      [500, { code: "AUTHENTICATION_REQUIRED" }],
      [403, { code: "PRIVATE_PROVIDER_DETAIL" }],
      [409, { code: "CONFLICT", message: "database row account-991 changed" }],
      [403, { code: "GOOGLE_PROOF_EXPIRED", providerAccountId: "provider-private-991" }],
      [403, null],
      [403, []],
      [403, "not-json"],
      [403, {}],
    ]) {
      const actual = resolveTwoFactorManagementRecovery(status, result)
      if (status === 409 && result?.code === "CONFLICT") {
        assert.deepEqual(actual, {
          message: "Your security settings changed. Refresh Account Security and try again.",
        })
        assert.doesNotMatch(actual.message, /database|account-991/i)
      } else if (status === 403 && result?.code === "GOOGLE_PROOF_EXPIRED") {
        assert.deepEqual(actual, { message: "Your Google confirmation expired. Confirm with Google again." })
        assert.doesNotMatch(actual.message, /provider-private/i)
      } else {
        assert.deepEqual(actual, generic)
      }
    }
  })
})
