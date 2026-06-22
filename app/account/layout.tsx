import { PRIVATE_ROUTE_METADATA } from "@/lib/seo"

export const metadata = PRIVATE_ROUTE_METADATA

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
