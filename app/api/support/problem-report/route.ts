import * as Sentry from "@sentry/nextjs"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { buildProblemReportSentryPayload } from "@/lib/problem-report"

export const dynamic = "force-dynamic"

const MAX_REPORT_BODY_BYTES = 2048

async function readReportBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0)

  if (Number.isFinite(contentLength) && contentLength > MAX_REPORT_BODY_BYTES) {
    return null
  }

  try {
    const body = await request.json()
    return body && typeof body === "object" && !Array.isArray(body) ? body : {}
  } catch {
    return {}
  }
}

export async function POST(request: Request) {
  const body = await readReportBody(request)

  if (!body) {
    return NextResponse.json({ error: "Problem report is too large." }, { status: 413 })
  }

  const requestHeaders = await headers()
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
