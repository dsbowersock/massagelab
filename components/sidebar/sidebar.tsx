import { getCurrentRscSession as getCurrentSession } from "@/lib/rsc-session"
import { AppSidebarClient } from "@/components/sidebar/app-sidebar-client"
import type { SidebarNavigation, SidebarUser } from "@/components/sidebar/app-sidebar-client"
import { canSyncAccountPreferences } from "@/lib/account-preferences"
import { projectAccountShellAppSettings } from "@/lib/account-shell-bootstrap"
import { FEATURE_KEYS } from "@/lib/membership"
import { resolveNavigation } from "@/lib/navigation"
import { prisma } from "@/lib/prisma"

type SidebarDatabase = Pick<typeof prisma, "practiceMembership">

/** PHI-free server projection shared by the root account-shell providers. */
export type AccountShellBootstrap = {
  /** Stable account owner used to reject stale client work; null for guests. */
  ownerKey: string | null
  /** Whether this owner may synchronize account-backed preferences. */
  syncEnabled: boolean
  /** Server-known preference hydration state for the current owner. */
  preferenceStatus: "anonymous" | "ready" | "failed"
  /** Sanitized JSON data that is safe to hydrate across the server-client boundary. */
  appSettings: ReturnType<typeof projectAccountShellAppSettings>
  hasPracticeMembership: boolean
}

export async function getAppSidebarData() {
  const session = await getCurrentSession()
  const sessionUser = session?.user as
    | {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: string | null
      roles?: string[] | null
      roleAssignments?: Array<{ role: string; status: string }> | null
      capabilities?: Record<string, boolean> | null
      featureKeys?: string[] | null
    }
    | undefined
  const ownerId = canonicalSidebarOwnerId(sessionUser?.id)
  const authenticatedUser = canSyncAccountPreferences(sessionUser) && ownerId
    ? { ...sessionUser, id: ownerId }
    : undefined
  const [preferenceContext, navigationContext] = await Promise.all([
    loadSidebarAccountPreference(authenticatedUser?.id),
    getSidebarNavigationContext(authenticatedUser),
  ])
  const user: SidebarUser = authenticatedUser
    ? {
      name: authenticatedUser.name ?? "MassageLab user",
      email: authenticatedUser.email ?? "",
      image: authenticatedUser.image ?? "",
      quickActionOnboarding: preferenceContext.quickActionOnboarding,
    }
    : null
  const canSyncAccountSettings = Boolean(authenticatedUser)
  const navigation = resolveNavigation(navigationContext) as SidebarNavigation
  const accountBootstrap: AccountShellBootstrap = {
    ownerKey: authenticatedUser?.id ?? null,
    syncEnabled: canSyncAccountSettings,
    preferenceStatus: preferenceContext.preferenceStatus,
    appSettings: preferenceContext.appSettings,
    hasPracticeMembership: (
      navigationContext.authState === "signed-in"
      && navigationContext.practiceRoles.length > 0
    ),
  }

  return { user, canSyncAccountSettings, navigation, accountBootstrap }
}

export async function AppSidebar() {
  const { user, navigation } = await getAppSidebarData()

  return <AppSidebarClient user={user} navigation={navigation} />
}

/**
 * Loads the root-owned account preference once, keeping onboarding separate
 * from the allowlisted app settings that may hydrate every shell consumer.
 */
async function loadSidebarAccountPreference(userId?: string) {
  if (!userId) {
    return {
      quickActionOnboarding: undefined,
      preferenceStatus: "anonymous" as const,
      appSettings: projectAccountShellAppSettings(undefined),
    }
  }

  try {
    const preference = await prisma.userPreference.findUnique({
      where: { userId },
      select: { appSettings: true },
    })
    const appSettings = objectRecord(preference?.appSettings)
    const onboarding = objectRecord(appSettings.onboarding)
    const quickActionOnboarding = Object.keys(onboarding).length === 0
      ? undefined
      : {
        primaryRole: onboarding.primaryRole,
        useCases: onboarding.useCases,
        quickActions: onboarding.quickActions,
      }

    return {
      quickActionOnboarding,
      preferenceStatus: "ready" as const,
      appSettings: projectAccountShellAppSettings(appSettings),
    }
  } catch (error) {
    logSidebarContextLoadError("Failed to load sidebar quick-action preferences", error)
    return {
      quickActionOnboarding: undefined,
      preferenceStatus: "failed" as const,
      appSettings: projectAccountShellAppSettings(undefined),
    }
  }
}

export async function getSidebarNavigationContext(sessionUser?: {
  id?: string
  role?: string | null
  roles?: string[] | null
  roleAssignments?: Array<{ role: string; status: string }> | null
  capabilities?: Record<string, boolean> | null
  featureKeys?: string[] | null
}, database: SidebarDatabase = prisma) {
  const ownerId = canonicalSidebarOwnerId(sessionUser?.id)
  if (!sessionUser || !ownerId) {
    return { authState: "anonymous" as const }
  }

  const featureKeys = sidebarFeatureKeys(sessionUser)
  const practiceRoles = await loadSidebarPracticeRoles(ownerId, database)

  return {
    authState: "signed-in" as const,
    accountRoles: Array.isArray(sessionUser.roles) ? sessionUser.roles : sessionUser.role ? [sessionUser.role] : ["USER"],
    roleAssignments: Array.isArray(sessionUser.roleAssignments) ? sessionUser.roleAssignments : [],
    featureKeys,
    capabilities: sessionUser.capabilities ?? {},
    practiceRoles,
  }
}

/** Account ids are opaque; reject surrounding whitespace instead of remapping it. */
function canonicalSidebarOwnerId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value === value.trim()
    ? value
    : null
}

/** Coerces JSON-ish values into object records; arrays and primitives become empty objects. */
function objectRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function sidebarFeatureKeys(sessionUser: {
  featureKeys?: string[] | null
  capabilities?: Record<string, boolean> | null
}) {
  // Any current-session array, including empty, is authoritative; capabilities support only legacy sessions without it.
  return Array.isArray(sessionUser.featureKeys)
    ? sessionUser.featureKeys
    : featureKeysFromCapabilities(sessionUser.capabilities)
}

async function loadSidebarPracticeRoles(userId: string, database: SidebarDatabase = prisma) {
  try {
    return await database.practiceMembership.findMany({
      where: { userId },
      select: { practiceId: true, role: true },
      orderBy: { createdAt: "asc" },
    })
  } catch (error) {
    logSidebarContextLoadError("Failed to load sidebar practice role context", error)
    return []
  }
}

function logSidebarContextLoadError(message: string, error: unknown) {
  console.warn(message, { error: summarizeServerError(error) })
}

function summarizeServerError(error: unknown) {
  if (!error || typeof error !== "object") {
    return { name: typeof error }
  }

  const maybeError = error as { name?: unknown; code?: unknown }

  return {
    name: typeof maybeError.name === "string" ? maybeError.name : "Error",
    code: typeof maybeError.code === "string" ? maybeError.code : undefined,
  }
}

function featureKeysFromCapabilities(capabilities?: Record<string, boolean> | null) {
  const featureKeys = []

  if (capabilities?.canUseLocalClinicalTools) {
    featureKeys.push(FEATURE_KEYS.therapistDocumentationTools)
  }

  return featureKeys
}
