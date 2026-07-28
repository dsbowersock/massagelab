// @ts-check

import { canManageAnatomyContent } from "./account-permissions.js"
import { accountPageTabs } from "./account-page.js"
import { normalizeSessionRoleAssignments } from "./account-role-assignments.js"
import { createAsyncKeyedTtlCache, createAsyncTtlCache } from "./async-ttl-cache.js"
import { getUserMembershipSummary } from "./membership.js"
import { getMembershipPricingCatalog } from "./membership-pricing.js"
import { getBackgroundCommerceSnapshot } from "./commerce/snapshot-service.ts"

const ACCOUNT_SURFACE_DATA_CACHE_TTL_MS = 30_000
const ACCOUNT_PRICING_CATALOG_CACHE_TTL_MS = 5 * 60_000

/**
 * @typedef {Record<string, any>} AccountPrismaClient
 * @typedef {{ role?: string, roles?: string[], roleAssignments?: Array<{ role: string, status: string }>, capabilities?: { canUseChimerCustomColors?: boolean, canUsePremiumBackgrounds?: boolean, hasActiveMembershipBenefits?: boolean } }} AccountSessionUser
 * @typedef {(prismaClient: AccountPrismaClient, userId: string) => Promise<any>} MembershipSummaryLoader
 * @typedef {() => Promise<any>} PricingCatalogLoader
 * @typedef {() => any | Promise<any>} ClinicalSyncReadinessLoader
 * @typedef {{ prismaClient: AccountPrismaClient, userId: string, sessionUser?: AccountSessionUser }} AccountLoadInput
 * @typedef {{ prismaClient: AccountPrismaClient, userId: string, clinicalSyncReadiness: any }} SyncLoadInput
 * @typedef {{ prismaClient: AccountPrismaClient, userId: string, getMembershipSummary: MembershipSummaryLoader, getPricingCatalog: PricingCatalogLoader }} MembershipLoadInput
 * @typedef {(input: { prismaClient: AccountPrismaClient, userId: string, includeRecentOrders?: boolean }) => Promise<any>} CommerceSnapshotLoader
 * @typedef {{ prismaClient: AccountPrismaClient, userId: string, getCommerceSnapshot: CommerceSnapshotLoader }} BackgroundCommerceLoadInput
 * @typedef {{ prismaClient?: AccountPrismaClient, getMembershipSummary?: MembershipSummaryLoader, getPricingCatalog?: PricingCatalogLoader, getCommerceSnapshot?: CommerceSnapshotLoader, getClinicalSyncReadiness?: ClinicalSyncReadinessLoader, now?: () => number }} AccountSurfaceDataLoaderOptions
 * @typedef {(input: { prismaClient: AccountPrismaClient, userId: string }) => Promise<any>} CacheableSurfaceLoader
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
function sessionRoleLabels(sessionUser) {
  return normalizeSessionRoleAssignments(sessionUser)
    .map((roleAssignment) => roleAssignment.role)
    .sort()
}

/**
 * @param {AccountSessionUser | undefined} sessionUser
 * @returns {boolean} Whether current feature-key benefits are active; missing
 * session or capability data intentionally fails closed to false.
 */
export function sessionHasActiveMembershipBenefits(sessionUser) {
  const capabilities = sessionUser?.capabilities
  // Fall back to legacy feature claims only when the aggregate claim is absent;
  // an explicit false value remains authoritative.
  return Boolean(
    capabilities?.hasActiveMembershipBenefits
      ?? (capabilities?.canUseChimerCustomColors || capabilities?.canUsePremiumBackgrounds),
  )
}

/**
 * @param {AccountLoadInput} input
 */
