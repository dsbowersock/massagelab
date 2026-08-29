"use client"

import { useRef, useState } from "react"
import { Mail } from "lucide-react"
import { AsyncActionButton } from "@/components/forms/async-action-button"
import { AppInset } from "@/components/ui/app-surface"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PUBLIC_ACCOUNT_ENTRY_MESSAGE } from "@/lib/auth-registration-service"

const REQUEST_FAILED_MESSAGE = "We could not request another verification email right now. Please try again."

/** Collects an email in a request body without putting account data in the URL. */
export function ResendVerificationForm({ callbackUrl }: { callbackUrl: string }) {
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState("")
  const [statusIsError, setStatusIsError] = useState(false)
  const submissionLock = useRef(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submissionLock.current) return
    submissionLock.current = true
    setPending(true)
    setStatus("")
    setStatusIsError(false)

    try {
      const response = await fetch("/api/account/email-verification/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, callbackUrl }),
      })
      const result = await response.json().catch(() => ({})) as { message?: string }
      setStatus(result.message ?? (response.ok ? PUBLIC_ACCOUNT_ENTRY_MESSAGE : REQUEST_FAILED_MESSAGE))
      setStatusIsError(!response.ok)
    } catch {
      setStatus(REQUEST_FAILED_MESSAGE)
      setStatusIsError(true)
    } finally {
      submissionLock.current = false
      setPending(false)
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="verification-email">Email</Label>
        <Input
          id="verification-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <AsyncActionButton
        type="submit"
        pending={pending}
        disabled={pending}
        idleLabel="Send another verification email"
        pendingLabel="Sending verification email…"
        icon={<Mail className="h-4 w-4" />}
      />
      {status ? (
        <AppInset className={`p-3 text-sm ${statusIsError ? "text-amber-100" : "text-muted-foreground"}`}>
          <p role={statusIsError ? "alert" : "status"} aria-live={statusIsError ? "assertive" : "polite"}>
            {status}
          </p>
        </AppInset>
      ) : null}
    </form>
  )
}
