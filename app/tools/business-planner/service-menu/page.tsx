import { createPublicPageMetadata } from "@/lib/seo"
import { ServiceMenuClient } from "./service-menu-client"

export const metadata = createPublicPageMetadata("/tools/business-planner/service-menu")

export default function ServiceMenuPage() {
  return <ServiceMenuClient />
}
