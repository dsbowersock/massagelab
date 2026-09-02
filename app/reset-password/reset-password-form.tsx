"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AsyncActionButton } from "@/components/forms/async-action-button"
import { AppInset, AppSurface } from "@/components/ui/app-surface"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState("")
  const [statusIsError, setStatusIsError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const token = searchParams.get("token") ?? ""

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setStatus("")
    setStatusIsError(false)

    try {
      const response = await fetch("/api/account/password-reset/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const result = await response.json().catch(() => ({})) as { message?: string }
      setStatus(result.message ?? (response.ok ? "Password updated." : "Password reset failed."))
      setStatusIsError(!response.ok)
    } catch {
      setStatus("Something went wrong. Please try again.")
      setStatusIsError(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppSurface title="Set a new password" description="Use at least 12 characters." contentClassName="gap-5">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} required />
          </div>
          <AsyncActionButton
            type="submit"
            className="w-full"
            disabled={!token}
            pending={isSubmitting}
            idleLabel="Update password"
            pendingLabel="Updating password…"
          />
        </form>
        {!token && <p className="text-sm text-muted-foreground">This reset link is missing a token.</p>}
        <AppInset className={`p-3 text-sm ${statusIsError ? "text-amber-100" : "text-muted-foreground"}${status ? "" : " sr-only"}`}>
          <p role="status" aria-live="polite" aria-atomic="true" className={statusIsError ? "sr-only" : undefined}>
            {statusIsError ? "" : status}
          </p>
          <p role="alert" aria-live="assertive" aria-atomic="true" className={statusIsError ? undefined : "sr-only"}>
            {statusIsError ? status : ""}
          </p>
        </AppInset>
        <Link href="/login" className="text-sm text-brand-orange underline-offset-4 hover:underline">
          Back to login
        </Link>
    </AppSurface>
  )
}
