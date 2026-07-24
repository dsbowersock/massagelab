import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { getSiteUrl } from "@/lib/auth-env"
import { findDonationOption } from "@/lib/donations"
import { safeErrorCode } from "@/lib/safe-error-code"
import { createStripeDonationCheckoutSession } from "@/lib/stripe-billing"
import {
  isBrowserFormRequest,
  isTrustedCheckoutFormOrigin,
} from "@/lib/trusted-form-origin"

export const runtime = "nodejs"

/**
 * Parses one-time support payloads from either HTML form submissions or JSON clients.
 * The returned `isForm` flag controls whether failures redirect or return JSON.
 */
async function donationRequest(request: Request, isForm = isBrowserFormRequest(request)) {
  if (isForm) {
    let formData
    try {
      formData = await request.formData()
    } catch {
      // Preserve form-response semantics while the empty amount flows through
      // the existing invalid-amount redirect without reaching Stripe.
      return { isForm: true, amountCents: null }
    }
    return {
      isForm: true,
      amountCents: formData.get("amountCents"),
    }
  }

  const parsedBody = await request.json().catch(() => null)
  const body = (
    parsedBody
    && typeof parsedBody === "object"
    && !Array.isArray(parsedBody)
  )
    ? parsedBody
    : {}
  return {
    isForm: false,
    amountCents: body.amountCents,
  }
}

/**
 * Sends form submissions back to pricing with a compatibility status code for UI notices.
 */
function pricingRedirect(code: string) {
  return NextResponse.redirect(`${getSiteUrl()}/pricing?donation=${encodeURIComponent(code)}`, 303)
}

export async function POST(request: Request) {
  const isForm = isBrowserFormRequest(request)
  if (!isTrustedCheckoutFormOrigin(request)) {
    return isForm
      ? pricingRedirect("invalid-request")
      : NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
  }

  const input = await donationRequest(request, isForm)
  const oneTimeSupport = findDonationOption(input.amountCents)

  if (!oneTimeSupport) {
    return input.isForm
      ? pricingRedirect("invalid-amount")
      : NextResponse.json({ error: "Unsupported one-time support amount" }, { status: 400 })
  }

  try {
    const session = await getCurrentSession()
    const checkoutSession = await createStripeDonationCheckoutSession({
      amountCents: oneTimeSupport.amountCents,
      customerEmail: session?.user?.email ?? "",
      userId: session?.user?.id ?? "",
      successUrl: `${getSiteUrl()}/pricing?donation=thanks&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${getSiteUrl()}/pricing?donation=cancelled`,
    })

    if (!checkoutSession.url) {
      throw new Error("Stripe did not return a one-time support Checkout URL.")
    }

    return input.isForm
      ? NextResponse.redirect(checkoutSession.url, 303)
      : NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error("Unable to start one-time support checkout", {
      code: safeErrorCode(error),
    })
    return input.isForm
      ? pricingRedirect("checkout-error")
      : NextResponse.json({ error: "Unable to start one-time support checkout." }, { status: 500 })
  }
}
