"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { retryFailedEmailIntentAction, type RetryEmailActionState } from "./email-actions"

const INITIAL_RETRY_STATE: RetryEmailActionState = { status: "idle", message: "" }

/**
 * Submits one server-generated operation key and announces the safe action
 * outcome without replacing the durable service's authorization guards.
 */
export function RetryEmailForm({
  userId,
  intentId,
  operationId,
}: {
  userId: string
  intentId: string
  operationId: string
}) {
  const [actionState, formAction, isPending] = useActionState(
    retryFailedEmailIntentAction.bind(null, userId),
    INITIAL_RETRY_STATE,
  )

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="intentId" value={intentId} />
      <input type="hidden" name="operationId" value={operationId} />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Retrying email…" : "Retry email notification"}
      </Button>
      {actionState.status !== "idle" ? (
        <p
          role={actionState.status === "error" ? "alert" : "status"}
          aria-live={actionState.status === "error" ? "assertive" : "polite"}
          className="text-sm text-muted-foreground"
        >
          {actionState.message}
        </p>
      ) : null}
    </form>
  )
}
