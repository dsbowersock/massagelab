import { getCurrentSession } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  BUSINESS_INCOME_APP_SETTINGS_KEY,
  sanitizeBusinessIncomePlannerPreference,
} from "@/lib/business-income-planner"
import { objectRecord } from "@/lib/onboarding-preferences"
import { createPublicPageMetadata } from "@/lib/seo"
import { IncomePlannerClient } from "./income-planner-client"

export const metadata = createPublicPageMetadata("/tools/business-planner/income")

export default async function BusinessIncomePlannerPage() {
  const session = await getCurrentSession()
  const userId = session?.user?.id
  let initialAccountPlanner = null

  if (userId) {
    const preference = await prisma.userPreference.findUnique({
      where: { userId },
      select: { appSettings: true },
    })
    const appSettings = objectRecord(preference?.appSettings)
    if (BUSINESS_INCOME_APP_SETTINGS_KEY in appSettings) {
      initialAccountPlanner = sanitizeBusinessIncomePlannerPreference(appSettings[BUSINESS_INCOME_APP_SETTINGS_KEY])
    }
  }

  return (
    <IncomePlannerClient
      isSignedIn={Boolean(userId)}
      displayName={session?.user?.name ?? session?.user?.email ?? null}
      initialAccountPlanner={initialAccountPlanner}
    />
  )
}
