import Link from "next/link"
import { Brain, ClipboardList, HeartHandshake, ShieldCheck, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const tools = [
  {
    title: "Chimer",
    description: "Reliable interval timer for treatment-room pacing.",
    href: "/chimer",
    action: "Start Timer",
    icon: Timer,
    status: "Alpha ready",
  },
  {
    title: "Local-First Notes",
    description: "SOAP notes, intake forms, journals, and ROM data that stay on the user's device unless exported.",
    href: "/notes",
    action: "Open Notes",
    icon: ClipboardList,
    status: "Local storage",
  },
  {
    title: "Anatomime",
    description: "Classroom anatomy game for bones and muscles with team scoring and difficulty levels.",
    href: "/anatomime",
    action: "Play Anatomime",
    icon: Brain,
    status: "Beta",
  },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-md border border-neutral-800 bg-[#202020]/90 p-6 shadow-lg backdrop-blur">
          <div className="mb-8 max-w-3xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-normal text-[#ff7043]">Private alpha</p>
            <h1 className="mb-4 text-4xl font-bold tracking-normal">MassageLab</h1>
            <p className="text-lg text-muted-foreground">
              Practical tools for massage therapists, students, and clients. Clinical tools are local-first until compliant hosted sync is funded and reviewed.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {tools.map((tool) => {
              const Icon = tool.icon
              return (
                <Card key={tool.href} className="border-neutral-800 bg-card/90 backdrop-blur">
                  <CardHeader>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <Icon className="h-5 w-5 text-[#ff7043]" />
                      <span className="rounded-sm border border-[#ff7043]/40 px-2 py-1 text-xs text-[#ffb199]">
                        {tool.status}
                      </span>
                    </div>
                    <CardTitle>{tool.title}</CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild className="w-full bg-[#ff7043] hover:bg-[#f4511e]">
                      <Link href={tool.href}>{tool.action}</Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="border-[#ff7043]/40 bg-[#ff7043]/10 backdrop-blur">
            <CardHeader>
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#ff7043]" />
                <CardTitle>Local-first clinical boundary</CardTitle>
              </div>
              <CardDescription>
                MassageLab does not host notes, journals, intake forms, or movement data in this alpha. Exported files stay under user control.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <div className="mb-3 flex items-center gap-2">
                <HeartHandshake className="h-5 w-5 text-[#ff7043]" />
                <CardTitle>Support compliant sync</CardTitle>
              </div>
              <CardDescription>
                Memberships and donations will help fund HIPAA-capable infrastructure, BAAs, audit logging, security review, and future cross-device clinical sync.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/support">Open roadmap</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
