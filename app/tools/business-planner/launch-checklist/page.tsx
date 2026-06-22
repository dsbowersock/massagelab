import { createPublicPageMetadata } from "@/lib/seo"
import { LaunchChecklistClient } from "./launch-checklist-client"

export const metadata = createPublicPageMetadata("/tools/business-planner/launch-checklist")

export default function LaunchChecklistPage() {
  return <LaunchChecklistClient />
}
