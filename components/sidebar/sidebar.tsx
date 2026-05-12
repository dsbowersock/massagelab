import { getCurrentSession } from "@/auth"
import { AppSidebarClient } from "@/components/sidebar/app-sidebar-client"
import type { SidebarCalendarContext, SidebarUser } from "@/components/sidebar/app-sidebar-client"
import { isCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"

const emptyCalendarContext: SidebarCalendarContext = {
  practice: null,
  therapists: [],
  canManageAvailability: false,
}

async function getSidebarCalendarContext(userId?: string): Promise<SidebarCalendarContext> {
  if (!userId || !(await isCalendarDatabaseReady())) {
    return emptyCalendarContext
  }

  try {
    const membership = await prisma.practiceMembership.findFirst({
      where: {
        userId,
        role: {
          in: ["OWNER", "THERAPIST", "STAFF"],
        },
      },
      include: {
        practice: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    })

    if (!membership) {
      return emptyCalendarContext
    }

    const therapistMemberships = await prisma.practiceMembership.findMany({
      where: {
        practiceId: membership.practiceId,
        role: {
          in: ["OWNER", "THERAPIST"],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profile: {
              select: {
                displayName: true,
                therapistName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    })

    return {
      practice: membership.practice,
      therapists: therapistMemberships.map((therapistMembership) => {
        const user = therapistMembership.user
        const label = user.profile?.therapistName
          ?? user.profile?.displayName
          ?? user.name
          ?? user.email
          ?? "Practitioner"

        return {
          id: user.id,
          label,
        }
      }),
      canManageAvailability: membership.role === "OWNER" || membership.role === "THERAPIST",
    }
  } catch {
    return emptyCalendarContext
  }
}

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
  const calendarContext = await getSidebarCalendarContext(sessionUser?.id)

  return { user, calendarContext }
}

export async function AppSidebar() {
  const { user, calendarContext } = await getAppSidebarData()

  return <AppSidebarClient user={user} calendarContext={calendarContext} />
}
