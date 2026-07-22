"use client"

import { useEffect, useRef, useState } from "react"
import type { BackgroundDefinition } from "@/components/backgrounds/backgroundRegistry"
import { useBackgroundCommerce } from "@/components/backgrounds/BackgroundCommerceProvider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function BackgroundCreditConfirmationDialog({
  background,
  open,
  onOpenChange,
  onAcquired,
}: {
  background: BackgroundDefinition | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAcquired: (background: BackgroundDefinition) => void
}) {
  const { state, redeemCredit } = useBackgroundCommerce()
  const [confirmed, setConfirmed] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const idempotencyKey = useRef("")

  useEffect(() => {
    if (!open || !background) return
    setConfirmed(false)
    setErrorMessage("")
    idempotencyKey.current = crypto.randomUUID()
  }, [background, open])

  if (!background) return null
  const pending = state.pendingAction?.action === "redeem-credit"

  const submit = async () => {
    if (!confirmed || !idempotencyKey.current) return
    setErrorMessage("")
    try {
      await redeemCredit(background.id, idempotencyKey.current)
      onOpenChange(false)
      onAcquired(background)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Credit redemption failed. Try again.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keep {background.label} permanently</DialogTitle>
          <DialogDescription>
            {background.label} becomes permanently owned, one free credit is spent,
            and this choice cannot be swapped for another background.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-3 rounded-md border border-border/70 p-3 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 size-4"
          />
          <span>I understand this permanent, non-swappable credit choice.</span>
        </label>
        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">{errorMessage}</p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Go back
          </Button>
          <Button
            type="button"
            disabled={!confirmed || pending}
            onClick={() => void submit()}
          >
            {pending ? "Using credit..." : "Use credit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
