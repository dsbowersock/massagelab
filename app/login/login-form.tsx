"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Mail, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type LoginFormProps = {
  googleEnabled: boolean
}

const ERROR_MESSAGES: Record<string, string> = {
  EMAIL_UNVERIFIED: "Verify your email before signing in.",
  INVALID_CREDENTIALS: "Email or password is incorrect.",
  RATE_LIMITED: "Too many attempts. Try again later.",
  TWO_FACTOR_INVALID: "The authenticator or backup code was not accepted.",
  CredentialsSignin: "Email or password is incorrect.",
}

export function LoginForm({ googleEnabled }: LoginFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false)
  const [status, setStatus] = useState(searchParams.get("verified") ? "Email verified. You can sign in now." : "")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleEmailLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("")
    setIsSubmitting(true)

    const result = await signIn("credentials", {
      email,
      password,
      twoFactorCode,
      redirect: false,
    })

    setIsSubmitting(false)

    if (!result?.error) {
      router.push("/account")
      router.refresh()
      return
    }

    const errorCode = result.code ?? result.error

    if (errorCode === "TWO_FACTOR_REQUIRED") {
      setNeedsTwoFactor(true)
      setStatus("Enter your authenticator app code or a backup code.")
      return
    }

    setStatus((errorCode ? ERROR_MESSAGES[errorCode] : undefined) ?? "Sign in failed. Try again.")
  }

  return (
    <Card className="border-neutral-800 bg-card/90 backdrop-blur">
      <CardHeader>
        <CardTitle>MassageLab account</CardTitle>
        <CardDescription>
          Sign in to sync preferences, profile defaults, progress, templates, and achievements. Core tools still work without login.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form className="space-y-3" onSubmit={handleEmailLogin}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {needsTwoFactor && (
            <div className="space-y-2">
              <Label htmlFor="twoFactorCode">Authenticator or backup code</Label>
              <Input
                id="twoFactorCode"
                value={twoFactorCode}
                onChange={(event) => setTwoFactorCode(event.target.value)}
                autoComplete="one-time-code"
                required
              />
            </div>
          )}
          <Button type="submit" className="w-full bg-primary hover:bg-brand-orange-glow" disabled={isSubmitting}>
            <Mail className="mr-2 h-4 w-4" />
            Sign in with email
          </Button>
        </form>

        {googleEnabled ? (
          <Button type="button" variant="outline" className="w-full" onClick={() => signIn("google", { redirectTo: "/account" })}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Continue with Google
          </Button>
        ) : (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
            Set the Google OAuth environment variables in Vercel to enable Google login.
          </div>
        )}

        {status && (
          <p className="rounded-md border border-neutral-800 bg-background/70 p-3 text-sm text-muted-foreground">
            {status}
          </p>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link href="/register" className="text-brand-orange underline-offset-4 hover:underline">
            Create an account
          </Link>
          <Link href="/forgot-password" className="text-brand-orange underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
