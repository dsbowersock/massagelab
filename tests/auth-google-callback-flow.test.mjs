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
    assert.notEqual(oauthBranch, -1, "Auth.js OAuth callback branch marker is missing")
    const authorizedCall = callbackSource.indexOf("const redirect = await handleAuthorized({", oauthBranch)
    assert.notEqual(authorizedCall, -1, "Auth.js authorization call marker is missing")
    const adapterCall = callbackSource.indexOf("await handleLoginOrRegister(", authorizedCall)
    assert.notEqual(adapterCall, -1, "Auth.js adapter call marker is missing")
    const authorizedFunction = callbackSource.indexOf("async function handleAuthorized")
    assert.notEqual(authorizedFunction, -1, "Auth.js authorization function marker is missing")
    const signInCall = callbackSource.indexOf("authorized = await signIn(params)", authorizedFunction)
    assert.notEqual(signInCall, -1, "Auth.js signIn callback marker is missing")
    assert.ok(authorizedCall > oauthBranch)
    assert.ok(adapterCall > authorizedCall)
    assert.ok(signInCall > authorizedFunction)
  })

  it("binds Google preparation to the current browser and maps every decision behaviorally", async () => {
    const authSource = await readFile(new URL("../auth.ts", import.meta.url), "utf8")
    let capturedConfig
    let googleProviderConfig
    let decision = { kind: "REJECTED", recoveryPath: "/login?auth=google-retry" }
    let verified = true
    let currentSession = null
    const preparationInputs = []
    const NextAuth = (config) => {
      capturedConfig = config
      return { handlers: {}, auth: async () => currentSession, signIn() {}, signOut() {} }
    }
    NextAuth.CredentialsSignin = class CredentialsSignin extends Error {}
    loadCompiledModule(authSource, "auth-google-callback.test.ts", {
      "next-auth": NextAuth,
      "next-auth/providers/credentials": (config) => config,
      "next-auth/providers/google": (config) => {
        googleProviderConfig = config
        return config
      },
      "next/headers": { cookies: async () => ({ get: () => ({ value: "intent-123." + "a".repeat(43) }) }) },
      "@auth/prisma-adapter": { PrismaAdapter: () => ({}) },
      "@/lib/prisma": { prisma: {} },
      "@/lib/auth-account-linking": { googleProfileEmail: () => "person@example.com", isVerifiedGoogleProfile: () => verified },
      "@/lib/auth-env": { getAuthSecret: () => "test-secret", getGoogleAuthConfig: () => ({ clientId: "id", clientSecret: "secret" }), getSiteUrl: () => "https://massagelab.test" },
      "@/lib/auth-method-proof": { verifyPasswordMethodProof: async () => ({ status: "INVALID" }) },
      "@/lib/auth-request": { authRequestNetworkIdentifier: () => "network" },
      "@/lib/auth-method-intents": {
        AUTH_METHOD_INTENT_COOKIE: "ml-auth-method-binding",
        parseAuthMethodIntentBinding: () => ({ intentId: "intent-123", browserBindingToken: "a".repeat(43) }),
        prepareGoogleAuthentication: async (input) => {
          preparationInputs.push(input)
          return decision
        },
      },
      "@/lib/auth-users": { ensureGoogleUserState: async () => {}, ensureUserRole: async () => {}, getUserAuthState: async () => ({}) },
      "@/lib/auth-session-version": { decideAuthSessionVersion: () => ({ accepted: false }) },
      "@/lib/auth-security": { normalizeEmail: (value) => String(value ?? "").trim().toLowerCase() },
    })

    const google = { account: { provider: "google", providerAccountId: "sub-a" }, profile: { email_verified: true } }
    assert.notEqual(googleProviderConfig.allowDangerousEmailAccountLinking, true)
    decision = { kind: "CONTINUE", userId: "user-1" }
    assert.equal(await capturedConfig.callbacks.signIn(google), true)
    assert.equal(preparationInputs.at(-1).intentId, "intent-123")
    assert.equal(preparationInputs.at(-1).browserBindingToken, "a".repeat(43))
    assert.equal(preparationInputs.at(-1).currentSessionUser, undefined)

    decision = { kind: "REJECTED", recoveryPath: "/login?auth=google-retry" }
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
    assert.equal(preparationInputs.at(-1).currentSessionUser, currentSession.user)
    const preparedCount = preparationInputs.length
    verified = false
    assert.equal(await capturedConfig.callbacks.signIn(google), "/login?auth=google-unavailable")
    assert.equal(preparationInputs.length, preparedCount)
  })
})
