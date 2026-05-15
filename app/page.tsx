import Link from "next/link"
import Image from "next/image"
import { Brain, CalendarDays, ClipboardList, HeartHandshake, ShieldCheck, Timer, UserRound } from "lucide-react"
import { getCurrentSession } from "@/auth"
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
    title: "Calendar",
    description: "Small-practice scheduling with therapist availability and client-account booking.",
    href: "/calendar",
    action: "Open Calendar",
    icon: CalendarDays,
    status: "New",
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

export default async function Home() {
  const session = await getCurrentSession()

  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-md border border-border bg-card/90 p-6 shadow-lg backdrop-blur">
          <div className="mx-auto mb-5 max-w-3xl">
            <h1 className="sr-only">MassageLab</h1>
            <div aria-hidden="true" className="relative mb-3 flex w-full justify-center py-3 sm:py-4">
              <div className="absolute inset-x-8 top-1/2 h-16 -translate-y-1/2 rounded-full bg-brand-orange-glow/20 blur-3xl sm:inset-x-16" />
              <Image
                src="/brand/massagelab-wordmark-uppercase-tight.png"
                alt=""
                width={360}
                height={108}
                className="relative h-auto w-full max-w-[28rem] object-contain drop-shadow-[0_0_32px_hsl(var(--brand-orange-glow)/0.2)]"
                data-testid="home-brand-wordmark"
                style={{ viewTransitionName: "massagelab-wordmark" }}
                unoptimized
                priority
              />
            </div>
            <p className="text-lg text-muted-foreground">
              Practical tools for massage therapists, students, and clients. Clinical tools are local-first until compliant hosted sync is funded and reviewed.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {tools.map((tool) => {
              const Icon = tool.icon
              return (
                <Card key={tool.href} className="border-neutral-800 bg-card/90 backdrop-blur">
                  <CardHeader>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <Icon className="h-5 w-5 text-brand-orange" />
                      <span className="rounded-sm border border-brand-orange/40 px-2 py-1 text-xs text-brand-orange-soft">
                        {tool.status}
                      </span>
                    </div>
                    <CardTitle>{tool.title}</CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild className="w-full bg-primary hover:bg-brand-orange-glow">
                      <Link href={tool.href}>{tool.action}</Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="rounded-md border border-neutral-800 bg-card/90 p-5 backdrop-blur">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex items-start gap-3">
              <UserRound className="mt-1 h-5 w-5 shrink-0 text-brand-orange" />
              <div>
                <h2 className="text-xl font-semibold">A free account keeps your tools portable</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Sign in to sync safe preferences, progress, templates, and profile defaults. Optional memberships help fund low-cost tools, education features, practice workflows, and the compliance work needed for future hosted sync.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              {session?.user?.id ? (
                <>
                  <Button asChild className="bg-primary hover:bg-brand-orange-glow">
                    <Link href="/account">Open account</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/account#membership">View memberships</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild className="bg-primary hover:bg-brand-orange-glow">
                    <Link href="/register">Create free account</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/login">Sign in</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="border-brand-orange/40 bg-primary/10 backdrop-blur">
            <CardHeader>
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-brand-orange" />
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
                <HeartHandshake className="h-5 w-5 text-brand-orange" />
                <CardTitle>Support compliant sync</CardTitle>
              </div>
              <CardDescription>
                Memberships and donations will help fund HIPAA-capable infrastructure, BAAs, audit logging, security review, and future cross-device clinical sync.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/roadmap">Open roadmap</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
