import { renderPublicBookingPage } from "../../public-booking-page"

export default async function BrandedBookingPage({
  params,
}: {
  params: Promise<{ practiceSlug: string; bookingSlug: string }>
}) {
  const { practiceSlug, bookingSlug } = await params
  const stateSlug = practiceSlug
  return renderPublicBookingPage({ lookup: { kind: "branded", stateSlug, bookingSlug } })
}
