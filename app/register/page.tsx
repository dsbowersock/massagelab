"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AppInset, AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function safeCallbackUrl(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/account"
  return value
}

export default function RegisterPage() {
  const [callbackUrl, setCallbackUrl] = useState("/account")
  const loginHref = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState("")
  const [devLink, setDevLink] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setCallbackUrl(safeCallbackUrl(new URLSearchParams(window.location.search).get("callbackUrl")))
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setStatus("")
    setDevLink("")

    const response = await fetch("/api/account/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    })
    const result = await response.json()

    setIsSubmitting(false)
    setStatus(result.message ?? "Check your email to verify your account.")
    setDevLink(result.devLink ?? "")
  }

  return (
    <AppPageShell title="Create Account" width="narrow">
        <AppSurface
          title="Email account"
          description={
            <>
              Verify your email before signing in. If you already used Google, sign in and set an email password from Security.
            </>
          }
          contentClassName="gap-5"
        >
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} required />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-brand-orange-glow" disabled={isSubmitting}>
                Create account
              </Button>
            </form>
            {status && <AppInset className="p-3 text-sm text-muted-foreground">{status}</AppInset>}
            {devLink && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                Development verification link: <Link className="underline" href={devLink}>{devLink}</Link>
              </p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-brand-orange">
              <Link href={loginHref} className="underline-offset-4 hover:underline">
                Back to login
              </Link>
              <Link href="/forgot-password" className="underline-offset-4 hover:underline">
                Set or reset password
              </Link>
            </div>
        </AppSurface>
    </AppPageShell>
  )
}
