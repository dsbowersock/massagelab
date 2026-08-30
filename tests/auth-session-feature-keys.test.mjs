import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")
const [authUsersSource, authSource, sidebarSource] = await Promise.all([
  read("lib/auth-users.ts"),
  read("auth.ts"),
  read("components/sidebar/sidebar.tsx"),
])

function accountDatabase(calls) {
  return {
    user: {
      async findUnique() {
        calls.userGraphReads += 1
        return {
          email: "person@example.test",
          emailVerified: new Date("2026-08-29T12:00:00.000Z"),
          authSessionVersion: 3,
          roles: [{ role: "USER", status: "VERIFIED" }],
          membershipSubscriptions: [],
          studentAccess: null,
          twoFactorSecret: null,
        }
      },
    },
    userRole: {
      findUnique: async () => null,
      upsert: async () => {},
    },
  }
}

function loadAuthUsers(database, calls) {
  const loadTemporaryGrants = async (receivedDatabase, userId) => {
    calls.temporaryGrantReads += 1
    assert.equal(receivedDatabase, database)
    assert.equal(userId, "user-1")
    return []
  }
  const buildEntitlements = () => {
    calls.entitlementBuilds += 1
    return { features: ["premium_backgrounds"] }
  }

  return {
    ...loadCompiledModule(authUsersSource, "lib/auth-users.feature-keys.test.ts", {
      "@/lib/auth-env": { isAdminEmail: () => false },
      "@/lib/account-permissions": {
        buildAccountCapabilities: (_roles, input) => {
          calls.capabilityFeatureKeys = input.features
          return { canUsePremiumBackgrounds: input.features.includes("premium_backgrounds") }
        },
        highestRole: () => "USER",
        normalizeRoleAssignments: (roles) => roles,
      },
      "@/lib/commerce/transactions": { runCommerceTransaction: async () => {} },
      "@/lib/membership": { buildEntitlements, loadActiveTemporaryGrants: loadTemporaryGrants },
      "@/lib/phi-sync": { isHostedClinicalSyncEnabled: () => false },
      "@/lib/prisma": { prisma: database },
    }),
    loadTemporaryGrants,
  }
}

function captureAuthCallbacks(getUserAuthState) {
  let capturedConfig
  class CredentialsSignin extends Error {}
  const NextAuth = (config) => {
    capturedConfig = config
    return { handlers: {}, auth: async () => null, signIn() {}, signOut() {} }
  }
  NextAuth.CredentialsSignin = CredentialsSignin

  loadCompiledModule(authSource, "auth.feature-keys.test.ts", {
    "next-auth": NextAuth,
    "next-auth/providers/credentials": (config) => config,
    "next-auth/providers/google": (config) => config,
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
    "@auth/prisma-adapter": { PrismaAdapter: () => ({}) },
    "@/lib/prisma": { prisma: {} },
    "@/lib/auth-account-linking": { googleProfileEmail: () => "", isVerifiedGoogleProfile: () => true },
    "@/lib/auth-env": {
      getAuthSecret: () => "test-secret",
      getGoogleAuthConfig: () => null,
      getSiteUrl: () => "http://localhost:3000",
    },
    "@/lib/auth-method-proof": { verifyPasswordMethodProof: async () => ({ status: "INVALID" }) },
    "@/lib/auth-request": { authRequestNetworkIdentifier: () => "test-network" },
    "@/lib/auth-method-intents": {
      AUTH_METHOD_INTENT_COOKIE: "ml-auth-method-binding",
      parseAuthMethodIntentBinding: () => null,
      prepareGoogleAuthentication: async () => ({ kind: "REJECTED", recoveryPath: "/login?auth=google-retry" }),
    },
    "@/lib/auth-users": {
      ensureGoogleUserState: async () => {},
      ensureUserRole: async () => {},
      getUserAuthState,
    },
    "@/lib/auth-session-version": {
      decideAuthSessionVersion: ({ currentVersion }) => ({ accepted: true, version: currentVersion ?? 0 }),
    },
    "@/lib/auth-security": { normalizeEmail: (value) => String(value ?? "").trim().toLowerCase() },
  })

  return capturedConfig.callbacks
}

function loadSidebar(database) {
  return loadCompiledModule(sidebarSource, "components/sidebar/sidebar.feature-keys.test.tsx", {
    "@/auth": { getCurrentSession: async () => null },
    "@/components/sidebar/app-sidebar-client": { AppSidebarClient: () => null },
    "@/lib/account-preferences": { canSyncAccountPreferences: () => false },
    "@/lib/membership": {
      FEATURE_KEYS: { therapistDocumentationTools: "therapist_documentation_tools" },
    },
    "@/lib/navigation": { resolveNavigation: (context) => context },
    "@/lib/prisma": { prisma: database },
  })
}

