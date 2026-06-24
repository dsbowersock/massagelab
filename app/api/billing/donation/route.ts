import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { getSiteUrl } from "@/lib/auth-env"
import { findDonationOption } from "@/lib/donations"
import { createStripeDonationCheckoutSession } from "@/lib/stripe-billing"

export const runtime = "nodejs"

/**
 * Parses donation payloads from either HTML form submissions or JSON clients.
 * The returned `isForm` flag controls whether failures redirect or return JSON.
 */
async function donationRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? ""

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    return {
      isForm: true,
      amountCents: formData.get("amountCents"),
    }
  }

  const body = await request.json().catch(() => ({}))
  return {
    isForm: false,
    amountCents: body.amountCents,
  }
}

/**
 * Sends form submissions back to pricing with a donation status code for UI notices.
 */
function pricingRedirect(code: string) {
  return NextResponse.redirect(`${getSiteUrl()}/pricing?donation=${encodeURIComponent(code)}`, 303)
}

export async function POST(request: Request) {
  const input = await donationRequest(request)
  const donation = findDonationOption(input.amountCents)

  if (!donation) {
    return input.isForm
      ? pricingRedirect("invalid-amount")
      : NextResponse.json({ error: "Unsupported donation amount" }, { status: 400 })
  }

  try {
    const session = await getCurrentSession()
    const checkoutSession = await createStripeDonationCheckoutSession({
      amountCents: donation.amountCents,
      customerEmail: session?.user?.email ?? "",
      userId: session?.user?.id ?? "",
      successUrl: `${getSiteUrl()}/pricing?donation=thanks&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${getSiteUrl()}/pricing?donation=cancelled`,
    })

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a donation Checkout URL.")
    }

    return input.isForm
      ? NextResponse.redirect(checkoutSession.url, 303)
      : NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start donation checkout."
    return input.isForm
      ? pricingRedirect("checkout-error")
      : NextResponse.json({ error: message }, { status: 500 })
  }
}
