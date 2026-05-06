import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  canUnlinkOAuthAccount,
  googleProfileEmail,
  isVerifiedGoogleProfile,
} from "../lib/auth-account-linking.js"

describe("Auth account linking helpers", () => {
  it("trusts Google profiles only when Google reports a verified email", () => {
    assert.equal(googleProfileEmail({ email: " USER@Example.COM " }), "user@example.com")
    assert.equal(isVerifiedGoogleProfile({ email: "user@example.com", email_verified: true }), true)
    assert.equal(isVerifiedGoogleProfile({ email: "user@example.com", email_verified: false }), false)
    assert.equal(isVerifiedGoogleProfile({ email_verified: true }), false)
  })

  it("blocks Google unlinking unless email/password remains available", () => {
    assert.equal(canUnlinkOAuthAccount({ provider: "google", hasPasswordCredential: true, emailVerified: true }), true)
    assert.equal(canUnlinkOAuthAccount({ provider: "google", hasPasswordCredential: false, emailVerified: true }), false)
    assert.equal(canUnlinkOAuthAccount({ provider: "google", hasPasswordCredential: true, emailVerified: false }), false)
    assert.equal(canUnlinkOAuthAccount({ provider: "github", hasPasswordCredential: true, emailVerified: true }), false)
  })
})
