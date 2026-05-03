"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("")
  const [devLink, setDevLink] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setStatus("")
    setDevLink("")

    const response = await fetch("/api/account/password-reset/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    })
    const result = await response.json()

    setIsSubmitting(false)
    setStatus(result.message ?? "If that email is registered, a reset link has been sent.")
    setDevLink(result.devLink ?? "")
  }

  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-xl space-y-6">
        <PageHeading>Reset Password</PageHeading>
        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle>Request reset link</CardTitle>
            <CardDescription>Password reset links expire after 60 minutes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
              </div>
              <Button type="submit" className="w-full bg-[#ff7043] hover:bg-[#f4511e]" disabled={isSubmitting}>
                Send reset link
              </Button>
            </form>
            {status && <p className="rounded-md border border-neutral-800 bg-background/70 p-3 text-sm text-muted-foreground">{status}</p>}
            {devLink && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                Development reset link: <Link className="underline" href={devLink}>{devLink}</Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
