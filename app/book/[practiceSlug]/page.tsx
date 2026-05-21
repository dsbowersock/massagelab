import { renderPublicBookingPage } from "../public-booking-page"

export default async function BookingPage({
  params,
}: {
  params: Promise<{ practiceSlug: string }>
}) {
  const { practiceSlug } = await params
  return renderPublicBookingPage({ lookup: { kind: "legal", practiceSlug } })
}
