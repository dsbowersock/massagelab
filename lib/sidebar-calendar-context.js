// @ts-check

import { createAsyncKeyedTtlCache } from "./async-ttl-cache.js"

const SIDEBAR_CALENDAR_CONTEXT_CACHE_TTL_MS = 60_000

/**
 * @typedef {{ id: string, name: string }} SidebarPractice
 * @typedef {{ id: string, label: string }} SidebarTherapist
 * @typedef {{
 *   practice: SidebarPractice | null,
 *   therapists: SidebarTherapist[],
 *   canManageAvailability: boolean,
 *   pendingAppointmentRequestCount: number,
 *   openWaitlistEntryCount: number,
 * }} SidebarCalendarContext
 */

const emptySidebarTherapists = /** @type {SidebarTherapist[]} */ (/** @type {unknown} */ (Object.freeze([])))

export const emptySidebarCalendarContext = /** @type {SidebarCalendarContext} */ (Object.freeze({
  practice: null,
  therapists: emptySidebarTherapists,
  canManageAvailability: false,
  pendingAppointmentRequestCount: 0,
  openWaitlistEntryCount: 0,
}))

/**
 * @param {string} userId
 * @returns {Promise<SidebarCalendarContext>}
 */
async function loadSidebarCalendarContext(userId) {
  if (!(await isCalendarReady())) {
    return emptySidebarCalendarContext
  }

  try {
    const prisma = await getPrismaClient()
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
      return emptySidebarCalendarContext
    }

    const [therapistMemberships, pendingAppointmentRequestCount, openWaitlistEntryCount] = await Promise.all([
      prisma.practiceMembership.findMany({
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
      }),
      prisma.appointment.count({
        where: {
          practiceId: membership.practiceId,
          status: "REQUESTED",
          ...(membership.role === "THERAPIST" ? { therapistId: userId } : {}),
        },
      }),
      prisma.bookingWaitlistEntry.count({
        where: {
          practiceId: membership.practiceId,
          status: "OPEN",
        },
      }),
    ])

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
      pendingAppointmentRequestCount,
      openWaitlistEntryCount,
    }
  } catch (error) {
    console.error("Failed to load sidebar calendar context", { userId, error })
    return emptySidebarCalendarContext
  }
}

const sidebarCalendarContextCache = createAsyncKeyedTtlCache({
  ttlMs: SIDEBAR_CALENDAR_CONTEXT_CACHE_TTL_MS,
  load: loadSidebarCalendarContext,
})

/**
 * @param {string | undefined} userId
 * @returns {Promise<SidebarCalendarContext>}
 */
export async function getSidebarCalendarContext(userId) {
  if (!userId) {
    return emptySidebarCalendarContext
  }

  return sidebarCalendarContextCache.get(userId)
}

/**
 * @param {string | null | undefined} userId
 */
export function clearSidebarCalendarContextCache(userId) {
  if (userId == null) {
    return
  }

  sidebarCalendarContextCache.clear(userId)
}

/**
 * @param {unknown} pathname
 */
export function shouldLoadSidebarCalendarContext(pathname) {
  const path = String(pathname ?? "")

  return path === "/" || path.startsWith("/")
}

async function isCalendarReady() {
  const calendarReadinessModule = await import("@/lib/calendar-readiness")
  return calendarReadinessModule.isCalendarDatabaseReady()
}

async function getPrismaClient() {
  const prismaModule = await import("@/lib/prisma")
  return prismaModule.prisma
}
