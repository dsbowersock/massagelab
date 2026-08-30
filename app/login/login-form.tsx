"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Mail, ShieldCheck } from "lucide-react"
import { AppInset, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { startGoogleAuthMethodIntent, useEntryAction } from "@/lib/auth-entry-actions"
import { buildRegistrationLegalProviderRedirectPath } from "@/lib/legal-acceptance-gate"

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

function safeCallbackUrl(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/account"
  return value
}

export function LoginForm({ googleEnabled }: LoginFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasCallbackUrl = searchParams.has("callbackUrl")
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"))
  // Google OAuth defaults to onboarding only when no callback was requested.
  const googleCallbackUrl = hasCallbackUrl ? callbackUrl : "/onboarding"
  const googleRedirectTo = buildRegistrationLegalProviderRedirectPath(googleCallbackUrl)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false)
  const [status, setStatus] = useState(searchParams.get("verified") ? "Email verified. You can sign in now." : "")
  const [statusIsError, setStatusIsError] = useState(false)
  const { entryAction, beginEntryAction, finishEntryAction } = useEntryAction()

  async function handleEmailLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!beginEntryAction("email")) return
    setStatus("")
    setStatusIsError(false)
    try {
      const result = await signIn("credentials", {
        email,
        password,
        twoFactorCode,
        redirect: false,
      })
      if (!result?.error) {
        router.push(callbackUrl)
        router.refresh()
        return
      }
      const errorCode = result.code ?? result.error
      if (errorCode === "TWO_FACTOR_REQUIRED") {
        setNeedsTwoFactor(true)
        setStatus("Enter your authenticator app code or a backup code.")
        setStatusIsError(false)
        return
      }
      setStatus((errorCode ? ERROR_MESSAGES[errorCode] : undefined) ?? "Sign in failed. Try again.")
      setStatusIsError(true)
    } catch {
      setStatus("Sign in failed. Try again.")
      setStatusIsError(true)
    } finally {
      finishEntryAction()
    }
  }

  async function handleGoogleLogin() {
    if (!beginEntryAction("google")) return
    setStatus("")
    setStatusIsError(false)
    let navigating = false
    try {
      navigating = await startGoogleAuthMethodIntent(googleRedirectTo) === "navigating"
      setStatus("Taking you to Google…")
    } catch {
      setStatus("Google sign-in could not be started. Try again or use email and password.")
      setStatusIsError(true)
    } finally {
      if (!navigating) finishEntryAction()
    }
  }

  return (
    <AppSurface
      title="MassageLab account"
      description={
        <>
          Sign in to sync preferences, profile defaults, progress, templates, and achievements. Core tools still work without login.
        </>
      }
      contentClassName="gap-5"
    >
        <form className="space-y-3" onSubmit={handleEmailLogin} aria-busy={entryAction === "email"}>
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
          <Button type="submit" className="w-full" disabled={entryAction !== "idle"}>
            <Mail className="mr-2 h-4 w-4" />
            {entryAction === "email" ? "Signing in…" : "Sign in with email"}
          </Button>
        </form>

        {googleEnabled ? (
          <Button type="button" variant="outline" className="w-full" disabled={entryAction !== "idle"} onClick={handleGoogleLogin}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            {entryAction === "google" ? "Starting Google sign-in…" : "Continue with Google"}
          </Button>
        ) : (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
            Google sign-in is not available right now. Use email and password, or try Google again later.
          </div>
        )}

        {status && (
          <AppInset className={`p-3 text-sm ${statusIsError ? "text-amber-100" : "text-muted-foreground"}`}>
            <p role={statusIsError ? "alert" : "status"} aria-live={statusIsError ? "assertive" : "polite"}>{status}</p>
          </AppInset>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="text-brand-orange underline-offset-4 hover:underline">
            Create an account
          </Link>
          <Link href="/forgot-password" className="text-brand-orange underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
    </AppSurface>
  )
}
