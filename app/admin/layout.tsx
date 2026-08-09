import { PRIVATE_ROUTE_METADATA } from "@/lib/seo"

export const metadata = PRIVATE_ROUTE_METADATA

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The shared layout owns metadata only. Each destination must reload and
  // enforce its own database-backed capability rather than inheriting UI state.
  return children
}
