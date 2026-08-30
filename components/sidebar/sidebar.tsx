import { getCurrentRscSession as getCurrentSession } from "@/lib/rsc-session"
import { AppSidebarClient } from "@/components/sidebar/app-sidebar-client"
import type { SidebarNavigation, SidebarUser } from "@/components/sidebar/app-sidebar-client"
import { canSyncAccountPreferences } from "@/lib/account-preferences"
import { projectAccountShellAppSettings } from "@/lib/account-shell-bootstrap"
import { FEATURE_KEYS } from "@/lib/membership"
import { resolveNavigation } from "@/lib/navigation"
import { prisma } from "@/lib/prisma"

type SidebarDatabase = Pick<typeof prisma, "practiceMembership">

export type AccountShellBootstrap = {
  ownerKey: string | null
  syncEnabled: boolean
  preferenceStatus: "anonymous" | "ready" | "failed"
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
  const [preferenceContext, navigationContext] = await Promise.all([
    loadSidebarAccountPreference(sessionUser?.id),
    getSidebarNavigationContext(sessionUser),
  ])
  const user: SidebarUser = sessionUser
    ? {
      name: sessionUser.name ?? "MassageLab user",
      email: sessionUser.email ?? "",
      image: sessionUser.image ?? "",
      quickActionOnboarding: preferenceContext.quickActionOnboarding,
    }
    : null
  const canSyncAccountSettings = canSyncAccountPreferences(sessionUser)
  const navigation = resolveNavigation(navigationContext) as SidebarNavigation
  const accountBootstrap: AccountShellBootstrap = {
    ownerKey: canSyncAccountSettings ? sessionUser?.id ?? null : null,
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
  if (!sessionUser?.id) {
    return { authState: "anonymous" as const }
  }

  const featureKeys = sidebarFeatureKeys(sessionUser)
  const practiceRoles = await loadSidebarPracticeRoles(sessionUser.id, database)

  return {
    authState: "signed-in" as const,
    accountRoles: Array.isArray(sessionUser.roles) ? sessionUser.roles : sessionUser.role ? [sessionUser.role] : ["USER"],
    roleAssignments: Array.isArray(sessionUser.roleAssignments) ? sessionUser.roleAssignments : [],
    featureKeys,
    capabilities: sessionUser.capabilities ?? {},
    practiceRoles,
  }
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
