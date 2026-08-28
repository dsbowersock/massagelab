import * as Sentry from "@sentry/nextjs"
import { createHash } from "node:crypto"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { buildProblemReportSentryPayload } from "@/lib/problem-report"

export const dynamic = "force-dynamic"

const MAX_REPORT_BODY_BYTES = 2048
const REPORT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const REPORT_RATE_LIMIT_MAX_PER_CLIENT = 5
const REPORT_RATE_LIMIT_MAX_GLOBAL = 100

type RateLimitBucket = {
  count: number
  resetAt: number
}

const reportRateLimitBuckets = new Map<string, RateLimitBucket>()

function rateLimitBucketAllows(key: string, now: number, maxCount: number) {
  const current = reportRateLimitBuckets.get(key)

  if (!current || current.resetAt <= now) {
    reportRateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + REPORT_RATE_LIMIT_WINDOW_MS,
    })
    return true
  }

  if (current.count >= maxCount) {
    return false
  }

  current.count += 1
  return true
}

function clientRateLimitKey(requestHeaders: Headers) {
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
  const realIp = requestHeaders.get("x-real-ip")?.trim()
  const source = forwardedFor || realIp || "unknown-client"

  // Keep rate limiting local to this process without retaining raw IP values.
  return `client:${createHash("sha256").update(source).digest("hex").slice(0, 32)}`
}

function allowProblemReportCapture(requestHeaders: Headers) {
  const now = Date.now()
  // This privacy-preserving map is a best-effort instance-local limit. Sentry
  // provider quotas remain the deployment-wide backstop across serverless instances.
  return (
    rateLimitBucketAllows(clientRateLimitKey(requestHeaders), now, REPORT_RATE_LIMIT_MAX_PER_CLIENT)
    && rateLimitBucketAllows("global", now, REPORT_RATE_LIMIT_MAX_GLOBAL)
  )
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

    const body = JSON.parse(new TextDecoder().decode(bytes))
    return body && typeof body === "object" && !Array.isArray(body) ? body : {}
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

export async function POST(request: Request) {
  const body = await readReportBody(request)

  if (!body) {
    return NextResponse.json({ error: "Problem report could not be accepted." }, { status: 400 })
  }

  if (!Sentry.isEnabled()) {
    return unavailableDiagnosticResponse()
  }

  const requestHeaders = await headers()

  if (!allowProblemReportCapture(requestHeaders)) {
    return NextResponse.json({ error: "Too many diagnostic reports. Please try again later." }, { status: 429 })
  }

  const payload = buildProblemReportSentryPayload({
    ...body,
    userAgent: requestHeaders.get("user-agent") ?? "",
  })

  const eventId = Sentry.captureMessage(payload.message, {
    level: "warning",
    tags: payload.tags,
    contexts: payload.contexts,
  })
  // A serverless response can finish before the SDK transport drains, so the
  // voluntary report is not acknowledged until its queued event is flushed.
  const delivered = await Sentry.flush(2000)

  if (!delivered) {
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
