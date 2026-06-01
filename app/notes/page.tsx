import Link from "next/link"
import { Activity, ClipboardCheck, ClipboardList, FileText, Footprints, HeartPulse, LifeBuoy, LockKeyhole, ShieldCheck } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { AppInset, AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"

const noteTypes = [
  {
    title: "S.O.A.P. Notes",
    description: "Create and save session notes in the encrypted professional-record vault.",
    icon: FileText,
    href: "/notes/soap",
    available: true,
  },
  {
    title: "Intake Forms",
    description: "Build templates, fill tablet forms, and link intake documents inside the shared vault.",
    icon: ClipboardList,
    href: "/notes/intake",
    available: true,
  },
  {
    title: "Client Journal",
    description: "Track pain, sensation, and incidents in encrypted local records.",
    icon: HeartPulse,
    href: "/notes/journal",
    available: true,
  },
  {
    title: "Range of Motion",
    description: "Capture manual or phone-orientation movement measurements in the vault.",
    icon: Activity,
    href: "/notes/rom",
    available: true,
  },
]

const plannedTools = [
  { title: "Postural Assessment", icon: Activity },
  { title: "Muscle Testing", icon: ClipboardCheck },
  { title: "Gait Assessment", icon: Footprints },
  { title: "Orthopedic Tests", icon: Activity },
]

export default async function NotesPage() {
  const session = await getCurrentSession()
  const canUseLocalClinicalTools = Boolean(session?.user?.capabilities?.canUseLocalClinicalTools)
  const lockedHref = session?.user?.id ? "/account?tab=membership" : "/login"

  return (
    <AppPageShell title="Local-First Documentation">
        <AppSurface
          title={canUseLocalClinicalTools ? "PHI stays under user control" : "Therapist or Team/Practice required"}
          description={
            <>
                MassageLab stores therapist documentation in one encrypted local professional-record vault in this alpha. Therapist note-taking tools are visible here, but using them requires an active Therapist or Team/Practice membership.
            </>
          }
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          className={appCalloutClassName}
        />

        <div className="grid gap-4 md:grid-cols-2">
          {noteTypes.map((note) => {
            const Icon = note.icon
            const href = canUseLocalClinicalTools ? note.href : lockedHref
            return (
              <Link key={note.href} href={href}>
                <AppSurface
                  title={note.title}
                  description={note.description}
                  icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                  className="h-full transition-colors hover:bg-accent"
                >
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      {!canUseLocalClinicalTools ? <LockKeyhole className="h-4 w-4" aria-hidden="true" /> : null}
                      <span>{canUseLocalClinicalTools ? `Open ${note.title.toLowerCase()}` : "Therapist or Team/Practice required"}</span>
                    </p>
                </AppSurface>
              </Link>
            )
          })}
        </div>

        <AppSurface title="Planned Documentation Tools" description="These remain visible as roadmap tools until their workflows are implemented.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {plannedTools.map((tool) => {
                const Icon = tool.icon
                return (
                  <AppInset key={tool.title} className="flex min-h-16 items-center gap-3 p-3 text-sm text-muted-foreground">
                    <Icon className="h-4 w-4 text-brand-orange" />
                    <span>{tool.title}</span>
                  </AppInset>
                )
              })}
            </div>
        </AppSurface>

        <Link href="/roadmap">
          <AppSurface
            title="Support the MassageLab roadmap"
            description={
              <>
                Learn how roadmap funding helps unlock HIPAA-ready note sync, compliance infrastructure, and future clinical documentation tools.
              </>
            }
            icon={<LifeBuoy className="h-5 w-5" aria-hidden="true" />}
            className="transition-colors hover:bg-accent"
          >
              <p className="text-sm text-muted-foreground">Open the roadmap</p>
          </AppSurface>
        </Link>
    </AppPageShell>
  )
}
