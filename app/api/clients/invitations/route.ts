import { NextResponse } from "next/server"
import { getCurrentSession } from "@/auth"
import { getClinicalSyncReadiness } from "@/lib/phi-sync"

function gatedInvitationResponse() {
  return NextResponse.json(
    {
      error: "Client invitations are not enabled in production yet.",
      reason:
        "A therapist-client relationship can reveal sensitive care context, so MassageLab will not store invitations until the hosted clinical sync compliance gate is complete.",
      localFirst: true,
    },
    { status: 403 },
  )
}

export async function GET() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!getClinicalSyncReadiness().enabled) {
    return gatedInvitationResponse()
  }

  return NextResponse.json({ error: "Client invitation storage is not implemented yet." }, { status: 501 })
}

export async function POST() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!getClinicalSyncReadiness().enabled) {
    return gatedInvitationResponse()
  }

  return NextResponse.json({ error: "Client invitation storage is not implemented yet." }, { status: 501 })
}
