import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export function GET() {
  if (process.env.MASSAGELAB_ENABLE_SENTRY_TEST_ROUTE !== "true") {
    return NextResponse.json({ error: "Sentry test route is disabled." }, { status: 404 })
  }

  throw new Error("MassageLab Sentry server test error")
}
