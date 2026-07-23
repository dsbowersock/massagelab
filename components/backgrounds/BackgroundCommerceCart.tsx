"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShoppingCart, Trash2 } from "lucide-react"
import { usePathname } from "next/navigation"
import { BackgroundCheckoutReview } from "@/components/backgrounds/BackgroundCheckoutReview"
import { useBackgroundCommerce } from "@/components/backgrounds/BackgroundCommerceProvider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCommerceAmount } from "@/lib/background-commerce-client.js"
import { cn } from "@/lib/utils"

const NOTICE_COPY: Record<string, string> = {
  OWNED_ITEM_REMOVED: "An item you now own was removed automatically.",
  FREE_ITEM_REMOVED: "A background that became free was removed automatically.",
  RETIRED_ITEM_REMOVED: "A retired background was removed automatically.",
  UNAVAILABLE_ITEM_REMOVED: "An unavailable background was removed automatically.",
}

function CartContents({
  compact,
  onReviewCheckout,
  signedIn,
}: {
  compact: boolean
  onReviewCheckout?: () => void
  signedIn: boolean
}) {
  const { state, removeFromCart, cancelReservation } = useBackgroundCommerce()
  const [localError, setLocalError] = useState("")
  const cart = state.snapshot?.cart
  if (!cart) {
    return <p role="status" className="text-sm text-muted-foreground">Loading cart...</p>
  }

  const reservedOrder = cart.reservedOrder
  if (compact && cart.items.length === 0 && !reservedOrder && cart.notices.length === 0) {
    return null
  }
  const mutationPending = state.status === "mutating" || state.status === "redirecting"
  const remove = async (backgroundId: string) => {
    setLocalError("")
    try {
      await removeFromCart(backgroundId)
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "The item could not be removed.")
    }
  }
  const cancel = async () => {
    if (!reservedOrder) return
    setLocalError("")
    try {
      await cancelReservation(reservedOrder.orderId)
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "The reservation could not be canceled.")
    }
  }

  return (
    <section
      aria-label={signedIn ? "Account cart" : "MassageLab cart"}
      className={cn("grid gap-3", compact && "rounded-xl border border-border/70 bg-background/80 p-3")}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="size-4" aria-hidden="true" />
          <span className="font-semibold">
            {cart.items.length} {cart.items.length === 1 ? "background" : "backgrounds"}
          </span>
        </div>
        <span className="font-semibold">{formatCommerceAmount(cart.subtotalAmount, cart.currency)}</span>
      </div>

      {cart.items.length > 0 ? (
        <ul className="grid gap-2">
          {cart.items.map((item) => (
            <li
              key={`${item.productType}:${item.productKey}`}
              className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCommerceAmount(item.unitAmount, item.currency)}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={Boolean(reservedOrder) || mutationPending}
                onClick={() => void remove(item.productKey)}
                aria-label={`Remove ${item.displayName} from ${signedIn ? "account" : "MassageLab"} cart`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Your {signedIn ? "account" : "MassageLab"} cart is empty.</p>
      )}

      {cart.notices.length > 0 ? (
        <div className="grid gap-1" role="status" aria-live="polite">
          {cart.notices.map((notice) => (
            <p key={`${notice.code}:${notice.productKey}`} className="text-xs text-muted-foreground">
              {NOTICE_COPY[notice.code] ?? "Your cart was updated from the current catalog."}
            </p>
          ))}
        </div>
      ) : null}

      {reservedOrder ? (
        <div className="grid gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p>
            Checkout is reserved until{" "}
            <time dateTime={reservedOrder.expiresAt}>
              {new Date(reservedOrder.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </time>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onReviewCheckout}>
              Return to checkout
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={mutationPending}
              onClick={() => void cancel()}
            >
              Cancel reservation
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-1 text-xs text-muted-foreground">
        <p>No tax is currently charged for this U.S.-only release.</p>
        <p>Permanent access after membership ends.</p>
        {!signedIn ? <p>This cart is saved in this browser until you sign in.</p> : null}
      </div>

      {!reservedOrder && cart.items.length > 0 && signedIn ? (
        <Button type="button" onClick={onReviewCheckout}>
          Review checkout
        </Button>
      ) : null}
      {!reservedOrder && cart.items.length > 0 && !signedIn ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild>
            <Link href="/login?callbackUrl=%2Faccount%3Ftab%3Dorders-invoices">Sign in to checkout</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/register?callbackUrl=%2Faccount%3Ftab%3Dorders-invoices">Create account</Link>
          </Button>
        </div>
      ) : null}
      {localError ? <p role="alert" className="text-sm text-destructive">{localError}</p> : null}
    </section>
  )
}

export function BackgroundCommerceCart({
  variant,
  onReviewCheckout,
}: {
  variant: "compact" | "dialog"
  onReviewCheckout?: () => void
}) {
  const { cartOpen, closeCart, signedIn } = useBackgroundCommerce()
  const [reviewOpen, setReviewOpen] = useState(false)
  const pathname = usePathname() ?? ""
  const isCalendarRoute = pathname === "/calendar" || pathname.startsWith("/calendar/")
  const beginReview = () => {
    onReviewCheckout?.()
    if (variant === "dialog") closeCart()
    setReviewOpen(true)
  }

  useEffect(() => {
    if (variant === "dialog" && isCalendarRoute && cartOpen) closeCart()
  }, [cartOpen, closeCart, isCalendarRoute, variant])

  if (isCalendarRoute) return null

  if (variant === "compact") {
    return (
      <>
        <CartContents compact onReviewCheckout={beginReview} signedIn={signedIn} />
        <BackgroundCheckoutReview open={reviewOpen} onOpenChange={setReviewOpen} />
      </>
    )
  }

  return (
    <>
      <Dialog open={cartOpen} onOpenChange={(open) => { if (!open) closeCart() }}>
        <DialogContent
          overlayClassName="z-[10040]"
          className="z-[10041] max-h-[min(80dvh,44rem)] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>{signedIn ? "Account cart" : "MassageLab cart"}</DialogTitle>
            <DialogDescription>
              Permanent MassageLab background purchases. Provider services and Calendar sales are separate.
            </DialogDescription>
          </DialogHeader>
          <CartContents compact={false} onReviewCheckout={beginReview} signedIn={signedIn} />
        </DialogContent>
      </Dialog>
      <BackgroundCheckoutReview open={reviewOpen} onOpenChange={setReviewOpen} />
    </>
  )
}
