"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { BackgroundDefinition } from "@/components/backgrounds/backgroundRegistry"
import { BackgroundCreditConfirmationDialog } from "@/components/backgrounds/BackgroundCreditConfirmationDialog"
import { useBackgroundCommerce } from "@/components/backgrounds/BackgroundCommerceProvider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type BackgroundAcquisitionMode = "locked" | "keep-permanently"

/** Maps only known first-party visualizer routes, preventing user-controlled redirects. */
function safeReturnPath(pathname: string) {
  if (pathname.startsWith("/clock")) return "/clock?panel=background"
  if (pathname.startsWith("/music")) return "/music?visualizer=background"
  return "/chimer?panel=background"
}

/** Presents credit, purchase, and membership choices for a locked or temporary background. */
export function BackgroundAcquisitionDialog({
  background,
  mode,
  open,
  onOpenChange,
  onAcquired,
}: {
  background: BackgroundDefinition | null
  mode: BackgroundAcquisitionMode
  open: boolean
  onOpenChange: (open: boolean) => void
  onAcquired: (background: BackgroundDefinition) => void
}) {
  const pathname = usePathname() ?? "/chimer"
  const { state, addToCart, signedIn } = useBackgroundCommerce()
  const [confirmingCredit, setConfirmingCredit] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const snapshot = state.snapshot
  const creditBalance = snapshot?.creditBalance
  const owned = Boolean(background && snapshot?.ownerships.some((ownership) => (
    ownership.backgroundId === background.id && ownership.status === "active"
  )))
  const inCart = Boolean(background && snapshot?.cart.items.some((item) => (
    item.productKey === background.id
  )))

  useEffect(() => {
    if (!open || !owned || !background) return
    onOpenChange(false)
    onAcquired(background)
  }, [background, onAcquired, onOpenChange, open, owned])

  if (!background) return null
  const adding = state.pendingAction?.action === "add-to-cart"

  const buy = async () => {
    setErrorMessage("")
    try {
      if (!inCart) await addToCart(background.id)
      onOpenChange(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "This background could not be added. Try again.")
    }
  }

  const returnTo = safeReturnPath(pathname)
  const membershipDestination = `/account?tab=membership&returnTo=${encodeURIComponent(returnTo)}`
  const membershipHref = signedIn
    ? membershipDestination
    : `/login?callbackUrl=${encodeURIComponent(membershipDestination)}`

  return (
    <>
      <Dialog open={open && !confirmingCredit} onOpenChange={onOpenChange}>
        <DialogContent overlayClassName="z-[10040]" className="z-[10041]">
          <DialogHeader>
            <DialogTitle>{mode === "keep-permanently" ? "Keep" : "Unlock"} {background.label}</DialogTitle>
            <DialogDescription>
              {mode === "keep-permanently"
                ? "Your membership already includes this background. Choose permanent access if you want to keep it after membership ends."
                : "Choose how you want to access this premium background."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={!signedIn || typeof creditBalance !== "number" || creditBalance === 0}
              onClick={() => setConfirmingCredit(true)}
            >
              Use free credit
            </Button>
            {!signedIn ? (
              <p className="-mt-2 text-xs text-muted-foreground">
                Sign in at checkout to use account credits. You can still add this background to your cart now.
              </p>
            ) : typeof creditBalance !== "number" ? (
              <p className="-mt-2 text-xs text-muted-foreground" role="status">
                Checking available credits...
              </p>
            ) : creditBalance === 0 ? (
              <p className="-mt-2 text-xs text-muted-foreground">
                You have 0 credits. Purchase this background or unlock the premium collection.
              </p>
            ) : (
              <p className="-mt-2 text-xs text-muted-foreground">
                {creditBalance} {creditBalance === 1 ? "credit" : "credits"} available.
              </p>
            )}
            <Button type="button" disabled={adding || inCart} onClick={() => void buy()}>
              Buy for $1
            </Button>
            {mode === "locked" ? (
              <Button asChild variant="secondary">
                <Link href={membershipHref} onClick={() => onOpenChange(false)}>
                  Unlock all
                </Link>
              </Button>
            ) : null}
          </div>
          {inCart ? (
            <p role="status" className="text-sm text-muted-foreground">
              This background is already in your account cart.
            </p>
          ) : null}
          {errorMessage ? <p role="alert" className="text-sm text-destructive">{errorMessage}</p> : null}
        </DialogContent>
      </Dialog>
      <BackgroundCreditConfirmationDialog
        background={background}
        open={confirmingCredit}
        onOpenChange={setConfirmingCredit}
        onAcquired={onAcquired}
      />
    </>
  )
}
