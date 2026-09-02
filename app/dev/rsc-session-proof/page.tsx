import { getCurrentRscSession as getCurrentSession } from "@/lib/rsc-session"
import {
  consumeRscSessionProofCount,
  RSC_SESSION_PROOF_HEADER,
} from "@/lib/rsc-session-proof"
import { headers } from "next/headers"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Emits one content-free Browser-QA receipt and is unreachable in ordinary builds. */
export default async function RscSessionProofPage() {
  if (process.env.NEXT_PUBLIC_RSC_SESSION_PROOF !== "1") notFound()

  const proofId = (await headers()).get(RSC_SESSION_PROOF_HEADER)
  if (!proofId) notFound()
  await getCurrentSession()
  const count = consumeRscSessionProofCount(proofId)
  if (count === null) notFound()

  return (
    <main>
      <h1>RSC session snapshot proof</h1>
      <output data-rsc-session-count={count}>{count}</output>
    </main>
  )
}
