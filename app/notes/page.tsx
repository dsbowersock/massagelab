import Link from "next/link"
import { Activity, ClipboardCheck, ClipboardList, FileText, Footprints, HeartPulse, LifeBuoy, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"

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
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeading>Local-First Documentation</PageHeading>

        <Card className="border-[#ff7043]/40 bg-[#ff7043]/10 backdrop-blur">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <ShieldCheck className="mt-1 h-5 w-5 text-[#ff7043]" />
            <div>
              <CardTitle>PHI stays under user control</CardTitle>
              <CardDescription>
                MassageLab does not upload notes, intake forms, journals, or movement data in this alpha. Users are responsible for how exported files are stored or shared.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {noteTypes.map((note) => {
            const Icon = note.icon
            return (
              <Link key={note.href} href={note.href}>
                <Card className="h-full border-neutral-800 bg-card/90 backdrop-blur transition-colors hover:bg-accent">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-[#ff7043]" />
                      <CardTitle>{note.title}</CardTitle>
                    </div>
                    <CardDescription>{note.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Open {note.title.toLowerCase()}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        <Card className="border-neutral-800 bg-[#202020]/90 backdrop-blur">
          <CardHeader>
            <CardTitle>Planned Documentation Tools</CardTitle>
            <CardDescription>These remain visible as roadmap tools until their workflows are implemented.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {plannedTools.map((tool) => {
                const Icon = tool.icon
                return (
                  <div key={tool.title} className="flex min-h-16 items-center gap-3 rounded-md border border-neutral-800 bg-background/70 p-3 text-sm text-muted-foreground">
                    <Icon className="h-4 w-4 text-[#ff7043]" />
                    <span>{tool.title}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Link href="/roadmap">
          <Card className="border-neutral-800 bg-card/90 backdrop-blur transition-colors hover:bg-accent">
            <CardHeader>
              <div className="flex items-center gap-2">
                <LifeBuoy className="h-5 w-5 text-[#ff7043]" />
                <CardTitle>Support the MassageLab roadmap</CardTitle>
              </div>
              <CardDescription>
                Learn how roadmap funding helps unlock HIPAA-ready note sync, compliance infrastructure, and future clinical documentation tools.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Open the roadmap</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
