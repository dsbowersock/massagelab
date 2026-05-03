import { Suspense } from "react"
import { hasGoogleAuthConfig } from "@/lib/auth-env"
import { PageHeading } from "@/components/ui/page-heading"
import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-xl space-y-6">
        <PageHeading>Login</PageHeading>
        <Suspense fallback={null}>
          <LoginForm googleEnabled={hasGoogleAuthConfig()} />
        </Suspense>
      </div>
    </div>
  )
}
