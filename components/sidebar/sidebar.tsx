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
  const user: SidebarUser = sessionUser
    ? {
      name: sessionUser.name ?? "MassageLab user",
      email: sessionUser.email ?? "",
      image: sessionUser.image ?? "",
    }
    : null
  const canSyncAccountSettings = canSyncAccountPreferences(sessionUser)
  const navigationContext = await getSidebarNavigationContext(sessionUser)
  const navigation = resolveNavigation(navigationContext) as SidebarNavigation

  return { user, canSyncAccountSettings, navigation }
}

export async function AppSidebar() {
  const { user, navigation } = await getAppSidebarData()

  return <AppSidebarClient user={user} navigation={navigation} />
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

async function loadSidebarFeatureKeys(userId: string, capabilities?: Record<string, boolean> | null) {
  try {
    const entitlements = await getUserEntitlementState(prisma, userId)
    return entitlements.features
  } catch (error) {
    console.error("Failed to load sidebar entitlement context", { userId, error })
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
    console.error("Failed to load sidebar practice role context", { userId, error })
    return []
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
