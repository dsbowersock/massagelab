import Link from "next/link"
import Image from "next/image"
import { Brain, CalendarDays, ClipboardList, HeartHandshake, ShieldCheck, Timer, UserRound } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"

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
    <AppPageShell>
        <AppSurface contentClassName="gap-5">
          <div className="mx-auto mb-5 max-w-3xl">
            <h1 className="sr-only">MassageLab</h1>
            <div aria-hidden="true" className="relative mb-3 flex w-full justify-center py-3 sm:py-4">
              <div className="absolute inset-x-8 top-1/2 h-16 -translate-y-1/2 rounded-full bg-brand-orange-glow/20 blur-3xl sm:inset-x-16" />
              <span className="ml-brand-asset-frame relative inline-flex max-w-full rounded-2xl">
                <Image
                  src="/brand/massagelab-wordmark-uppercase-tight-20260522.png"
                  alt=""
                  width={360}
                  height={108}
                  className="relative h-auto w-full max-w-[28rem] object-contain"
                  data-testid="home-brand-wordmark"
                  style={{ viewTransitionName: "massagelab-wordmark" }}
                  sizes="(max-width: 640px) 82vw, 448px"
                  loading="eager"
                  priority
                />
              </span>
            </div>
            <p className="text-lg text-muted-foreground">
              Practical tools for massage therapists, students, and clients. Clinical tools are local-first until compliant hosted sync is funded and reviewed.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {tools.map((tool) => {
              const Icon = tool.icon
              return (
                <AppSurface
                  key={tool.href}
                  title={tool.title}
                  description={tool.description}
                  icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                  badge={tool.status}
                >
                    <Button asChild className="w-full bg-primary hover:bg-brand-orange-glow">
                      <Link href={tool.href}>{tool.action}</Link>
                    </Button>
                </AppSurface>
              )
            })}
          </div>
        </AppSurface>

        <AppSurface contentClassName="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
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
        </AppSurface>

        <section className="grid gap-4 md:grid-cols-2">
          <AppSurface
            title="Local-first clinical boundary"
            description={
              <>
                MassageLab does not host notes, journals, intake forms, or movement data in this alpha. Exported files stay under user control.
              </>
            }
            icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
            className={appCalloutClassName}
          />

          <AppSurface
            title="Support compliant sync"
            description={
              <>
                Memberships and donations will help fund HIPAA-capable infrastructure, BAAs, audit logging, security review, and future cross-device clinical sync.
              </>
            }
            icon={<HeartHandshake className="h-5 w-5" aria-hidden="true" />}
          >
              <Button asChild variant="outline">
                <Link href="/roadmap">Open roadmap</Link>
              </Button>
          </AppSurface>
        </section>
    </AppPageShell>
  )
}
