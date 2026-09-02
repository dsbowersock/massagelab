import { createHash, createHmac } from "node:crypto"
import type { PrismaClient } from "@prisma/client"

import { getAuthSecret } from "../auth-env.ts"
import { hashPassword } from "../auth-security.js"
import type { BrowserIdentityMethodFixtureIdentity, BrowserIdentityMethodFixtureScenario } from "./browser-fixture-identity.ts"
import { assertBrowserQaDatabaseTarget } from "../../scripts/assert-browser-qa-database-target.mjs"

export type { BrowserIdentityMethodFixtureScenario }

export const BROWSER_IDENTITY_METHOD_PASSWORD = "Browser-QA-only-password-2026!"

type FixtureClient = Pick<
  PrismaClient,
  "$transaction" | "backgroundCreditEntry" | "backgroundCreditWallet" | "commerceEvent" | "user"
>
type QaEnvironment = Record<string, string | undefined>

/**
 * Requires the exact fingerprint-approved runtime/direct pair before any
 * fixture mutation; URL values are compared in memory and never returned.
 */
export function requireBrowserIdentityMethodFixtureAuthorization(environment: QaEnvironment = process.env) {
  const expectedFingerprint = environment.MASSAGELAB_BROWSER_QA_DATABASE_FINGERPRINT?.trim()
  if (!expectedFingerprint) {
    throw new Error("Identity method browser fixture requires an approved disposable-database fingerprint.")
  }
  const runtimeUrl = environment.MASSAGELAB_BROWSER_QA_DATABASE_URL?.trim()
  const directUrl = environment.MASSAGELAB_BROWSER_QA_DIRECT_URL?.trim()
  if (!runtimeUrl || environment.DATABASE_URL?.trim() !== runtimeUrl) {
    throw new Error("Identity method browser fixture requires DATABASE_URL to equal the verified dedicated QA runtime target.")
  }
  if (!directUrl || environment.DIRECT_URL?.trim() !== directUrl) {
    throw new Error("Identity method browser fixture requires DIRECT_URL to equal the verified dedicated QA direct target.")
  }
  assertBrowserQaDatabaseTarget({ environment: environment as NodeJS.ProcessEnv, mode: "expected", expectedFingerprint })
}

/** Creates only the exact User/method/account/private-intent rows for one scenario. */
export async function createBrowserIdentityMethodFixtureRecords(input: {
  prismaClient: FixtureClient
  identity: BrowserIdentityMethodFixtureIdentity
  environment?: QaEnvironment
  now?: Date
}) {
  requireBrowserIdentityMethodFixtureAuthorization(input.environment)
  assertExampleIdentity(input.identity)
  const now = input.now ?? new Date()
  const secret = getAuthSecret()
  if (!secret) throw new Error("Identity method browser fixture requires AUTH_SECRET.")
  const passwordHash = await hashPassword(BROWSER_IDENTITY_METHOD_PASSWORD)
  const browserBindingToken = createHash("sha256")
    .update(`identity-method-fixture\0${input.identity.intentId}`)
    .digest("base64url")
  const hasPassword = input.identity.scenario !== "GOOGLE_ONLY"
  const hasGoogle = input.identity.scenario !== "MATCHING_LINK"
  const purpose = input.identity.scenario === "MATCHING_LINK"
    ? "SIGN_IN_OR_LINK"
    : input.identity.scenario === "GOOGLE_ONLY"
      ? "ADD_PASSWORD"
      : "REMOVE_PASSWORD"
  const status = input.identity.scenario === "MATCHING_LINK" ? "PROVIDER_PROVEN" : "CONSUMED"

  await input.prismaClient.user.create({
    data: {
      ...input.identity.user,
      emailVerified: now,
      ...(hasPassword ? { passwordCredential: { create: { passwordHash } } } : {}),
      ...(hasGoogle ? {
        accounts: {
          create: {
            type: "oauth",
            provider: "google",
            providerAccountId: input.identity.providerAccountId,
          },
        },
      } : {}),
      authMethodIntents: {
        create: {
          id: input.identity.intentId,
          purpose,
          status,
          provider: "google",
          browserBindingHash: createHmac("sha256", secret).update(`auth-method-binding\0${browserBindingToken}`).digest("hex"),
          providerAccountId: input.identity.providerAccountId,
          providerEmailHash: input.identity.scenario === "MATCHING_LINK"
            ? createHmac("sha256", secret).update(`verified-google-email\0${input.identity.user.email.toLowerCase()}`).digest("hex")
            : null,
          providerProvenAt: now,
          consumedAt: status === "CONSUMED" ? now : null,
          expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
        },
      },
    },
  })
  return {
    password: BROWSER_IDENTITY_METHOD_PASSWORD,
    intentId: input.identity.intentId,
    bindingCookie: `${input.identity.intentId}.${browserBindingToken}`,
  }
}

/** Deletes the deterministic user and exact runtime-owned credit side effects. */
export async function removeBrowserIdentityMethodFixtureRecords(input: {
  prismaClient: FixtureClient
  identity: BrowserIdentityMethodFixtureIdentity
  environment?: QaEnvironment
}) {
  requireBrowserIdentityMethodFixtureAuthorization(input.environment)
  assertExampleIdentity(input.identity)
  await input.prismaClient.$transaction(async (transaction) => {
    const existing = await transaction.user.findUnique({
      where: { id: input.identity.user.id },
      select: { email: true },
    })
    if (!existing) return
    if (existing.email !== input.identity.user.email) {
      throw new Error("Identity method browser fixture user/email ownership mismatch.")
    }

    await transaction.commerceEvent.deleteMany({ where: { userId: input.identity.user.id } })
    await transaction.backgroundCreditEntry.deleteMany({ where: { userId: input.identity.user.id } })
    await transaction.backgroundCreditWallet.deleteMany({ where: { userId: input.identity.user.id } })
    const removed = await transaction.user.deleteMany({
      where: { id: input.identity.user.id, email: input.identity.user.email },
    })
    if (removed.count !== 1) {
      throw new Error("Identity method browser fixture cleanup did not remove exactly one verified user.")
    }
  })
}

function assertExampleIdentity(identity: BrowserIdentityMethodFixtureIdentity) {
  if (!identity.user.email.endsWith(".example.test")
    || !identity.user.id.startsWith("browser-identity-")
    || !identity.intentId.startsWith("browser-intent-")
    || !identity.providerAccountId.startsWith("browser-google-")) {
    throw new Error("Identity method browser fixture refuses a non-example identity.")
  }
}
