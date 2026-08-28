import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)

describe("Google callback safety seam", () => {
  it("runs Auth.js signIn callback before adapter login/register handling", async () => {
    const callbackSource = await readFile(
      new URL("../node_modules/@auth/core/lib/actions/callback/index.js", import.meta.url),
      "utf8",
    )
    const oauthBranch = callbackSource.indexOf('provider.type === "oauth"')
    const authorizedCall = callbackSource.indexOf("const redirect = await handleAuthorized({", oauthBranch)
    const adapterCall = callbackSource.indexOf("await handleLoginOrRegister(", authorizedCall)
    const authorizedFunction = callbackSource.indexOf("async function handleAuthorized")
    const signInCall = callbackSource.indexOf("authorized = await signIn(params)", authorizedFunction)
    assert.ok(oauthBranch >= 0)
    assert.ok(authorizedCall > oauthBranch)
    assert.ok(adapterCall > authorizedCall)
    assert.ok(signInCall > authorizedFunction)
  })

  it("does not allow Auth.js automatic email account linking", async () => {
    const authSource = await readFile(new URL("../auth.ts", import.meta.url), "utf8")
    assert.doesNotMatch(authSource, /allowDangerousEmailAccountLinking\s*:\s*true/)
    assert.doesNotMatch(authSource, /OAuthAccountNotLinked/)
    assert.match(authSource, /prepareGoogleAuthentication/)
    assert.doesNotMatch(authSource, /return\s+false/)
  })

  it("maps every Google intent decision to a fixed local destination", async () => {
    const authSource = await readFile(new URL("../auth.ts", import.meta.url), "utf8")
    assert.match(authSource, /result\.kind === "CONTINUE"\) return true/)
    assert.match(authSource, /result\.kind === "LINK_REQUIRED"\) return "\/account\/link-google"/)
    assert.match(authSource, /result\.kind === "REAUTH_COMPLETE"\) return "\/account\?tab=security&reauth=complete"/)
    assert.match(authSource, /return result\.recoveryPath/)
    assert.match(authSource, /\/login\?auth=google-unavailable/)
  })

  it("returns fixed recoverable paths for callback rejection decisions", async () => {
    const authSource = await readFile(new URL("../auth.ts", import.meta.url), "utf8")
    let capturedConfig
    let decision = { kind: "REJECTED", recoveryPath: "/login?auth=google-retry" }
    let verified = true
    let currentSession = null
    const NextAuth = (config) => {
      capturedConfig = config
      return { handlers: {}, auth: async () => currentSession, signIn() {}, signOut() {} }
    }
    NextAuth.CredentialsSignin = class CredentialsSignin extends Error {}
    loadCompiledModule(authSource, "auth-google-callback.test.ts", {
      "next-auth": NextAuth,
      "next-auth/providers/credentials": (config) => config,
      "next-auth/providers/google": (config) => config,
      "next/headers": { cookies: async () => ({ get: () => ({ value: "intent-123." + "a".repeat(43) }) }) },
      "@auth/prisma-adapter": { PrismaAdapter: () => ({}) },
      "@/lib/prisma": { prisma: {} },
      "@/lib/auth-account-linking": { googleProfileEmail: () => "person@example.com", isVerifiedGoogleProfile: () => verified },
      "@/lib/auth-env": { getAuthSecret: () => "test-secret", getGoogleAuthConfig: () => ({ clientId: "id", clientSecret: "secret" }), getSiteUrl: () => "https://massagelab.test" },
      "@/lib/auth-method-proof": { verifyPasswordMethodProof: async () => ({ status: "INVALID" }) },
      "@/lib/auth-method-intents": {
        AUTH_METHOD_INTENT_COOKIE: "ml-auth-method-binding",
        parseAuthMethodIntentBinding: () => ({ intentId: "intent-123", browserBindingToken: "a".repeat(43) }),
        prepareGoogleAuthentication: async () => decision,
      },
      "@/lib/auth-users": { ensureGoogleUserState: async () => {}, ensureUserRole: async () => {}, getUserAuthState: async () => ({}) },
      "@/lib/auth-session-version": { decideAuthSessionVersion: () => ({ accepted: false }) },
      "@/lib/auth-security": { normalizeEmail: (value) => String(value ?? "").trim().toLowerCase() },
    })

    const google = { account: { provider: "google", providerAccountId: "sub-a" }, profile: { email_verified: true } }
    assert.equal(await capturedConfig.callbacks.signIn(google), "/login?auth=google-retry")
    decision = { kind: "REJECTED", recoveryPath: "/account?tab=security&auth=google-retry" }
    assert.equal(await capturedConfig.callbacks.signIn(google), "/account?tab=security&auth=google-retry")
    decision = { kind: "LINK_REQUIRED", userId: "user-1" }
    assert.equal(await capturedConfig.callbacks.signIn(google), "/account/link-google")
    decision = { kind: "REAUTH_COMPLETE", purpose: "LINK_GOOGLE", userId: "user-1" }
    assert.equal(await capturedConfig.callbacks.signIn(google), "/account?tab=security&reauth=complete")
    currentSession = { user: { id: "user-a", email: "account-a@example.com" } }
    decision = { kind: "REJECTED", recoveryPath: "/account?tab=security&auth=google-retry" }
    assert.equal(await capturedConfig.callbacks.signIn(google), "/account?tab=security&auth=google-retry")
    verified = false
    assert.equal(await capturedConfig.callbacks.signIn(google), "/login?auth=google-unavailable")
  })
})
