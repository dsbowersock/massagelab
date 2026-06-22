import { PRIVATE_ROUTE_METADATA } from "@/lib/seo"

export const metadata = PRIVATE_ROUTE_METADATA

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
