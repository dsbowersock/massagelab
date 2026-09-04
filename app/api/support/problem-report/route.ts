import * as Sentry from "@sentry/nextjs"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { getSiteUrl } from "@/lib/auth-env"
import { authRequestNetworkIdentifier } from "@/lib/auth-request"
import { consumeOperationalRateLimit } from "@/lib/operational-rate-limit"
import { buildProblemReportSentryPayload } from "@/lib/problem-report"
import { isTrustedCheckoutFormOrigin } from "@/lib/trusted-form-origin"

export const dynamic = "force-dynamic"

const MAX_REPORT_BODY_BYTES = 2048

/** Accepts JSON parameters while rejecting every non-JSON structured suffix or lookalike. */
function isProblemReportJson(request: Request) {
  return (request.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase() === "application/json"
}

/** Reads and parses a report without buffering more than the approved byte cap. */
async function readReportBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0)

  if (Number.isFinite(contentLength) && contentLength > MAX_REPORT_BODY_BYTES) {
    return null
  }

  const reader = request.body?.getReader()

  if (!reader) {
    return null
  }

  const chunks: Uint8Array[] = []
  let receivedBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      receivedBytes += value.byteLength
      if (receivedBytes > MAX_REPORT_BODY_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }

    const bytes = new Uint8Array(receivedBytes)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }

    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
    return body && typeof body === "object" && !Array.isArray(body) ? body : null
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }
}

/** Returns the route's deliberately generic response for unavailable delivery. */
function unavailableDiagnosticResponse() {
  return NextResponse.json(
    { error: "Diagnostic report could not be delivered. Please try again later." },
    { status: 503 },
  )
}

/** Returns one bounded denial without reflecting request or limiter state. */
function rateLimitedDiagnosticResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many diagnostic reports. Please try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  )
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  let trustedOrigin = false
  try {
    trustedOrigin = Boolean(origin) && isTrustedCheckoutFormOrigin(request, getSiteUrl())
  } catch {
    trustedOrigin = false
  }
  if (!trustedOrigin) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
  }

  if (!isProblemReportJson(request)) {
    return NextResponse.json(
      { error: "Problem report requires application/json." },
      { status: 415 },
    )
  }

  const body = await readReportBody(request)

  if (!body) {
    return NextResponse.json({ error: "Problem report could not be accepted." }, { status: 400 })
  }

  let requestHeaders: Headers
  let payload: ReturnType<typeof buildProblemReportSentryPayload>
  try {
    requestHeaders = await headers()
    payload = buildProblemReportSentryPayload({
      ...body,
      userAgent: requestHeaders.get("user-agent") ?? "",
    })
  } catch {
    return unavailableDiagnosticResponse()
  }

  let sentryEnabled = false
  try {
    sentryEnabled = Sentry.isEnabled()
  } catch {
    sentryEnabled = false
  }
  if (!sentryEnabled) {
    return unavailableDiagnosticResponse()
  }

  let limiterDecision: Awaited<ReturnType<typeof consumeOperationalRateLimit>>
  try {
    const networkIdentifier = authRequestNetworkIdentifier({ headers: requestHeaders })
    limiterDecision = await consumeOperationalRateLimit({
      operation: "PROBLEM_REPORT",
      networkIdentifier,
    })
  } catch {
    return unavailableDiagnosticResponse()
  }

  if (!limiterDecision.allowed) {
    if (
      limiterDecision.reason === "RATE_LIMITED"
      && Number.isInteger(limiterDecision.retryAfterSeconds)
      && limiterDecision.retryAfterSeconds > 0
    ) {
      return rateLimitedDiagnosticResponse(limiterDecision.retryAfterSeconds)
    }
    return unavailableDiagnosticResponse()
  }

  let eventId: string
  try {
    eventId = Sentry.captureMessage(payload.message, {
      level: "warning",
      tags: payload.tags,
      contexts: payload.contexts,
    })
    // A serverless response can finish before the SDK transport drains, so the
    // voluntary report is not acknowledged until its queued event is flushed.
    if (!await Sentry.flush(2000)) return unavailableDiagnosticResponse()
  } catch {
    return unavailableDiagnosticResponse()
  }

  return NextResponse.json({
    eventId,
    category: payload.contexts.problemReport.category,
    area: payload.contexts.problemReport.area,
    safePath: payload.contexts.problemReport.safePath,
    privacyLevel: payload.contexts.problemReport.privacyLevel,
  })
}
