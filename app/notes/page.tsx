import Link from "next/link"
import { Activity, ClipboardCheck, ClipboardList, FileText, Footprints, HeartPulse, LifeBuoy, ShieldCheck } from "lucide-react"
import { AppInset, AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"

const noteTypes = [
  {
    title: "S.O.A.P. Notes",
    description: "Create, save locally, import, and export session notes.",
    icon: FileText,
    href: "/notes/soap",
    available: true,
  },
  {
    title: "Intake Forms",
    description: "Collect client intake details as local-first files.",
    icon: ClipboardList,
    href: "/notes/intake",
    available: true,
  },
  {
    title: "Client Journal",
    description: "Track pain, sensation, and incidents as local-first entries.",
    icon: HeartPulse,
    href: "/notes/journal",
    available: true,
  },
  {
    title: "Range of Motion",
    description: "Capture manual or phone-orientation movement measurements locally.",
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

export default function NotesPage() {
  return (
    <AppPageShell title="Local-First Documentation">
        <AppSurface
          title="PHI stays under user control"
          description={
            <>
                MassageLab does not upload notes, intake forms, journals, or movement data in this alpha. Users are responsible for how exported files are stored or shared.
            </>
          }
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          className={appCalloutClassName}
        />

        <div className="grid gap-4 md:grid-cols-2">
          {noteTypes.map((note) => {
            const Icon = note.icon
            return (
              <Link key={note.href} href={note.href}>
                <AppSurface
                  title={note.title}
                  description={note.description}
                  icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                  className="h-full transition-colors hover:bg-accent"
                >
                    <p className="text-sm text-muted-foreground">Open {note.title.toLowerCase()}</p>
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
