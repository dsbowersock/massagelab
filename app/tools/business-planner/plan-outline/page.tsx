import { createPublicPageMetadata } from "@/lib/seo"
import { PlanOutlineClient } from "./plan-outline-client"

export const metadata = createPublicPageMetadata("/tools/business-planner/plan-outline")

export default function PlanOutlinePage() {
  return <PlanOutlineClient />
}
