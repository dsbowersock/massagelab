import Link from "next/link"
import { Activity, ClipboardCheck, ClipboardList, FileText, Footprints, HeartPulse, LifeBuoy, LockKeyhole, ShieldCheck } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { AppInset, AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Badge } from "@/components/ui/badge"

const noteTypes = [
  {
    title: "S.O.A.P. Notes",
    description: "Create and save session notes in the encrypted professional-record vault.",
    icon: FileText,
    href: "/notes/soap",
    available: true,
    roadmapLabel: "Voice notes goal",
    roadmapDescription: "Member support helps fund local transcription experiments and therapist-reviewed SOAP drafting.",
  },
  {
    title: "Intake Forms",
    description: "Build templates, fill tablet forms, and link intake documents inside the shared vault.",
    icon: ClipboardList,
    href: "/notes/intake",
    available: true,
    roadmapLabel: "Conversation transcription goal",
    roadmapDescription: "A future consent-first transcription helper should make intake conversations easier to turn into usable notes.",
  },
  {
    title: "Client Journal",
    description: "Track pain, sensation, and incidents in encrypted local records.",
    icon: HeartPulse,
    href: "/notes/journal",
    available: true,
    roadmapLabel: "",
    roadmapDescription: "",
  },
  {
    title: "Range of Motion",
    description: "Capture manual or phone-orientation movement measurements in the vault.",
    icon: Activity,
    href: "/notes/rom",
    available: true,
    roadmapLabel: "",
    roadmapDescription: "",
  },
]

const plannedTools = [
  { title: "Postural Assessment", description: "Structured observations and photo-free posture notes.", icon: Activity },
  { title: "Muscle Testing", description: "Scope-aware strength and response tracking.", icon: ClipboardCheck },
  { title: "Gait Assessment", description: "Walking observations that stay in the local record.", icon: Footprints },
  { title: "Orthopedic Tests", description: "Therapist-entered test notes with review prompts.", icon: Activity },
]

export default async function NotesPage() {
  const session = await getCurrentSession()
  const canUseLocalClinicalTools = Boolean(session?.user?.capabilities?.canUseLocalClinicalTools)
  const lockedHref = session?.user?.id ? "/account?tab=membership" : "/login"
  const membershipHref = session?.user?.id ? "/account?tab=membership" : "/pricing"

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
                    {note.roadmapLabel ? (
                      <div className="mb-3 rounded-md border border-brand-orange/35 bg-primary/10 p-3">
                        <Badge variant="outline" className="mb-2 border-brand-orange/40 text-brand-orange">
                          {note.roadmapLabel}
                        </Badge>
                        <p className="text-sm text-muted-foreground">{note.roadmapDescription}</p>
                      </div>
                    ) : null}
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      {!canUseLocalClinicalTools ? <LockKeyhole className="h-4 w-4" aria-hidden="true" /> : null}
                      <span>{canUseLocalClinicalTools ? `Open ${note.title.toLowerCase()}` : "Therapist or Team/Practice required"}</span>
                    </p>
                </AppSurface>
              </Link>
            )
          })}
        </div>

        <AppSurface
          title="More documentation tools we want to build"
          description="These are roadmap tools, not hidden features. Member support helps turn them into careful, useful workflows."
        >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {plannedTools.map((tool) => {
                const Icon = tool.icon
                return (
                  <AppInset key={tool.title} className="min-h-24 space-y-2 p-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-3 font-medium text-foreground">
                      <Icon className="h-4 w-4 text-brand-orange" />
                      <span>{tool.title}</span>
                    </div>
                    <p>{tool.description}</p>
                  </AppInset>
                )
              })}
            </div>
        </AppSurface>

        <Link href={membershipHref}>
          <AppSurface
            title="Help fund careful documentation features"
            description={
              <>
                Memberships help fund the legal, security, and compliance work needed for advanced documentation features like voice notes, SOAP assistance, and future managed sync.
              </>
            }
            icon={<LifeBuoy className="h-5 w-5" aria-hidden="true" />}
            className="transition-colors hover:bg-accent"
          >
              <p className="text-sm text-muted-foreground">{session?.user?.id ? "Open membership" : "View memberships"}</p>
          </AppSurface>
        </Link>
    </AppPageShell>
  )
}
