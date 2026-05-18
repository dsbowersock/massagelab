import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { getSidebarCalendarContext } from "@/lib/sidebar-calendar-context"

export async function GET() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const calendarContext = await getSidebarCalendarContext(session.user.id)

  return NextResponse.json(calendarContext)
}
