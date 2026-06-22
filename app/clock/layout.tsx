import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/clock")

export default function ClockLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
