import { PRIVATE_ROUTE_METADATA } from "@/lib/seo"

/**
 * Account pages contain user-specific state, so they stay out of public search
 * indexes even when the main public marketing pages are crawlable.
 */
export const metadata = PRIVATE_ROUTE_METADATA

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
