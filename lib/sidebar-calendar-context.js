// @ts-check

export const emptySidebarCalendarContext = Object.freeze({
  practice: null,
  therapists: [],
  canManageAvailability: false,
})

/**
 * @param {unknown} pathname
 */
export function shouldLoadSidebarCalendarContext(pathname) {
  const path = String(pathname ?? "")

  return path === "/calendar" || path.startsWith("/calendar/") || path.startsWith("/book/")
}
