import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { authRequestNetworkIdentifier } from "@/lib/auth-request"
import { getSiteUrl } from "@/lib/auth-env"
import { donationCheckoutIdempotencyKey } from "@/lib/donation-checkout-attempt"
import { findDonationOption } from "@/lib/donations"
import { consumeOperationalRateLimit } from "@/lib/operational-rate-limit"
import { safeErrorCode } from "@/lib/safe-error-code"
import {
  DonationCheckoutAttemptConflictError,
  createStripeDonationCheckoutSession,
} from "@/lib/stripe-billing"
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
      return { isForm: true, amountCents: null, checkoutAttemptId: null }
    }
    return {
      isForm: true,
      amountCents: formData.getAll("amountCents"),
      checkoutAttemptId: formData.getAll("checkoutAttemptId"),
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
    checkoutAttemptId: body.checkoutAttemptId,
  }
}

/**
 * Sends form submissions back to pricing with a compatibility status code for UI notices.
 */
function pricingRedirect(code: string) {
  return NextResponse.redirect(`${getSiteUrl()}/pricing?donation=${encodeURIComponent(code)}`, 303)
}

function invalidInputResponse(isForm: boolean, kind: "amount" | "attempt") {
  if (isForm) return pricingRedirect(kind === "amount" ? "invalid-amount" : "invalid-request")
  return NextResponse.json(
    { error: kind === "amount" ? "Unsupported one-time support amount" : "Invalid checkout attempt" },
    { status: 400 },
  )
}

function rateLimitedResponse(isForm: boolean, retryAfterSeconds: number) {
  if (isForm) return pricingRedirect("rate-limited")
  return NextResponse.json(
    { error: "Too many one-time support checkout attempts. Please try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  )
}

function unavailableResponse(isForm: boolean) {
  return isForm
    ? pricingRedirect("unavailable")
    : NextResponse.json(
        { error: "One-time support checkout is temporarily unavailable." },
        { status: 503 },
      )
}

function conflictResponse(isForm: boolean) {
  return isForm
    ? pricingRedirect("conflict")
    : NextResponse.json(
        { error: "This one-time support checkout attempt conflicts with an earlier request." },
        { status: 409 },
      )
}

/** Accepts one exact JSON integer or one repeated, equal native-form amount. */
function canonicalSubmittedAmount(value: unknown, isForm: boolean): number | null {
  if (!isForm) return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : null
  if (!Array.isArray(value)) return null

  const amounts = new Set<number>()
  for (const candidate of value) {
    if (candidate === "") continue
    if (typeof candidate !== "string" || !/^[1-9][0-9]*$/.test(candidate)) return null
    const amount = Number(candidate)
    if (!Number.isSafeInteger(amount)) return null
    amounts.add(amount)
  }
  return amounts.size === 1 ? [...amounts][0] : null
}

/** Native forms must supply one unambiguous attempt field; JSON supplies a scalar. */
function submittedAttemptId(value: unknown, isForm: boolean): unknown {
  if (!isForm) return value
  return Array.isArray(value) && value.length === 1 ? value[0] : null
}

export async function POST(request: Request) {
  const isForm = isBrowserFormRequest(request)
  if (!isTrustedCheckoutFormOrigin(request, getSiteUrl())) {
    return isForm
      ? pricingRedirect("invalid-request")
      : NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
  }

  let input = {
    isForm,
    amountCents: null as unknown,
    checkoutAttemptId: null as unknown,
  }

  try {
    input = await donationRequest(request, isForm)
    const submittedAmount = canonicalSubmittedAmount(input.amountCents, input.isForm)
    const oneTimeSupport = submittedAmount === null ? null : findDonationOption(submittedAmount)

    if (!oneTimeSupport) {
      return invalidInputResponse(input.isForm, "amount")
    }

    let idempotencyKey: string
    try {
      idempotencyKey = donationCheckoutIdempotencyKey(
        submittedAttemptId(input.checkoutAttemptId, input.isForm),
      )
    } catch {
      return invalidInputResponse(input.isForm, "attempt")
    }

    const session = await getCurrentSession()
    const networkIdentifier = authRequestNetworkIdentifier(request)
    let limiterDecision: Awaited<ReturnType<typeof consumeOperationalRateLimit>>
    try {
      limiterDecision = await consumeOperationalRateLimit({
        operation: "DONATION_CHECKOUT",
        networkIdentifier,
        ...(session?.user?.id
          ? { account: { kind: "ACCOUNT_ID" as const, value: session.user.id } }
          : {}),
      })
    } catch {
      return unavailableResponse(input.isForm)
    }

    if (!limiterDecision.allowed) {
      if (
        limiterDecision.reason === "RATE_LIMITED"
        && Number.isInteger(limiterDecision.retryAfterSeconds)
        && limiterDecision.retryAfterSeconds > 0
      ) {
        return rateLimitedResponse(input.isForm, limiterDecision.retryAfterSeconds)
      }
      return unavailableResponse(input.isForm)
    }

    const checkoutSession = await createStripeDonationCheckoutSession({
      amountCents: oneTimeSupport.amountCents,
      customerEmail: session?.user?.email ?? "",
      idempotencyKey,
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
    if (error instanceof DonationCheckoutAttemptConflictError) {
      return conflictResponse(input.isForm)
    }
    console.error("Unable to start one-time support checkout", {
      code: safeErrorCode(error),
    })
    return input.isForm
      ? pricingRedirect("checkout-error")
      : NextResponse.json({ error: "Unable to start one-time support checkout." }, { status: 500 })
  }
}
