"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BACKGROUND_CHECKOUT_RETURN_STORAGE_KEY } from "@/components/backgrounds/BackgroundCheckoutReview"
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

type StoredCheckoutReturn = {
  returnPath: string
  backgroundIds: string[]
}

const MAX_AUTOMATIC_CHECKS = 6

function readStoredReturn(): StoredCheckoutReturn | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(BACKGROUND_CHECKOUT_RETURN_STORAGE_KEY) ?? "null")
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    const returnPath = typeof value.returnPath === "string" ? value.returnPath : ""
    const backgroundIds: string[] = Array.isArray(value.backgroundIds)
      ? (value.backgroundIds as unknown[]).filter((id): id is string => typeof id === "string")
      : []
    const parsed = new URL(returnPath, window.location.origin)
    if (
      parsed.origin !== window.location.origin
      || (!parsed.pathname.startsWith("/clock") && !parsed.pathname.startsWith("/chimer"))
    ) {
      return null
    }
    return {
      returnPath: `${parsed.pathname}${parsed.search}`,
      backgroundIds: [...new Set(backgroundIds)],
    }
  } catch {
    return null
  }
}

function returnUrl(path: string, status: "success" | "cancelled") {
  const url = new URL(path, window.location.origin)
  url.searchParams.set("panel", "background")
  url.searchParams.set("backgroundPurchase", status)
  return `${url.pathname}${url.search}`
}

export function BackgroundCheckoutReturnStatus() {
  const pathname = usePathname() ?? ""
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state, refresh } = useBackgroundCommerce()
  const result = searchParams.get("backgroundPurchase")
  const orderId = searchParams.get("orderId")
  const [storedReturn, setStoredReturn] = useState<StoredCheckoutReturn | null>(null)
  const [checks, setChecks] = useState(0)
  const [checking, setChecking] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (result !== "success" && result !== "cancelled") return
    setStoredReturn(readStoredReturn())
  }, [result])

  const expectedIds = storedReturn?.backgroundIds ?? []
  const returnedOrder = orderId
    ? state.snapshot?.recentOrders.find((order) => order.id === orderId)
    : null
  const resolvedReturnPath = storedReturn?.returnPath ?? returnedOrder?.returnPath ?? null
  const fulfilled = (
    expectedIds.length > 0
      ? expectedIds.every((id) => state.snapshot?.ownedBackgroundIds.includes(id))
      : returnedOrder?.status === "PAID"
  )
  const manualReview = returnedOrder?.status === "REVIEW_REQUIRED"
  const stillProcessing = result === "success" && !fulfilled && !manualReview

  const checkAgain = useCallback(async () => {
    setChecking(true)
    try {
      await refresh()
      setChecks((value) => value + 1)
    } finally {
      setChecking(false)
    }
  }, [refresh])

  useEffect(() => {
    if (!stillProcessing || checks >= MAX_AUTOMATIC_CHECKS) return
    const timer = window.setTimeout(() => { void checkAgain() }, checks === 0 ? 250 : 2000)
    return () => window.clearTimeout(timer)
  }, [checkAgain, checks, stillProcessing])

  useEffect(() => {
    if (!resolvedReturnPath || pathname !== "/account") return
    if (result === "cancelled") {
      // Restored query contract: backgroundPurchase=cancelled.
      router.replace(returnUrl(resolvedReturnPath, "cancelled"))
      return
    }
    if (result === "success" && fulfilled) {
      sessionStorage.removeItem(BACKGROUND_CHECKOUT_RETURN_STORAGE_KEY)
      router.replace(returnUrl(resolvedReturnPath, "success"))
    }
  }, [fulfilled, pathname, resolvedReturnPath, result, router])

  const exceptionMessage = useMemo(() => {
    const statuses = new Set(state.snapshot?.ownerships.map((ownership) => ownership.status) ?? [])
    if (statuses.has("refund_pending")) return "A background has a refund pending; only that access is paused while it is reviewed."
    if (statuses.has("dispute_suspended")) return "A background is dispute suspended; your account and other access remain available."
    if (statuses.has("retired")) return "A retired background remains in your history and may include a replacement credit."
    return null
  }, [state.snapshot?.ownerships])

  if (result !== "success" && result !== "cancelled") return null
  if (result === "cancelled" && pathname !== "/account") return null

  return (
    <Dialog
      open={!dismissed}
      onOpenChange={(open) => {
        if (!open && (!stillProcessing || checks >= MAX_AUTOMATIC_CHECKS)) setDismissed(true)
      }}
    >
      <DialogContent
        overlayClassName="z-[10040]"
        className="z-[10041]"
        onEscapeKeyDown={(event) => {
          if (stillProcessing && checks < MAX_AUTOMATIC_CHECKS) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {result === "cancelled"
              ? "Returning to your cart..."
              : fulfilled
                ? "Purchase confirmed"
                : "Confirming purchase..."}
          </DialogTitle>
          <DialogDescription>
            {result === "cancelled"
              ? "No purchase was completed. Your account cart remains available."
              : fulfilled
                ? "Server-confirmed permanent access is ready."
                : manualReview
                  ? "Payment needs manual review before access can be fulfilled."
                  : "Your payment is still processing. Access appears only after server confirmation."}
          </DialogDescription>
        </DialogHeader>

        {exceptionMessage ? <p className="text-sm text-muted-foreground">{exceptionMessage}</p> : null}
        {stillProcessing && checks >= MAX_AUTOMATIC_CHECKS ? (
          <p className="text-sm text-muted-foreground">
            This is taking longer than expected. Your selected visual has not changed.
          </p>
        ) : null}

        <DialogFooter>
          {stillProcessing ? (
            <Button type="button" variant="outline" disabled={checking} onClick={() => void checkAgain()}>
              {checking ? "Checking..." : "Check again"}
            </Button>
          ) : null}
          {(manualReview || (stillProcessing && checks >= MAX_AUTOMATIC_CHECKS)) ? (
            <Button asChild>
              <Link href="/support?topic=purchase-background-access">Contact support</Link>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
