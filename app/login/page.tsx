import { Suspense } from "react"
import { hasGoogleAuthConfig } from "@/lib/auth-env"
import { AppPageShell } from "@/components/ui/app-surface"
import { LoginForm } from "./login-form"

export const dynamic = "force-dynamic"

export default function LoginPage() {
  return (
    <AppPageShell title="Login" width="narrow">
        <Suspense fallback={null}>
          <LoginForm googleEnabled={hasGoogleAuthConfig()} />
        </Suspense>
    </AppPageShell>
  )
}
