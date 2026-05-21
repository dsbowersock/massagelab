"use client"

import { useMemo, useState } from "react"
import { Copy, ExternalLink, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type PublicBookingLinkCardProps = {
  legalPath: string
  activePath: string
}

function absoluteUrl(path: string) {
  if (typeof window === "undefined") return path
  return `${window.location.origin}${path}`
}

function linkActionErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error"
}

export function PublicBookingLinkCard({ legalPath, activePath }: PublicBookingLinkCardProps) {
  const [message, setMessage] = useState("")
  const activeUrl = useMemo(() => absoluteUrl(activePath), [activePath])
  const legalUrl = useMemo(() => absoluteUrl(legalPath), [legalPath])
  const usingBrandedUrl = activePath !== legalPath

  async function copyActiveLink() {
    try {
      await navigator.clipboard.writeText(activeUrl)
      setMessage("Link copied.")
    } catch (error) {
      console.error("Failed to copy public booking link", error)
      setMessage(`Unable to copy link. ${linkActionErrorMessage(error)}`)
    }
  }

  async function shareActiveLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Book an appointment", url: activeUrl })
        setMessage("Share sheet opened.")
      } catch (error) {
        console.error("Failed to share public booking link", error)
        setMessage(`Unable to share link. ${linkActionErrorMessage(error)}`)
      }
      return
    }

    try {
      await copyActiveLink()
    } catch (error) {
      console.error("Failed to use copy fallback for public booking link share", error)
      setMessage(`Unable to share link. ${linkActionErrorMessage(error)}`)
    }
  }

  return (
    <Card className="border-border/80 bg-card/95 shadow-lg shadow-black/15 backdrop-blur">
      <CardHeader>
        <CardTitle>Public booking page</CardTitle>
        <CardDescription>Share this link with clients. The legal-name URL remains available even when a branded URL is active.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="rounded-md border border-border/70 bg-background/60 p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">Active share link</p>
            <p className="mt-1 break-all text-sm">{activeUrl}</p>
          </div>
          {usingBrandedUrl ? (
            <div className="rounded-md border border-border/70 bg-background/60 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Legal-name link</p>
              <p className="mt-1 break-all text-sm">{legalUrl}</p>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={copyActiveLink}>
            <Copy className="size-4" />
            Copy
          </Button>
          <Button type="button" variant="outline" onClick={shareActiveLink}>
            <Share2 className="size-4" />
            Share
          </Button>
          <Button asChild type="button" variant="outline">
            <a href={activePath} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Open
            </a>
          </Button>
        </div>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  )
}
