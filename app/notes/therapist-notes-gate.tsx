import type { ReactNode } from "react"
import Link from "next/link"
import { LockKeyhole } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { AppNotice, AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"

export async function TherapistNotesGate({ children }: { children: ReactNode }) {
  const session = await getCurrentSession()

  if (session?.user?.capabilities?.canUseLocalClinicalTools) {
    return <>{children}</>
  }

  const signedIn = Boolean(session?.user?.id)

  return (
    <AppPageShell title="Local-First Documentation">
      <AppSurface
        title="Therapist membership required"
        description={
          signedIn
            ? "SOAP notes, intake forms, client journals, and ROM tools are available with an active Therapist or Team/Practice membership."
            : "Sign in with an account that has an active Therapist or Team/Practice membership to use these local documentation tools."
        }
        icon={<LockKeyhole className="h-5 w-5" aria-hidden="true" />}
        className={appCalloutClassName}
      >
        <AppNotice
          title="Tools remain visible on the documentation dashboard"
          description="MassageLab keeps the therapist note-taking tools visible so users can see what is available, while direct access stays gated by membership."
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild className="bg-primary hover:bg-brand-orange-glow">
            <Link href={signedIn ? "/account?tab=membership" : "/login"}>
              {signedIn ? "Manage membership" : "Sign in"}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/notes">View available tools</Link>
          </Button>
        </div>
      </AppSurface>
    </AppPageShell>
  )
}
