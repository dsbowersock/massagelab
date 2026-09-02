"use client"

import { useState } from "react"
import Link from "next/link"
import { AsyncActionButton } from "@/components/forms/async-action-button"
import { AppInset, AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("")
  const [statusIsError, setStatusIsError] = useState(false)
  const [devLink, setDevLink] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setStatus("")
    setStatusIsError(false)
    setDevLink("")

    try {
      const response = await fetch("/api/account/password-reset/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const result = await response.json().catch(() => ({})) as { message?: string; devLink?: string }
      setStatus(result.message ?? "If that email is registered, a reset link has been sent.")
      setStatusIsError(!response.ok)
      setDevLink(result.devLink ?? "")
    } catch {
      setStatus("Something went wrong. Please try again.")
      setStatusIsError(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppPageShell title="Reset Password" width="narrow">
        <AppSurface title="Request reset link" description="Password reset links expire after 60 minutes." contentClassName="gap-5">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
              </div>
              <AsyncActionButton
                type="submit"
                className="w-full bg-primary hover:bg-brand-orange-glow"
                pending={isSubmitting}
                idleLabel="Send reset link"
                pendingLabel="Sending reset instructions…"
              />
            </form>
            {status && (
              <AppInset className={`p-3 text-sm ${statusIsError ? "text-amber-100" : "text-muted-foreground"}`}>
                <p role={statusIsError ? "alert" : "status"}>{status}</p>
              </AppInset>
            )}
            {devLink && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                Development reset link: <Link className="underline" href={devLink}>{devLink}</Link>
              </p>
            )}
        </AppSurface>
    </AppPageShell>
  )
}
