import { PRIVATE_ROUTE_METADATA } from "@/lib/seo"

export const metadata = PRIVATE_ROUTE_METADATA

export default function AnatomyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
