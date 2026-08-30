"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { PendingSubmissionForm, PendingSubmitButton } from "@/components/forms/pending-submission-form"
import { Button } from "@/components/ui/button"
import { Loader } from "@/components/ui/loader"
import { formatAccountDate } from "@/lib/account-page"
import { BILLING_PORTAL_DESTINATIONS } from "@/lib/billing-portal-destinations"
import { fetchJsonWithTimeout } from "@/lib/client-fetch"
import type { MembershipConvergenceStatus } from "@/lib/membership-convergence"

export const MEMBERSHIP_RETURN_POLL_DELAYS_MS = [0, 1_000, 2_000, 4_000, 8_000] as const

type MembershipReturnKind = "checkout" | "portal"
type PollOutcome = "settled" | "exhausted" | "aborted"

type MembershipReturnPollResult = {
  outcome: PollOutcome
  attempts: number
  baselineRevision: string | null
  status: MembershipConvergenceStatus | null
}

type PollMembershipReturnStatusInput = {
  kind: MembershipReturnKind
  readStatus: () => Promise<MembershipConvergenceStatus>
  onStatus: (status: MembershipConvergenceStatus) => void
  signal?: AbortSignal
  wait?: (delay: number, signal?: AbortSignal) => Promise<void>
}

/** Rejects malformed private responses before they can enter render state. */
export function parseMembershipConvergenceStatus(value: unknown): MembershipConvergenceStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid membership status response.")
  }
  const status = value as Partial<MembershipConvergenceStatus>
  const validState = status.state === "active"
    || status.state === "billing-attention"
    || status.state === "no-active-membership"
  const nullableString = (candidate: unknown) => candidate === null || typeof candidate === "string"
  if (
    !validState
    || !nullableString(status.paidLevel)
    || !Array.isArray(status.featureKeys)
    || !status.featureKeys.every((feature) => typeof feature === "string")
    || !nullableString(status.subscriptionStatus)
    || typeof status.cancelAtPeriodEnd !== "boolean"
    || !nullableString(status.currentPeriodEnd)
    || !nullableString(status.revision)
    || typeof status.portalAvailable !== "boolean"
  ) {
    throw new Error("Invalid membership status response.")
  }
  return status as MembershipConvergenceStatus
}

/** Waits for one bounded polling delay and stops promptly when the owner unmounts. */
function waitForDelay(delay: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const timeout = window.setTimeout(resolve, delay)
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timeout)
      resolve()
    }, { once: true })
  })
}

/**
 * Watches database revisions for one exact five-read window. Checkout's first
 * non-active row is only a baseline: it cannot be misreported as the outcome
 * of the just-finished payment until a later persisted revision differs.
 */
export async function pollMembershipReturnStatus({
  kind,
  readStatus,
  onStatus,
  signal,
  wait = waitForDelay,
}: PollMembershipReturnStatusInput): Promise<MembershipReturnPollResult> {
  let baselineEstablished = false
  let baselineRevision: string | null = null
  let lastStatus: MembershipConvergenceStatus | null = null

  for (let index = 0; index < MEMBERSHIP_RETURN_POLL_DELAYS_MS.length; index += 1) {
    await wait(MEMBERSHIP_RETURN_POLL_DELAYS_MS[index], signal)
    if (signal?.aborted) {
      return { outcome: "aborted", attempts: index, baselineRevision, status: lastStatus }
    }

    try {
      const status = await readStatus()
      if (signal?.aborted) {
        return { outcome: "aborted", attempts: index, baselineRevision, status: lastStatus }
      }
      lastStatus = status

      if (kind === "portal") {
        onStatus(status)
        if (!baselineEstablished) {
          baselineEstablished = true
          baselineRevision = status.revision
        } else if (status.revision !== baselineRevision) {
          return { outcome: "settled", attempts: index + 1, baselineRevision, status }
        }
        continue
      }

      if (status.state === "active") {
        onStatus(status)
        return { outcome: "settled", attempts: index + 1, baselineRevision, status }
      }
      if (!baselineEstablished) {
        baselineEstablished = true
        baselineRevision = status.revision
        continue
      }
      if (status.revision !== baselineRevision) {
        onStatus(status)
        return { outcome: "settled", attempts: index + 1, baselineRevision, status }
      }
    } catch {
      if (signal?.aborted) {
        return { outcome: "aborted", attempts: index, baselineRevision, status: lastStatus }
      }
      // A transient read failure consumes only this bounded attempt. Reissuing
      // Checkout or extending the retry window would risk duplicate actions.
    }
  }

  return {
    outcome: "exhausted",
    attempts: MEMBERSHIP_RETURN_POLL_DELAYS_MS.length,
    baselineRevision,
    status: lastStatus,
  }
}

