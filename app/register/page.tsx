"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AppInset, AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { legalDocumentAcceptanceId, requiredLegalDocumentsForEvent } from "@/lib/legal-documents"

/**
 * Accept only non-empty root-relative URLs that are not protocol-relative.
 *
 * @param value Raw callback value from query string.
 * @returns A safe callback path for in-app redirects.
 *
 * Allowed: non-null, non-empty strings beginning with "/".
 * Blocked: null/empty values, protocol-relative paths (for example "//evil.com"),
 * and backslash-containing paths.
 * Falls back to "/onboarding" when validation fails.
 */
function safeCallbackUrl(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/onboarding"
  return value
}

export default function RegisterPage() {
  const registrationDocuments = requiredLegalDocumentsForEvent("registration")
  const [callbackUrl, setCallbackUrl] = useState("/onboarding")
  const loginHref = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [acceptedLegalDocuments, setAcceptedLegalDocuments] = useState<string[]>([])
  const [status, setStatus] = useState("")
  const [devLink, setDevLink] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setCallbackUrl(safeCallbackUrl(new URLSearchParams(window.location.search).get("callbackUrl")))
  }, [])

  function toggleLegalDocument(documentId: string, checked: boolean) {
    setAcceptedLegalDocuments((current) => (
      checked
        ? Array.from(new Set([...current, documentId]))
        : current.filter((candidate) => candidate !== documentId)
    ))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setStatus("")
    setDevLink("")

    const response = await fetch("/api/account/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, password, acceptedLegalDocuments }),
    })
    const result = await response.json()

    setIsSubmitting(false)
    setStatus(result.message ?? "Check your email to verify your account.")
    setDevLink(result.devLink ?? "")
  }

  return (
    <AppPageShell title="Create Account" width="narrow">
        <AppSurface
          title={<h1>Create MassageLab account</h1>}
          description={
            <>
              Use email and password for a new account. Already used Google? Sign in first, then set an email password from Security.
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
              <div className="space-y-3">
                {registrationDocuments.map((document) => {
                  const documentId = legalDocumentAcceptanceId(document)

                  return (
                    <label key={document.key} className="flex gap-3 rounded-md border border-border/80 bg-background/70 p-3 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={acceptedLegalDocuments.includes(documentId)}
                        onChange={(event) => toggleLegalDocument(documentId, event.target.checked)}
                        required
                      />
                      <span>
                        I agree to the{" "}
                        <Link href={document.route} className="text-brand-orange underline-offset-4 hover:underline">
                          {document.label}
                        </Link>
                        .
                      </span>
                    </label>
                  )
                })}
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
                Sign in instead
              </Link>
              <Link href="/forgot-password" className="underline-offset-4 hover:underline">
                Set or reset password
              </Link>
            </div>
        </AppSurface>
    </AppPageShell>
  )
}
