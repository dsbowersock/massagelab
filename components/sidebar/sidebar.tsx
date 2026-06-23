import { getCurrentSession } from "@/auth"
import { AppSidebarClient } from "@/components/sidebar/app-sidebar-client"
import type { SidebarNavigation, SidebarUser } from "@/components/sidebar/app-sidebar-client"
import { canSyncAccountPreferences } from "@/lib/account-preferences"
import { FEATURE_KEYS, getUserEntitlementState } from "@/lib/membership"
import { resolveNavigation } from "@/lib/navigation"
import { prisma } from "@/lib/prisma"

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
    }
    | undefined
  const [quickActionOnboarding, navigationContext] = await Promise.all([
    loadSidebarQuickActionOnboarding(sessionUser?.id),
    getSidebarNavigationContext(sessionUser),
  ])
  const user: SidebarUser = sessionUser
    ? {
      name: sessionUser.name ?? "MassageLab user",
      email: sessionUser.email ?? "",
      image: sessionUser.image ?? "",
      quickActionOnboarding,
    }
    : null
  const canSyncAccountSettings = canSyncAccountPreferences(sessionUser)
  const navigation = resolveNavigation(navigationContext) as SidebarNavigation

  return { user, canSyncAccountSettings, navigation }
}

export async function AppSidebar() {
  const { user, navigation } = await getAppSidebarData()

  return <AppSidebarClient user={user} navigation={navigation} />
}

async function loadSidebarQuickActionOnboarding(userId?: string) {
  if (!userId) {
    return undefined
  }

  try {
    const preference = await prisma.userPreference.findUnique({
      where: { userId },
      select: { appSettings: true },
    })
    const appSettings = objectRecord(preference?.appSettings)
    const onboarding = objectRecord(appSettings.onboarding)

    if (Object.keys(onboarding).length === 0) {
      return undefined
    }

    return {
      primaryRole: onboarding.primaryRole,
      useCases: onboarding.useCases,
      quickActions: onboarding.quickActions,
    }
  } catch (error) {
    logSidebarContextLoadError("Failed to load sidebar quick-action preferences", error)
    return undefined
  }
}

async function getSidebarNavigationContext(sessionUser?: {
  id?: string
  role?: string | null
  roles?: string[] | null
  roleAssignments?: Array<{ role: string; status: string }> | null
  capabilities?: Record<string, boolean> | null
}) {
  if (!sessionUser?.id) {
    return { authState: "anonymous" as const }
  }

  const [featureKeys, practiceRoles] = await Promise.all([
    loadSidebarFeatureKeys(sessionUser.id, sessionUser.capabilities),
    loadSidebarPracticeRoles(sessionUser.id),
  ])

  return {
    authState: "signed-in" as const,
    accountRoles: Array.isArray(sessionUser.roles) ? sessionUser.roles : sessionUser.role ? [sessionUser.role] : ["USER"],
    roleAssignments: Array.isArray(sessionUser.roleAssignments) ? sessionUser.roleAssignments : [],
    featureKeys,
    capabilities: sessionUser.capabilities ?? {},
    practiceRoles,
  }
}

function objectRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

async function loadSidebarFeatureKeys(userId: string, capabilities?: Record<string, boolean> | null) {
  try {
    const entitlements = await getUserEntitlementState(prisma, userId)
    return entitlements.features
  } catch (error) {
    logSidebarContextLoadError("Failed to load sidebar entitlement context", error)
    return featureKeysFromCapabilities(capabilities)
  }
}

async function loadSidebarPracticeRoles(userId: string) {
  try {
    return await prisma.practiceMembership.findMany({
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

  if (capabilities?.canUseChimerCustomColors) {
    featureKeys.push(FEATURE_KEYS.chimerCustomColors)
  }

  return featureKeys
}
