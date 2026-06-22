"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect, useState } from "react"

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  const [eventId, setEventId] = useState("")

  useEffect(() => {
    setEventId(Sentry.captureException(error))
  }, [error])

  const supportHref = eventId ? `/support?eventId=${encodeURIComponent(eventId)}` : "/support"

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 p-6">
          <div className="rounded-md border border-border bg-card p-6 shadow-xl">
            <p className="text-sm font-medium text-primary">MassageLab</p>
            <h1 className="mt-3 text-2xl font-semibold">Something went wrong.</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              The error was captured for review. You can send a privacy-safe diagnostic report from support without uploading clinical notes, intake details, screenshots, or local vault content.
            </p>
            {eventId ? (
              <p className="mt-3 break-all rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                Sentry reference: {eventId}
              </p>
            ) : null}
            <a
              href={supportHref}
              className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-orange-glow focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            >
              Contact support
            </a>
          </div>
        </main>
      </body>
    </html>
  )
}
