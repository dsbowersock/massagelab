import "server-only"

import { revalidatePath } from "next/cache"

export function revalidateCalendarRoutes(practiceSlug?: string, publicBookingPath?: string) {
  revalidatePath("/calendar")
  revalidatePath("/calendar/requests")
  revalidatePath("/calendar/availability")
  revalidatePath("/calendar/booking")
  revalidatePath("/book/[practiceSlug]", "page")
  revalidatePath("/book/[stateSlug]/[bookingSlug]", "page")
  if (practiceSlug) {
    revalidatePath(`/book/${practiceSlug}`)
  }
  if (publicBookingPath) {
    revalidatePath(publicBookingPath)
  }
}
