import { notFound } from "next/navigation"

import ChimerPage from "@/app/chimer/page"

export const metadata = {
  title: "Clock Background Review",
  robots: {
    index: false,
    follow: false,
  },
}

/**
 * Exposes the real Clock UI locally with paid background access, without an
 * account session or account-preference API. Production always returns 404.
 */
export default function ClockReviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return <ChimerPage developmentSubscriberReview />
}
