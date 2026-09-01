import "server-only"

import { headers } from "next/headers"
import { getCurrentSession as loadCurrentSession } from "../auth"

export * from "../auth"

export const RSC_SESSION_PROOF_HEADER = "x-massagelab-rsc-session-proof"
const MAX_OUTSTANDING_PROOFS = 32
const MAX_SESSION_ENTRIES_PER_PROOF = 64
const PROOF_ID_PATTERN = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i
const proofCounters = new Map<string, number>()

function isProofEnabled() {
  return process.env.NEXT_PUBLIC_RSC_SESSION_PROOF === "1"
}

/** Records only a bounded nonsecret request nonce and numeric loader-entry count. */
function recordRscSessionProofEntry(proofId: string | null) {
  if (!isProofEnabled() || !proofId || !PROOF_ID_PATTERN.test(proofId)) return

  if (!proofCounters.has(proofId) && proofCounters.size >= MAX_OUTSTANDING_PROOFS) {
    // Eviction is FIFO/oldest-created, deliberately not LRU, so hot proof IDs cannot pin themselves.
    const oldestProofId = proofCounters.keys().next().value
    if (typeof oldestProofId === "string") proofCounters.delete(oldestProofId)
  }
  proofCounters.set(
    proofId,
    Math.min((proofCounters.get(proofId) ?? 0) + 1, MAX_SESSION_ENTRIES_PER_PROOF),
  )
}

/**
 * Counts entry into the real auth loader without retaining or inspecting its
 * result. This local export intentionally shadows the auth star export so
 * Browser QA instrumentation observes every call through this boundary.
 */
export async function getCurrentSession() {
  const requestHeaders = await headers()
  recordRscSessionProofEntry(requestHeaders.get(RSC_SESSION_PROOF_HEADER))
  return loadCurrentSession()
}

/** Returns one numeric receipt and immediately retires its bounded counter. */
export function consumeRscSessionProofCount(proofId: string) {
  if (!isProofEnabled() || !PROOF_ID_PATTERN.test(proofId)) return null
  const count = proofCounters.get(proofId) ?? 0
  proofCounters.delete(proofId)
  return count
}
