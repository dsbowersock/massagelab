// @ts-check

import { canManageAnatomyContent } from "./account-permissions.js"
import { accountPageTabs } from "./account-page.js"
import { createAsyncKeyedTtlCache, createAsyncTtlCache } from "./async-ttl-cache.js"
import { getUserMembershipSummary } from "./membership.js"
import { getMembershipPricingCatalog } from "./membership-pricing.js"

const ACCOUNT_SURFACE_DATA_CACHE_TTL_MS = 30_000
const ACCOUNT_PRICING_CATALOG_CACHE_TTL_MS = 5 * 60_000

/**
 * @typedef {Record<string, any>} AccountPrismaClient
 * @typedef {{ role?: string, roles?: string[], roleAssignments?: Array<{ role: string, status: string }>, capabilities?: { canUseChimerCustomColors?: boolean } }} AccountSessionUser
 * @typedef {(prismaClient: AccountPrismaClient, userId: string) => Promise<any>} MembershipSummaryLoader
 * @typedef {() => Promise<any>} PricingCatalogLoader
 * @typedef {() => any | Promise<any>} ClinicalSyncReadinessLoader
 * @typedef {{ prismaClient: AccountPrismaClient, userId: string, sessionUser?: AccountSessionUser }} AccountLoadInput
 * @typedef {{ prismaClient: AccountPrismaClient, userId: string, clinicalSyncReadiness: any }} SyncLoadInput
 * @typedef {{ prismaClient: AccountPrismaClient, userId: string, getMembershipSummary: MembershipSummaryLoader, getPricingCatalog: PricingCatalogLoader }} MembershipLoadInput
 * @typedef {{ prismaClient?: AccountPrismaClient, getMembershipSummary?: MembershipSummaryLoader, getPricingCatalog?: PricingCatalogLoader, getClinicalSyncReadiness?: ClinicalSyncReadinessLoader, now?: () => number }} AccountSurfaceDataLoaderOptions
 */

const accountSurfaceIds = new Set(accountPageTabs.map((tab) => tab.id))

/**
 * @param {unknown} surface
 */
function normalizeSurface(surface) {
  const candidate = String(surface ?? "overview")
  return accountSurfaceIds.has(candidate) ? candidate : "overview"
}

/**
 * @param {AccountSessionUser | undefined} sessionUser
 */
function sessionRoleAssignments(sessionUser) {
  if (Array.isArray(sessionUser?.roleAssignments) && sessionUser.roleAssignments.length > 0) {
    return sessionUser.roleAssignments
  }

  if (Array.isArray(sessionUser?.roles) && sessionUser.roles.length > 0) {
    return sessionUser.roles.map((role) => ({ role, status: "VERIFIED" }))
  }

  return [{ role: sessionUser?.role ?? "USER", status: "VERIFIED" }]
}

/**
 * @param {AccountSessionUser | undefined} sessionUser
 */
function sessionRoleLabels(sessionUser) {
  return sessionRoleAssignments(sessionUser)
    .map((roleAssignment) => roleAssignment.role)
    .sort()
}

/**
 * @param {AccountSessionUser | undefined} sessionUser
 */
function sessionCanUseChimerCustomColors(sessionUser) {
  return Boolean(sessionUser?.capabilities?.canUseChimerCustomColors)
}

/**
 * @param {AccountLoadInput} input
 */
async function loadOverviewSurface({ prismaClient, userId, sessionUser }) {
  const [progressCount, achievementCount, templateCount] = await Promise.all([
    prismaClient.learningProgress.count({ where: { userId } }),
    prismaClient.achievement.count({ where: { userId } }),
    prismaClient.noteTemplate.count({ where: { userId } }),
  ])
  const roleLabels = sessionRoleLabels(sessionUser)

  return {
    surface: "overview",
    counts: {
      progressCount,
      achievementCount,
      templateCount,
    },
    roleLabels,
    canManageAnatomy: canManageAnatomyContent(roleLabels),
    canUseChimerCustomColors: sessionCanUseChimerCustomColors(sessionUser),
  }
}

/**
 * @param {{ prismaClient: AccountPrismaClient, userId: string }} input
 */
async function loadProfileSurface({ prismaClient, userId }) {
  return {
    surface: "profile",
    profile: await prismaClient.userProfile.findUnique({ where: { userId } }),
  }
}

/**
 * @param {{ prismaClient: AccountPrismaClient, userId: string }} input
 */
async function loadSecuritySurface({ prismaClient, userId }) {
  const [passwordCredential, googleAccount] = await Promise.all([
    prismaClient.passwordCredential.findUnique({
      where: { userId },
      select: { id: true },
    }),
    prismaClient.account.findFirst({
      where: { userId, provider: "google" },
      select: { id: true },
    }),
  ])

  return {
    surface: "security",
    hasPasswordCredential: Boolean(passwordCredential),
    googleLinked: Boolean(googleAccount),
  }
}

/**
 * @param {AccountLoadInput} input
 */
async function loadCredentialsSurface({ prismaClient, userId, sessionUser }) {
  return {
    surface: "credentials",
    roleAssignments: sessionRoleAssignments(sessionUser),
    credentialVerifications: await prismaClient.credentialVerification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  }
}

/**
 * @param {SyncLoadInput} input
 */
async function loadSyncSurface({ prismaClient, userId, clinicalSyncReadiness }) {
  const preferences = await prismaClient.userPreference.findUnique({
    where: { userId },
    select: { updatedAt: true },
  })

  return {
    surface: "sync",
    preferences,
    clinicalSyncReadiness,
  }
}

