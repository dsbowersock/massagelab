import "server-only"

import { redirect } from "next/navigation"
import { getCurrentSession } from "@/auth"
import { canManageAnatomyContent } from "@/lib/account-permissions"
import type { AccountRole } from "@/lib/domain-types"
import { prisma } from "@/lib/prisma"

/**
 * Enforces Anatomy Admin access for server-rendered admin routes and server actions.
 * The shared account-permission helpers stay pure so they remain safe for navigation/client imports.
 */
export async function requireAnatomyAdminUser() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const roles = await prisma.userRole.findMany({
    where: { userId: session.user.id },
    select: { role: true },
  })
  const roleValues = (roles as Array<{ role: AccountRole }>).map((roleRow) => roleRow.role)

  if (!canManageAnatomyContent(roleValues)) {
    redirect("/account")
  }

  return session.user
}
