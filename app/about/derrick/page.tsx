import Link from "next/link"
import { Hammer, ShieldCheck, UserRound } from "lucide-react"
import { AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"

export default function AboutDerrickPage() {
  return (
    <AppPageShell title="About Derrick" width="standard">
        <AppSurface
          title="Derrick Bowersock"
          description={
            <>
                Derrick Bowersock is building MassageLab as an active private-alpha project for massage tools, education workflows, and future practice support. This page is intentionally brief until fuller public bio copy is ready.
            </>
          }
          icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
          contentClassName="flex flex-wrap gap-3"
        >
              <Button asChild className="bg-primary hover:bg-brand-orange-glow">
                <Link href="/about">About MassageLab</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/support">Contact support</Link>
              </Button>
        </AppSurface>

        <div className="grid gap-4 md:grid-cols-2">
          <AppSurface
            title="Current focus"
            description={
              <>
                The immediate work is alpha stability, account clarity, pricing transparency, local-first privacy boundaries, and safer paths toward future hosted clinical infrastructure.
              </>
            }
            icon={<Hammer className="h-5 w-5" aria-hidden="true" />}
          />

          <AppSurface
            title="Credential note"
            description={
              <>
                MassageLab should only publish professional credentials, licensure details, or practice claims after Derrick provides the exact wording to use.
              </>
            }
            icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
            className={appCalloutClassName}
          />
        </div>
    </AppPageShell>
  )
}
