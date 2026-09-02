import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import {
  getSidebarCalendarContext,
  isCanonicalSidebarCalendarOwnerId,
} from "@/lib/sidebar-calendar-context"

export async function GET() {
  const session = await getCurrentSession()

  const ownerId = session?.user?.id
  if (!isCanonicalSidebarCalendarOwnerId(ownerId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const calendarContext = await getSidebarCalendarContext(ownerId)

  return NextResponse.json(calendarContext)
}
