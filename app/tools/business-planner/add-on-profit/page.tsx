import { createPublicPageMetadata } from "@/lib/seo"
import { AddOnProfitClient } from "./add-on-profit-client"

export const metadata = createPublicPageMetadata("/tools/business-planner/add-on-profit")

export default function AddOnProfitPage() {
  return <AddOnProfitClient />
}
