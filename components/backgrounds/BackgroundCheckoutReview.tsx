"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
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
import { formatCommerceAmount } from "@/lib/background-commerce-client.js"
import {
  legalDocumentAcceptanceId,
  requiredLegalDocumentsForEvent,
} from "@/lib/legal-documents.js"

export const BACKGROUND_CHECKOUT_RETURN_STORAGE_KEY = "massagelab-background-checkout-return-v1"

function currentBackgroundReturnPath(
  pathname: string,
  source: string | null,
  returnTo: string | null,
) {
  if (pathname.startsWith("/clock")) return "/clock?panel=background"
  if (source === "music" || pathname.startsWith("/music")) {
    const safeReturn = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/music"
    return `/chimer?source=music&panel=background&returnTo=${encodeURIComponent(safeReturn)}`
  }
  return "/chimer?panel=background"
}

export function BackgroundCheckoutReview({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const pathname = usePathname() ?? "/chimer"
  const searchParams = useSearchParams()
  const { state, startCheckout } = useBackgroundCommerce()
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const documents = useMemo(
    () => requiredLegalDocumentsForEvent("digital-purchase"),
    [],
  )
  const cart = state.snapshot?.cart
  const returnPath = currentBackgroundReturnPath(
    pathname,
    searchParams.get("source"),
    searchParams.get("returnTo"),
  )

  useEffect(() => {
    if (!open) return
    setConsentAccepted(false)
    setSubmitting(false)
    setErrorMessage("")
  }, [open])

  const submit = async () => {
    if (submitting) return
    if (!consentAccepted || !cart || cart.items.length === 0) return
    setSubmitting(true)
    setErrorMessage("")
    try {
      sessionStorage.setItem(BACKGROUND_CHECKOUT_RETURN_STORAGE_KEY, JSON.stringify({
        returnPath,
        backgroundIds: cart.items.map((item) => item.productKey),
      }))
      await startCheckout({
        acceptedLegalDocuments: documents.map(legalDocumentAcceptanceId),
        combinedConsentAccepted: consentAccepted,
        purchaseCountry: "US",
        returnPath,
      })
    } catch (error) {
      setSubmitting(false)
      setErrorMessage(error instanceof Error ? error.message : "Checkout could not be opened. Your account cart is unchanged.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!submitting) onOpenChange(nextOpen)
    }}>
      <DialogContent
        overlayClassName="z-[10040]"
        className="z-[10041] max-h-[min(88dvh,48rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Review checkout</DialogTitle>
          <DialogDescription>
            Permanent digital backgrounds. Purchases are U.S. only in this release.
          </DialogDescription>
        </DialogHeader>

        <ul className="grid gap-2" aria-label="Backgrounds in checkout">
          {cart?.items.map((item) => (
            <li key={item.productKey} className="flex justify-between gap-3 rounded-md border p-3 text-sm">
              <span>{item.displayName}</span>
              <span>{formatCommerceAmount(item.unitAmount, item.currency)}</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-1 text-sm">
          <div className="flex justify-between gap-3 font-semibold">
            <span>Subtotal</span>
            <span>{formatCommerceAmount(cart?.subtotalAmount ?? 0, cart?.currency)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Prices are tax-exclusive. Applicable tax is added at Checkout.
          </p>
        </div>

        <div className="grid gap-2 rounded-md border border-border/70 p-3 text-sm">
          <p className="font-medium">Current purchase documents</p>
          <ul className="list-disc space-y-1 pl-5">
            {documents.map((document) => (
              <li key={document.key}>
                <Link className="underline underline-offset-4" href={document.route} target="_blank">
                  {document.key === "digital-purchases-refunds"
                    ? "Digital Purchases & Refund Policy"
                    : document.shortLabel}
                </Link>
                {" "}<span className="text-muted-foreground">({document.version})</span>
              </li>
            ))}
          </ul>
        </div>

        <label className="flex items-start gap-3 rounded-md border border-primary/40 p-3 text-sm">
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(event) => setConsentAccepted(event.target.checked)}
            className="mt-0.5 size-4"
          />
          <span>
            I accept the current Digital Purchases & Refund Policy and final-sale
            terms, expressly request immediate digital delivery, and acknowledge
            that fulfillment begins immediately.
          </span>
        </label>

        <p className="text-xs leading-5 text-muted-foreground">
          Lawful exceptions remain available for duplicate charges, unauthorized
          purchases, non-delivery, and unresolved material defects through the
          policy and support process.
        </p>
        {errorMessage ? <p role="alert" className="text-sm text-destructive">{errorMessage}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Back to cart
          </Button>
          <Button
            type="button"
            disabled={!consentAccepted || submitting || !cart?.items.length}
            onClick={() => void submit()}
          >
            {submitting ? "Opening secure Checkout..." : "Continue to Checkout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
