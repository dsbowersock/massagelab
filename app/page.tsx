import Link from "next/link"
import { Brain, ClipboardList, Timer } from "lucide-react"
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
    description: "SOAP notes and intake forms that stay on the user's device unless exported.",
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
              Practical tools for massage therapists and students. Chimer is the first production-quality surface; PHI tools are local-first.
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
      </div>
    </div>
  )
}
