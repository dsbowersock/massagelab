"use client"

import Link from "next/link"
import Image from "next/image"
import { CreditCard, History, ImageIcon, ShoppingCart, WalletCards } from "lucide-react"
import { useBackgroundCommerce } from "@/components/backgrounds/BackgroundCommerceProvider"
import { getBackgroundDefinition } from "@/components/backgrounds/backgroundRegistry"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCommerceAmount } from "@/lib/background-commerce-client.js"

type Ownership = {
  backgroundId: string
  source: "credit" | "purchase"
  status: string
  acquiredAt: string
}

type AccountOrder = {
  reference: string
  status: string
  subtotalAmount: number
  taxAmount: number
  totalAmount: number
  currency: string
  createdAt: string
  items: Array<{
    backgroundId: string
    displayName: string
    unitAmount: number
    taxAmount: number
    totalAmount: number
    refundedAmount: number
    refundStatuses: string[]
  }>
}

export type BackgroundCommerceAccountData = {
  creditBalance: number
  ownedBackgroundIds: string[]
  ownerships: Ownership[]
  cart: {
    items: Array<{ productKey: string }>
    reservedOrder: { orderId: string; expiresAt: string } | null
    subtotalAmount: number
    currency: string
  }
  orders: AccountOrder[]
}

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(date)
    : "Date unavailable"
}

function sourceLabel(source: Ownership["source"]) {
  return source === "credit" ? "Credit redemption" : "Purchase"
}

function ownershipStatus(status: string) {
  if (status === "refund_pending") return "Refund pending"
  if (status === "dispute_suspended") return "Dispute suspended"
  if (status === "refund_revoked") return "Refund revoked"
  if (status === "dispute_revoked") return "Dispute revoked"
  if (status === "retired") return "Retired"
  return "Active"
}

function orderStatus(status: string) {
  if (status === "PARTIALLY_REFUNDED") return "Partial refund"
  if (status === "REVIEW_REQUIRED") return "Manual review"
  return status.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
}