/** Reads only the authenticated, private database projection used by the bounded watcher. */
export async function readPersistedMembershipStatus(signal: AbortSignal, timeoutMs?: number) {
  // The shared helper keeps both fetch and JSON consumption under one deadline
  // while composing that deadline with this effect owner's unmount signal.
  const { response, json } = await fetchJsonWithTimeout<unknown>("/api/billing/membership-status", {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    method: "GET",
    signal,
  }, timeoutMs)
  if (!response.ok) throw new Error("Membership status is temporarily unavailable.")
  return parseMembershipConvergenceStatus(json)
}

/**
 * Builds implementation-detail-free return guidance from persisted status and return kind.
 *
 * @param status The latest safe database projection, or null before convergence.
 * @param exhausted Whether the bounded watcher spent every attempt without a safe result.
 * @param kind The Checkout or Portal return flow selecting the in-progress copy.
 * @returns User-facing copy that uses the shared local account date and never includes external-service identifiers or diagnostics.
 */
export function statusMessage(status: MembershipConvergenceStatus | null, exhausted: boolean, kind: MembershipReturnKind) {
  if (!status) {
    return exhausted
      ? "Your membership update is still processing. You can safely check the status again."
      : kind === "checkout"
        ? "Finalizing your membership…"
        : "Checking your latest membership status…"
  }
  if (status.state === "active") {
    return status.cancelAtPeriodEnd && status.currentPeriodEnd
      ? `Your membership access is active through ${formatAccountDate(new Date(status.currentPeriodEnd))}.`
      : "Your membership access is active."
  }
  if (status.state === "billing-attention") {
    return "Your membership needs billing attention. Review billing management for the next available action."
  }
  return "No active membership is currently recorded for this account."
}

export function MembershipReturnStatus({ kind }: { kind: MembershipReturnKind }) {
  const [status, setStatus] = useState<MembershipConvergenceStatus | null>(null)
  const [busy, setBusy] = useState(true)
  const [exhausted, setExhausted] = useState(false)
  const [retryEpoch, setRetryEpoch] = useState(0)
  const regionRef = useRef<HTMLElement | null>(null)

  const retry = useCallback(() => {
    setRetryEpoch((value) => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setBusy(true)
    setExhausted(false)
    setStatus(null)
    regionRef.current?.focus()

    void pollMembershipReturnStatus({
      kind,
      signal: controller.signal,
      readStatus: () => readPersistedMembershipStatus(controller.signal),
      onStatus: setStatus,
    }).then((result) => {
      if (result.outcome === "aborted" || controller.signal.aborted) return
      if (kind === "checkout" && result.outcome === "exhausted") {
        setStatus(null)
      }
      setExhausted(result.outcome === "exhausted")
      setBusy(false)
    }).catch(() => {
      if (controller.signal.aborted) return
      setStatus(null)
      setExhausted(true)
      setBusy(false)
    })

    return () => controller.abort()
  }, [kind, retryEpoch])

  const message = statusMessage(status, exhausted, kind)
  const canOpenPremiumBackgrounds = status?.state === "active"
    && status.featureKeys.includes("premium_backgrounds")
  const canManageBilling = status?.state === "billing-attention" && status.portalAvailable

  return (
    <section
      ref={regionRef}
      tabIndex={-1}
      aria-busy={busy}
      data-membership-return-state={status?.state ?? "processing"}
      data-membership-return-status={kind}
      className="mx-auto mb-5 w-full max-w-3xl overflow-hidden rounded-xl border border-brand-orange/40 bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
        {busy ? (
          <Loader aria-hidden="true" label="Checking membership status" size="sm" className="shrink-0" />
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="text-base font-semibold">
            {kind === "checkout" ? "Membership checkout return" : "Billing portal return"}
          </h2>
          <p className="break-words text-sm text-muted-foreground">{message}</p>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{message}</p>

      <div className="mt-4 flex flex-wrap gap-3">
        {canOpenPremiumBackgrounds ? (
          <Button asChild>
            <Link href="/chimer?panel=background">Open premium backgrounds</Link>
          </Button>
        ) : null}
        {canManageBilling ? (
          <PendingSubmissionForm
            action="/api/billing/portal"
            method="post"
            pendingLabel="Opening billing portal…"
          >
            <input type="hidden" name="destination" value={BILLING_PORTAL_DESTINATIONS.MANAGE} />
            <PendingSubmitButton
              type="submit"
              variant="outline"
              pendingLabel="Opening billing portal…"
            >
              Manage billing account
            </PendingSubmitButton>
          </PendingSubmissionForm>
        ) : null}
        {!busy && exhausted ? (
          <Button type="button" variant="outline" onClick={retry}>Check status again</Button>
        ) : null}
      </div>
    </section>
  )
}
