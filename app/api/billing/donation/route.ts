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
  isTrustedCheckoutFormOrigin,
} from "@/lib/trusted-form-origin"

export const runtime = "nodejs"

const MAX_DONATION_REQUEST_BYTES = 4096

type DonationMediaKind = "json" | "urlencoded" | "multipart"

type DonationRequestResult =
  | {
      ok: true
      isForm: boolean
      amountCents: unknown
      checkoutAttemptId: unknown
    }
  | { ok: false; isForm: boolean }

/**
 * Parses one bounded one-time support payload without asking the original
 * request to buffer an unbounded body. Native form duplicates remain visible
 * to the existing ambiguity checks.
 */
async function donationRequest(
  request: Request,
  mediaKind: DonationMediaKind,
): Promise<DonationRequestResult> {
  const isForm = mediaKind !== "json"
  const boundedBody = await readBoundedDonationBody(request)
  if (!boundedBody) return { ok: false, isForm }

  if (mediaKind === "urlencoded") {
    const serialized = decodeDonationUtf8(boundedBody)
    if (serialized === null) return { ok: false, isForm: true }
    const formData = new URLSearchParams(serialized)
    return {
      ok: true,
      isForm: true,
      amountCents: formData.getAll("amountCents"),
      checkoutAttemptId: formData.getAll("checkoutAttemptId"),
    }
  }

  if (mediaKind === "multipart") {
    let formData: FormData
    try {
      const boundedRequest = new Request(request.url, {
        method: "POST",
        headers: { "content-type": request.headers.get("content-type") ?? "" },
        body: boundedBody,
      })
      formData = await boundedRequest.formData()
    } catch {
      return { ok: false, isForm: true }
    }
    return {
      ok: true,
      isForm: true,
      amountCents: formData.getAll("amountCents"),
      checkoutAttemptId: formData.getAll("checkoutAttemptId"),
    }
  }

  const serialized = decodeDonationUtf8(boundedBody)
  if (serialized === null) return { ok: false, isForm: false }

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(serialized)
  } catch {
    return { ok: false, isForm: false }
  }
  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return { ok: false, isForm: false }
  }

  const body = parsedBody as Record<string, unknown>
  return {
    ok: true,
    isForm: false,
    amountCents: body.amountCents,
    checkoutAttemptId: body.checkoutAttemptId,
  }
}

/** Classifies only the three request media bases this endpoint understands. */
function donationMediaKind(request: Request): DonationMediaKind | null {
  const mediaType = (request.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase()
  if (mediaType === "application/json") return "json"
  if (mediaType === "application/x-www-form-urlencoded") return "urlencoded"
  if (mediaType === "multipart/form-data") return "multipart"
  return null
}

/**
 * Reads at most the inclusive route cap and cancels an open body exactly once
 * when either declared or observed bytes exceed that cap.
 */
async function readBoundedDonationBody(request: Request): Promise<Uint8Array | null> {
  const declaredLength = request.headers.get("content-length")
  if (declaredLength !== null) {
    const normalizedLength = declaredLength.trim()
    if (!/^\d+$/.test(normalizedLength)) return null
    const byteLength = Number(normalizedLength)
    if (!Number.isSafeInteger(byteLength)) return null
    if (byteLength > MAX_DONATION_REQUEST_BYTES) {
      await request.body?.cancel().catch(() => undefined)
      return null
    }
  }

  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array()

  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (totalBytes + value.byteLength > MAX_DONATION_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined)
        return null
      }
      totalBytes += value.byteLength
      chunks.push(value)
    }
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

/** Decodes JSON and urlencoded bodies without replacement characters. */
function decodeDonationUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return null
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

function unsupportedMediaResponse() {
  return NextResponse.json({ error: "Unsupported request media type" }, { status: 415 })
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
  const mediaKind = donationMediaKind(request)
  const isForm = mediaKind === "urlencoded" || mediaKind === "multipart"
  if (!isTrustedCheckoutFormOrigin(request, getSiteUrl())) {
    return isForm
      ? pricingRedirect("invalid-request")
      : NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
  }
  if (!mediaKind) return unsupportedMediaResponse()

  let input = {
    isForm,
    amountCents: null as unknown,
    checkoutAttemptId: null as unknown,
  }

  try {
    const parsedInput = await donationRequest(request, mediaKind)
    if (!parsedInput.ok) return invalidInputResponse(parsedInput.isForm, "amount")
    input = parsedInput
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