async function loadOverviewSurface({ prismaClient, userId }) {
  const [progressCount, achievementCount, templateCount] = await Promise.all([
    prismaClient.learningProgress.count({ where: { userId } }),
    prismaClient.achievement.count({ where: { userId } }),
    prismaClient.noteTemplate.count({ where: { userId } }),
  ])

  return {
    surface: "overview",
    counts: {
      progressCount,
      achievementCount,
      templateCount,
    },
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
    roleAssignments: normalizeSessionRoleAssignments(sessionUser),
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
 * Loads fresh server-authoritative commerce data and strips processor relations.
 *
 * @param {BackgroundCommerceLoadInput} input
 */
async function loadBackgroundCommerceSurface({ prismaClient, userId, getCommerceSnapshot }) {
  const [snapshot, orderRows] = await Promise.all([
    getCommerceSnapshot({ prismaClient, userId, includeRecentOrders: false }),
    prismaClient.commerceOrder.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
      select: {
        id: true,
        status: true,
        subtotalCents: true,
        taxCents: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        items: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            productKey: true,
            displayName: true,
            unitPriceCents: true,
            allocatedTaxCents: true,
            lineTotalCents: true,
            refundItems: {
              select: {
                amountCents: true,
                refund: { select: { status: true } },
              },
            },
          },
        },
      },
    }),
  ])

  return {
    surface: "orders-invoices",
    backgroundCommerce: {
      ...snapshot,
      orders: orderRows.map((order) => ({
        reference: order.id,
        status: order.status,
        subtotalAmount: order.subtotalCents,
        taxAmount: order.taxCents,
        totalAmount: order.totalCents,
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({
          backgroundId: item.productKey,
          displayName: item.displayName,
          unitAmount: item.unitPriceCents,
          taxAmount: item.allocatedTaxCents,
          totalAmount: item.lineTotalCents,
          refundedAmount: item.refundItems
            .filter((refundItem) => refundItem.refund?.status === "SUCCEEDED")
            .reduce((sum, refundItem) => sum + refundItem.amountCents, 0),
          refundStatuses: [...new Set(item.refundItems
            .map((refundItem) => refundItem.refund?.status)
            .filter(Boolean))],
        })),
      })),
    },
  }
}

/**
 * Membership pricing may stay cached independently from uncached commerce data.
 *
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
  getCommerceSnapshot = getBackgroundCommerceSnapshot,
  getClinicalSyncReadiness: getReadiness = defaultGetClinicalSyncReadiness,
  now = Date.now,
} = {}) {
  const pricingCatalogCache = createAsyncTtlCache({
    ttlMs: ACCOUNT_PRICING_CATALOG_CACHE_TTL_MS,
    load: () => getPricingCatalog(),
    now,
  })
  const cacheableSurfaceLoaders = /** @type {Map<string, CacheableSurfaceLoader>} */ (new Map([
    ["overview", (input) => loadOverviewSurface(input)],
    ["profile", (input) => loadProfileSurface(input)],
    ["security", (input) => loadSecuritySurface(input)],
    ["sync", async ({ prismaClient: resolvedPrismaClient, userId }) => loadSyncSurface({
      prismaClient: resolvedPrismaClient,
      userId,
      clinicalSyncReadiness: await getReadiness(),
    })],
    ["membership", ({ prismaClient: resolvedPrismaClient, userId }) => loadMembershipSurface({
      prismaClient: resolvedPrismaClient,
      userId,
      getMembershipSummary,
      getPricingCatalog: () => pricingCatalogCache.get(),
    })],
  ]))
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
    const resolvedPrismaClient = await resolvePrismaClient(prismaClient)
    const loadCachedSurface = cacheableSurfaceLoaders.get(surface)
    if (!loadCachedSurface) {
      throw new Error(`Unsupported cached account surface: ${surface}`)
    }
    return loadCachedSurface({ prismaClient: resolvedPrismaClient, userId })
  }

  const surfaceDataCache = createAsyncKeyedTtlCache({
    ttlMs: ACCOUNT_SURFACE_DATA_CACHE_TTL_MS,
    now,
    load: loadSurfaceData,
  })
  /**
   * @param {unknown} surface
   * @param {string} userId
   * @param {AccountSessionUser | undefined} sessionUser
   */
  async function getAccountSurfaceData(surface, userId, sessionUser) {
    const normalizedSurface = normalizeSurface(surface)
    if (normalizedSurface === "orders-invoices") {
      return loadBackgroundCommerceSurface({
        prismaClient: await resolvePrismaClient(prismaClient),
        userId,
        getCommerceSnapshot,
      })
    }
    if (normalizedSurface === "credentials") {
      return loadCredentialsSurface({
        prismaClient: await resolvePrismaClient(prismaClient),
        userId,
        sessionUser,
      })
    }
    if (!cacheableSurfaceLoaders.has(normalizedSurface)) {
      return loadLocalSurface(normalizedSurface, sessionUser)
    }
    const key = cacheKey(userId, normalizedSurface)

    const surfaceData = await surfaceDataCache.get(key)
    if (normalizedSurface !== "overview") {
      return surfaceData
    }

    // Keep request-scoped claims out of the shared TTL payload so refreshed
    // membership and role claims are reflected without waiting for expiry.
    const roleLabels = sessionRoleLabels(sessionUser)
    return {
      ...surfaceData,
      roleLabels,
      canManageAnatomy: canManageAnatomyContent(roleLabels),
      hasActiveMembershipBenefits: sessionHasActiveMembershipBenefits(sessionUser),
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
