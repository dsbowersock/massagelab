import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { decideAuthSessionVersion } from "../lib/auth-session-version.ts"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const loadCompiledModule = createCompiledModuleLoader(import.meta.url)

describe("JWT session-version decisions", () => {
  it("adopts the current non-negative database version on sign-in", () => {
    assert.deepEqual(decideAuthSessionVersion({ currentVersion: 4, tokenVersion: undefined, isSignIn: true }), {
      accepted: true,
      version: 4,
    })
    assert.deepEqual(decideAuthSessionVersion({ currentVersion: 4, tokenVersion: "client-value", isSignIn: true }), {
      accepted: true,
      version: 4,
    })
  })

  it("accepts exact current versions and upgrades only legacy version-zero tokens", () => {
    assert.deepEqual(decideAuthSessionVersion({ currentVersion: 2, tokenVersion: 2, isSignIn: false }), {
      accepted: true,
      version: 2,
    })
    assert.deepEqual(decideAuthSessionVersion({ currentVersion: 0, tokenVersion: undefined, isSignIn: false }), {
      accepted: true,
      version: 0,
    })
  })

  it("rejects legacy, stale, newer, malformed, negative, and fractional versions", () => {
    for (const [label, currentVersion, tokenVersion] of [
      ["legacy after increment", 1, undefined],
      ["stale", 3, 2],
      ["newer", 2, 3],
      ["null", 0, null],
      ["string", 0, "0"],
      ["negative", 0, -1],
      ["fractional", 0, 0.5],
      ["unsafe integer", 0, Number.MAX_SAFE_INTEGER + 1],
    ]) {
      assert.deepEqual(
        decideAuthSessionVersion({ currentVersion, tokenVersion, isSignIn: false }),
        { accepted: false },
        label,
      )
    }
  })

  it("fails closed when the database version is not a non-negative safe integer", () => {
    for (const currentVersion of [undefined, null, "0", -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      assert.deepEqual(
        decideAuthSessionVersion({ currentVersion, tokenVersion: 0, isSignIn: true }),
        { accepted: false },
      )
    }
  })
})

describe("JWT session-version integration contract", () => {
  it("declares the additive schema, migration, and server-only JWT field", async () => {
    const [schema, migration, authTypes] = await Promise.all([
      read("prisma/schema.prisma"),
      read("prisma/migrations/20260808093000_admin_jwt_session_version/migration.sql"),
      read("types/next-auth.d.ts"),
    ])

    assert.match(schema, /authSessionVersion\s+Int\s+@default\(0\)/)
    assert.match(migration, /ALTER TABLE "User"[\s\S]*ADD COLUMN "authSessionVersion" INTEGER NOT NULL DEFAULT 0;/)
    assert.match(authTypes, /interface JWT \{[\s\S]*authSessionVersion\?: number/)
    const sessionDeclarationMatch = authTypes.match(/interface Session \{[\s\S]*?^  \}/m)
    assert.ok(sessionDeclarationMatch, "Expected the Session interface declaration")
    const sessionDeclaration = sessionDeclarationMatch[0]
    assert.doesNotMatch(sessionDeclaration, /authSessionVersion/)
  })

  it("returns null without privilege fields when a normal database refresh rejects the JWT version", async () => {
    const [authSource, authUsersSource] = await Promise.all([
      read("auth.ts"),
      read("lib/auth-users.ts"),
    ])
    let capturedConfig
    const authStateCalls = []
    class CredentialsSignin extends Error {}
    const NextAuth = (config) => {
      capturedConfig = config
      return { handlers: {}, auth() {}, signIn() {}, signOut() {} }
    }
    NextAuth.CredentialsSignin = CredentialsSignin

    loadCompiledModule(authSource, "auth.test.ts", {
      "next-auth": NextAuth,
      "next-auth/providers/credentials": (config) => config,
      "next-auth/providers/google": (config) => config,
      "@auth/prisma-adapter": { PrismaAdapter: () => ({}) },
      "@/lib/prisma": { prisma: {} },
      "@/lib/auth-account-linking": { googleProfileEmail: () => "", isVerifiedGoogleProfile: () => true },
      "@/lib/auth-env": {
        getAuthSecret: () => "test-secret",
        getGoogleAuthConfig: () => null,
        getSiteUrl: () => "http://localhost:3000",
      },
      "@/lib/auth-rate-limit": {
        assertRateLimit: async () => {}, clearAttempts: async () => {},
        rateLimitKey: () => "key", recordFailedAttempt: async () => {},
      },
      "@/lib/auth-users": {
        ensureGoogleUserState: async () => {}, ensureUserRole: async () => {},
        async getUserAuthState(userId) {
          authStateCalls.push(userId)
          return {
            authSessionVersion: 2,
            role: "ADMIN",
            roles: ["ADMIN"],
            roleAssignments: [{ role: "ADMIN", status: "VERIFIED" }],
            capabilities: { canAdministerAccounts: true },
            emailVerified: true,
            twoFactorEnabled: true,
          }
        },
      },
      "@/lib/auth-session-version": { decideAuthSessionVersion },
      "@/lib/auth-security": {
        decryptSecret: () => "", normalizeEmail: () => "", verifyBackupCode: async () => false,
        verifyPassword: async () => false, verifyTotpCode: () => false,
      },
    })

    const token = { sub: "user-1", authSessionVersion: 1 }
    const result = await capturedConfig.callbacks.jwt({ token, user: undefined, account: undefined })

    assert.equal(result, null)
    assert.deepEqual(authStateCalls, ["user-1"])
    for (const field of ["role", "roles", "roleAssignments", "capabilities", "emailVerified", "twoFactorEnabled"]) {
      assert.equal(Object.hasOwn(token, field), false, field)
    }
    assert.match(authUsersSource, /select:\s*\{[\s\S]*authSessionVersion: true/)
    assert.match(authUsersSource, /return \{\s*authSessionVersion: user\?\.authSessionVersion,/)
    assert.doesNotMatch(authUsersSource, /authSessionVersion: user\?\.authSessionVersion\s*\?\?\s*0/)
  })
})
