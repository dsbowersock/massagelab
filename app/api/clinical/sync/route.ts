import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { getClinicalSyncReadiness } from "@/lib/phi-sync"

function disabledResponse() {
  const readiness = getClinicalSyncReadiness()

  return NextResponse.json(
    {
      enabled: false,
      reason: readiness.reason,
      localFirst: true,
      exportFormats: ["json", "editable-doc", "print-to-pdf"],
    },
    { status: 403 },
  )
}

export async function GET() {
  const readiness = getClinicalSyncReadiness()

  if (!readiness.enabled) {
    return disabledResponse()
  }

  return NextResponse.json(
    {
      enabled: false,
      reason: "The compliance gate is open, but hosted clinical sync storage is not implemented yet.",
    },
    { status: 501 },
  )
}

export async function POST() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const readiness = getClinicalSyncReadiness()

  if (!readiness.enabled) {
    return disabledResponse()
  }

  return NextResponse.json(
    {
      enabled: false,
      reason: "Hosted clinical sync cannot accept clinical records until the storage implementation is complete.",
    },
    { status: 501 },
  )
}
