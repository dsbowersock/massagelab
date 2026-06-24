import { hasGoogleAuthConfig } from "@/lib/auth-env"
import { AppPageShell } from "@/components/ui/app-surface"
import { RegisterForm } from "./register-form"

type RegisterSearchParams = {
  callbackUrl?: string | string[]
}

// Only allow same-origin, root-relative post-registration redirects.
function safeCallbackUrl(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/onboarding"
  return value
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<RegisterSearchParams>
}) {
  const callbackUrl = safeCallbackUrl(firstQueryValue((await searchParams).callbackUrl))

  return (
    <AppPageShell title="Create Account" width="narrow">
      <RegisterForm
        googleEnabled={hasGoogleAuthConfig()}
        initialCallbackUrl={callbackUrl}
      />
    </AppPageShell>
  )
}
