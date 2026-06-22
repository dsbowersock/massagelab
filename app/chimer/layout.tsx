import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/chimer")

export default function ChimerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <main>{children}</main>
}

