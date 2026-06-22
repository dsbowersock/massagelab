import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/anatomime")

export default function AnatomimeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
