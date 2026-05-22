import { Suspense } from "react"
import { AppPageShell } from "@/components/ui/app-surface"
import { ResetPasswordForm } from "./reset-password-form"

export default function ResetPasswordPage() {
  return (
    <AppPageShell title="New Password" width="narrow">
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
    </AppPageShell>
  )
}
