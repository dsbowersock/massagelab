"use client"

import { ShoppingCart } from "lucide-react"
import { usePathname } from "next/navigation"
import { useBackgroundCommerce } from "@/components/backgrounds/BackgroundCommerceProvider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function CommerceCartTrigger({
  signedIn,
  showLabel = false,
  className,
}: {
  signedIn: boolean
  showLabel?: boolean
  className?: string
}) {
  const pathname = usePathname() ?? ""
  const { state, openCart } = useBackgroundCommerce()
  const isCalendarRoute = pathname === "/calendar" || pathname.startsWith("/calendar/")
  const cart = state.snapshot?.cart
  const itemCount = cart?.items.length ?? 0
  const reserved = Boolean(cart?.reservedOrder)

  if (!signedIn || isCalendarRoute || !cart || (itemCount === 0 && !reserved)) {
    return null
  }

  const status = reserved
    ? `Account cart reserved for checkout with ${itemCount} ${itemCount === 1 ? "item" : "items"}`
    : `Open account cart with ${itemCount} ${itemCount === 1 ? "item" : "items"}`

  return (
    <Button
      type="button"
      variant="outline"
      size={showLabel ? "sm" : "icon"}
      className={cn("relative shrink-0", className)}
      onClick={openCart}
      aria-label={status}
      aria-haspopup="dialog"
      data-commerce-cart-trigger
    >
      <ShoppingCart aria-hidden="true" />
      {showLabel ? <span>Cart</span> : null}
      <span
        className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
        aria-hidden="true"
      >
        {reserved ? "!" : itemCount}
      </span>
      <span className="sr-only" role="status">
        {reserved ? "Checkout reserved" : `${itemCount} in cart`}
      </span>
    </Button>
  )
}