describe("auth session feature-key reuse", () => {
  it("computes feature keys once in auth state and exposes the same array to capabilities", async () => {
    const calls = { userGraphReads: 0, temporaryGrantReads: 0, entitlementBuilds: 0, capabilityFeatureKeys: null }
    const database = accountDatabase(calls)
    const { getUserAuthState, loadTemporaryGrants } = loadAuthUsers(database, calls)

    const state = await getUserAuthState("user-1", database, loadTemporaryGrants)

    assert.deepEqual(state.featureKeys, ["premium_backgrounds"])
    assert.equal(state.capabilities.canUsePremiumBackgrounds, true)
    assert.equal(state.featureKeys, calls.capabilityFeatureKeys)
    assert.deepEqual(calls, {
      userGraphReads: 1,
      temporaryGrantReads: 1,
      entitlementBuilds: 1,
      capabilityFeatureKeys: state.featureKeys,
    })
  })

  it("carries sanitized feature keys through JWT and Session", async () => {
    const callbacks = captureAuthCallbacks(async () => ({
      authSessionVersion: 0,
      role: "USER",
      roles: ["USER"],
      roleAssignments: [{ role: "USER", status: "VERIFIED" }],
      capabilities: { canUsePremiumBackgrounds: true },
      featureKeys: ["premium_backgrounds"],
      emailVerified: true,
      twoFactorEnabled: false,
    }))

    const token = await callbacks.jwt({ token: { sub: "user-1" }, user: undefined, account: undefined })
    assert.deepEqual(token.featureKeys, ["premium_backgrounds"])

    token.featureKeys = ["premium_backgrounds", 7, null]
    const session = await callbacks.session({ session: { user: {} }, token })
    assert.deepEqual(session.user.featureKeys, ["premium_backgrounds"])
  })

  it("fails closed to an empty feature-key array when auth-state refresh fails", async () => {
    const callbacks = captureAuthCallbacks(async () => {
      throw new Error("restricted database failure")
    })
    const warnings = []
    const originalWarn = console.warn
    console.warn = (...args) => warnings.push(args)
    try {
      const token = await callbacks.jwt({ token: { sub: "user-1" }, user: undefined, account: undefined })
      assert.deepEqual(token.featureKeys, [])
      const session = await callbacks.session({ session: { user: {} }, token })
      assert.deepEqual(session.user.featureKeys, [])
      assert.equal(warnings.length, 1)
    } finally {
      console.warn = originalWarn
    }
  })

  it("uses capability fallback only when an older session has no feature-key array", async () => {
    const calls = { practiceRoleReads: 0 }
    const database = {
      practiceMembership: {
        async findMany() {
          calls.practiceRoleReads += 1
          return [{ practiceId: "practice-1", role: "OWNER" }]
        },
      },
    }
    const { getSidebarNavigationContext } = loadSidebar(database)
    assert.equal(typeof getSidebarNavigationContext, "function")

    const current = await getSidebarNavigationContext({
      id: "user-1",
      featureKeys: [],
      capabilities: { canUseLocalClinicalTools: true },
    }, database)
    const older = await getSidebarNavigationContext({
      id: "user-1",
      capabilities: { canUseLocalClinicalTools: true },
    }, database)

    assert.deepEqual(current.featureKeys, [])
    assert.deepEqual(older.featureKeys, ["therapist_documentation_tools"])
    assert.equal(calls.practiceRoleReads, 2)
  })

  it("keeps the source contract explicit across auth, token types, and sidebar", async () => {
    const authTypes = await read("types/next-auth.d.ts")
    assert.match(authUsersSource, /const entitlements = buildEntitlements\(/)
    assert.match(authUsersSource, /featureKeys: entitlements\.features/)
    assert.match(authSource, /token\.featureKeys = state\.featureKeys/)
    assert.match(authSource, /token\.featureKeys = \[\]/)
    assert.match(authSource, /sessionUser\.featureKeys = Array\.isArray\(token\.featureKeys\)/)
    assert.match(authTypes, /featureKeys: string\[\]/)
    assert.match(authTypes, /featureKeys\?: string\[\]/)
    assert.doesNotMatch(sidebarSource, /getUserEntitlementState/)
    assert.match(sidebarSource, /sessionUser\.featureKeys/)
    assert.match(sidebarSource, /featureKeysFromCapabilities/)
  })
})
