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
  return (
    rateLimitBucketAllows("global", now, REPORT_RATE_LIMIT_MAX_GLOBAL)
    && rateLimitBucketAllows(clientRateLimitKey(requestHeaders), now, REPORT_RATE_LIMIT_MAX_PER_CLIENT)
  )
}

async function readReportBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0)

  if (Number.isFinite(contentLength) && contentLength > MAX_REPORT_BODY_BYTES) {
    return null
  }

  try {
    const body = await request.json()
    return body && typeof body === "object" && !Array.isArray(body) ? body : {}
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const body = await readReportBody(request)

  if (!body) {
    return NextResponse.json({ error: "Problem report could not be accepted." }, { status: 400 })
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

  return NextResponse.json({
    eventId,
    category: payload.contexts.problemReport.category,
    area: payload.contexts.problemReport.area,
    safePath: payload.contexts.problemReport.safePath,
    privacyLevel: payload.contexts.problemReport.privacyLevel,
  })
}