/**
 * @param {MembershipLoadInput} input
 */
async function loadMembershipSurface({ prismaClient, userId, getMembershipSummary, getPricingCatalog }) {
  const [membershipSummary, pricingCatalog] = await Promise.all([
    getMembershipSummary(prismaClient, userId),
    getPricingCatalog(),
  ])

  return {
    surface: "membership",
    membershipSummary,
    pricingCatalog,
  }
}

/**
 * @param {string} surface
 * @param {AccountSessionUser | undefined} sessionUser
 */
function loadLocalSurface(surface, sessionUser) {
  const roleLabels = sessionRoleLabels(sessionUser)

  return {
    surface,
    roleLabels,
    canManageAnatomy: canManageAnatomyContent(roleLabels),
  }
}

/**
 * @param {AccountSurfaceDataLoaderOptions} [options]
 */
export function createAccountSurfaceDataLoader({
  prismaClient,
  getMembershipSummary = getUserMembershipSummary,
  getPricingCatalog = getMembershipPricingCatalog,
  getClinicalSyncReadiness: getReadiness = defaultGetClinicalSyncReadiness,
  now = Date.now,
} = {}) {
  const pricingCatalogCache = createAsyncTtlCache({
    ttlMs: ACCOUNT_PRICING_CATALOG_CACHE_TTL_MS,
    load: () => getPricingCatalog(),
    now,
  })
  const keysByUser = /** @type {Map<string, Set<string>>} */ (new Map())

  /**
   * @param {string} userId
   * @param {string} surface
   */
  function cacheKey(userId, surface) {
    const key = `${userId}:${surface}`
    const userKeys = keysByUser.get(userId) ?? new Set()
    userKeys.add(key)
    keysByUser.set(userId, userKeys)
    return key
  }

  /**
   * @param {string} key
   */
  async function loadSurfaceData(key) {
    const separatorIndex = key.indexOf(":")
    const userId = key.slice(0, separatorIndex)
    const surface = key.slice(separatorIndex + 1)
    const sessionUser = pendingSessionUsers.get(key)
    const resolvedPrismaClient = await resolvePrismaClient(prismaClient)

    if (surface === "overview") {
      return loadOverviewSurface({ prismaClient: resolvedPrismaClient, userId, sessionUser })
    }

    if (surface === "profile") {
      return loadProfileSurface({ prismaClient: resolvedPrismaClient, userId })
    }

    if (surface === "security") {
      return loadSecuritySurface({ prismaClient: resolvedPrismaClient, userId })
    }

    if (surface === "credentials") {
      return loadCredentialsSurface({ prismaClient: resolvedPrismaClient, userId, sessionUser })
    }

    if (surface === "sync") {
      return loadSyncSurface({
        prismaClient: resolvedPrismaClient,
        userId,
        clinicalSyncReadiness: await getReadiness(),
      })
    }

    if (surface === "membership") {
      return loadMembershipSurface({
        prismaClient: resolvedPrismaClient,
        userId,
        getMembershipSummary,
        getPricingCatalog: () => pricingCatalogCache.get(),
      })
    }

    return loadLocalSurface(surface, sessionUser)
  }

  const surfaceDataCache = createAsyncKeyedTtlCache({
    ttlMs: ACCOUNT_SURFACE_DATA_CACHE_TTL_MS,
    now,
    load: loadSurfaceData,
  })
  const pendingSessionUsers = /** @type {Map<string, AccountSessionUser | undefined>} */ (new Map())

  /**
   * @param {unknown} surface
   * @param {string} userId
   * @param {AccountSessionUser | undefined} sessionUser
   */
  async function getAccountSurfaceData(surface, userId, sessionUser) {
    const normalizedSurface = normalizeSurface(surface)
    const key = cacheKey(userId, normalizedSurface)

    pendingSessionUsers.set(key, sessionUser)
    try {
      return await surfaceDataCache.get(key)
    } finally {
      pendingSessionUsers.delete(key)
    }
  }

  /**
   * @param {string | undefined} userId
   * @param {unknown} [surface]
   */
  function clearAccountSurfaceDataCache(userId, surface) {
    if (!userId) {
      surfaceDataCache.clear()
      keysByUser.clear()
      pricingCatalogCache.clear()
      return
    }

    if (surface) {
      surfaceDataCache.clear(cacheKey(userId, normalizeSurface(surface)))
      return
    }

    for (const key of keysByUser.get(userId) ?? []) {
      surfaceDataCache.clear(key)
    }
    keysByUser.delete(userId)
  }

  return {
    getAccountSurfaceData,
    clearAccountSurfaceDataCache,
  }
}

const defaultAccountSurfaceDataLoader = createAccountSurfaceDataLoader()

export const getAccountSurfaceData = defaultAccountSurfaceDataLoader.getAccountSurfaceData
export const clearAccountSurfaceDataCache = defaultAccountSurfaceDataLoader.clearAccountSurfaceDataCache

/**
 * @param {AccountPrismaClient | undefined} prismaClient
 */
async function resolvePrismaClient(prismaClient) {
  if (prismaClient) {
    return prismaClient
  }

  const prismaModule = await import("@/lib/prisma")
  return prismaModule.prisma
}

async function defaultGetClinicalSyncReadiness() {
  const phiSyncModule = await import("@/lib/phi-sync")
  return phiSyncModule.getClinicalSyncReadiness()
}
