import { PRIVATE_ROUTE_METADATA } from "@/lib/seo"

/**
 * Booking URLs are public share links for specific practices, but they are not
 * part of MassageLab's crawlable public marketing surface.
 */
export const metadata = PRIVATE_ROUTE_METADATA

export default function BookLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
