import { createPublicPageMetadata } from "@/lib/seo"
import { BreakEvenPlannerClient } from "./break-even-planner-client"

export const metadata = createPublicPageMetadata("/tools/business-planner/break-even")

export default function BusinessBreakEvenPage() {
  return <BreakEvenPlannerClient />
}
