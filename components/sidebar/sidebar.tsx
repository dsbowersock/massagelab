import { getCurrentSession } from "@/auth"
import { AppSidebarClient } from "@/components/sidebar/app-sidebar-client"
import type { SidebarUser } from "@/components/sidebar/app-sidebar-client"
import type { SidebarCalendarContext } from "@/components/sidebar/sidebar-calendar-provider"
import { canSyncAccountPreferences } from "@/lib/account-preferences"
import { emptySidebarCalendarContext } from "@/lib/sidebar-calendar-context"

const emptyCalendarContext = emptySidebarCalendarContext as SidebarCalendarContext

export async function getAppSidebarData() {
  const session = await getCurrentSession()
  const sessionUser = session?.user as
    | {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
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
  const calendarContext = emptyCalendarContext

  return { user, calendarContext, canSyncAccountSettings }
}

export async function AppSidebar() {
  const { user } = await getAppSidebarData()

  return <AppSidebarClient user={user} />
}
