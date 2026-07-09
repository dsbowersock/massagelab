"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AppInset, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const token = searchParams.get("token") ?? ""

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setStatus("")

    const response = await fetch("/api/account/password-reset/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    })
    const result = await response.json()

    setIsSubmitting(false)
    setStatus(result.message ?? (response.ok ? "Password updated." : "Password reset failed."))
  }

  return (
    <AppSurface title="Set a new password" description="Use at least 12 characters." contentClassName="gap-5">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} required />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting || !token}>
            Update password
          </Button>
        </form>
        {!token && <p className="text-sm text-muted-foreground">This reset link is missing a token.</p>}
        {status && <AppInset className="p-3 text-sm text-muted-foreground">{status}</AppInset>}
        <Link href="/login" className="text-sm text-brand-orange underline-offset-4 hover:underline">
          Back to login
        </Link>
    </AppSurface>
  )
}
