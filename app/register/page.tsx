"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"

export default function RegisterPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState("")
  const [devLink, setDevLink] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-xl space-y-6">
        <PageHeading>Create Account</PageHeading>
        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle>Email account</CardTitle>
            <CardDescription>
              Verify your email before signing in. If you already used Google, sign in and set an email password from Security.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
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
              <Button type="submit" className="w-full bg-[#ff7043] hover:bg-[#f4511e]" disabled={isSubmitting}>
                Create account
              </Button>
            </form>
            {status && <p className="rounded-md border border-neutral-800 bg-background/70 p-3 text-sm text-muted-foreground">{status}</p>}
            {devLink && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                Development verification link: <Link className="underline" href={devLink}>{devLink}</Link>
              </p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-[#ffb199]">
              <Link href="/login" className="underline-offset-4 hover:underline">
                Back to login
              </Link>
              <Link href="/forgot-password" className="underline-offset-4 hover:underline">
                Set or reset password
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