function OwnershipCard({ ownership }: { ownership: Ownership }) {
  const background = getBackgroundDefinition(ownership.backgroundId)
  const active = ownership.status === "active"
  return (
    <article className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="relative aspect-video bg-muted">
        {background.previewImageUrl ? (
          <Image
            src={background.previewImageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 360px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="size-full" style={background.fallbackStyle} aria-hidden="true" />
        )}
      </div>
      <div className="grid gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">{background.label}</h3>
          <span className="rounded-full border px-2 py-0.5 text-xs">{ownershipStatus(ownership.status)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {sourceLabel(ownership.source)} on {dateLabel(ownership.acquiredAt)}
        </p>
        {!active ? (
          <p className="text-xs text-muted-foreground">
            Historical access remains visible but is not currently selectable.
          </p>
        ) : null}
        {ownership.status === "retired" ? (
          <p className="text-xs text-muted-foreground">Replacement credit status appears in your wallet balance.</p>
        ) : null}
        <Button asChild size="sm" variant="outline" className="mt-2 w-fit">
          <Link href="/clock?panel=background">Open in Background picker</Link>
        </Button>
      </div>
    </article>
  )
}

export function BackgroundCommercePanel({
  data,
  subscriberIncludesPremium,
}: {
  data: BackgroundCommerceAccountData
  subscriberIncludesPremium: boolean
}) {
  const { state, openCart } = useBackgroundCommerce()
  const live = state.snapshot
  const creditBalance = live?.creditBalance ?? data.creditBalance
  const ownerships = live?.ownerships ?? data.ownerships
  const cart = live?.cart ?? data.cart
  const activeOwnerships = ownerships.filter((ownership) => ownership.status === "active")
  const inactiveOwnerships = ownerships.filter((ownership) => ownership.status !== "active")
  const hasCart = cart.items.length > 0 || Boolean(cart.reservedOrder)

  return (
    <div id="background-commerce" className="space-y-5">
      {state.status === "loading" && !live ? (
        <p role="status" className="text-sm text-muted-foreground">Loading current background commerce status...</p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error.message}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WalletCards className="size-5" aria-hidden="true" />
            Background credits
          </CardTitle>
          <CardDescription>
            Verified accounts receive two initial credits. Redemption creates permanent,
            non-swappable ownership of one background.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-3xl font-semibold">{creditBalance}</p>
          <Button asChild variant="outline">
            <Link href="/clock?panel=background">Choose a background</Link>
          </Button>
        </CardContent>
      </Card>

      {subscriberIncludesPremium ? (
        <Card>
          <CardHeader>
            <CardTitle>Included with membership</CardTitle>
            <CardDescription>
              Premium backgrounds remain selectable while membership is active. Permanent
              ownership is separate and remains after membership ends.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {hasCart ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="size-5" aria-hidden="true" />
              Account cart
            </CardTitle>
            <CardDescription>
              {cart.items.length} {cart.items.length === 1 ? "background" : "backgrounds"} ·{" "}
              {formatCommerceAmount(cart.subtotalAmount, cart.currency)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={openCart}>Open account cart</Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="size-5" aria-hidden="true" />
            Permanent backgrounds
          </CardTitle>
          <CardDescription>Active permanent access grouped separately from inactive history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {activeOwnerships.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {activeOwnerships.map((ownership) => (
                <OwnershipCard key={ownership.backgroundId} ownership={ownership} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No permanent backgrounds yet.</p>
          )}
          {inactiveOwnerships.length > 0 ? (
            <section className="space-y-3" aria-labelledby="inactive-background-history">
              <h3 id="inactive-background-history" className="font-semibold">Inactive history</h3>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {inactiveOwnerships.map((ownership) => (
                  <OwnershipCard key={ownership.backgroundId} ownership={ownership} />
                ))}
              </div>
            </section>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-5" aria-hidden="true" />
            Background purchase history
          </CardTitle>
          <CardDescription>Account references and public order status without payment processor identifiers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.orders.length > 0 ? data.orders.map((order) => (
            <article key={order.reference} className="grid gap-3 rounded-lg border border-border/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">Order {order.reference}</h3>
                  <p className="text-xs text-muted-foreground">{dateLabel(order.createdAt)}</p>
                </div>
                <span className="rounded-full border px-2 py-1 text-xs">{orderStatus(order.status)}</span>
              </div>
              <ul className="grid gap-2 text-sm">
                {order.items.map((item) => (
                  <li key={item.backgroundId} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {item.displayName}
                      {item.refundedAmount > 0 ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Refunded {formatCommerceAmount(item.refundedAmount, order.currency)}
                        </span>
                      ) : null}
                    </span>
                    <span>{formatCommerceAmount(item.totalAmount, order.currency)}</span>
                  </li>
                ))}
              </ul>
              <div className="grid gap-1 border-t pt-2 text-sm">
                <p className="flex justify-between"><span>Subtotal</span><span>{formatCommerceAmount(order.subtotalAmount, order.currency)}</span></p>
                <p className="flex justify-between"><span>Tax</span><span>{formatCommerceAmount(order.taxAmount, order.currency)}</span></p>
                <p className="flex justify-between font-semibold"><span>Total</span><span>{formatCommerceAmount(order.totalAmount, order.currency)}</span></p>
              </div>
              <Button asChild size="sm" variant="outline" className="w-fit">
                <Link
                  href={`/support?topic=purchase-background-access&orderReference=${encodeURIComponent(order.reference)}`}
                >
                  Purchase or background access
                </Link>
              </Button>
            </article>
          )) : (
            <p className="text-sm text-muted-foreground">No background orders yet.</p>
          )}
          <p className="sr-only">Dispute and Retired states remain visible in inactive history.</p>
        </CardContent>
      </Card>
    </div>
  )
}
