import { hasGoogleAuthConfig } from "@/lib/auth-env"
import { AppPageShell } from "@/components/ui/app-surface"
import { RegisterForm } from "./register-form"

function safeCallbackUrl(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/onboarding"
  return value
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const callbackUrl = safeCallbackUrl((await searchParams).callbackUrl ?? null)

  return (
    <AppPageShell title="Create Account" width="narrow">
      <RegisterForm
        googleEnabled={hasGoogleAuthConfig()}
        initialCallbackUrl={callbackUrl}
      />
    </AppPageShell>
  )
}
