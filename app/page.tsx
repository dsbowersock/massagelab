import Link from "next/link"
import Image from "next/image"
import {
  BookOpen,
  Brain,
  CalendarDays,
  ClipboardList,
  Compass,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  LockKeyhole,
  Route,
  ShieldCheck,
  Sparkles,
  Timer,
  UserRound,
} from "lucide-react"
import { getCurrentSession } from "@/auth"
import { prisma } from "@/lib/prisma"
import { FlipWords } from "@/components/home/flip-words"
import { AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { homeToolCatalog, objectRecord, resolveOnboardingHomeToolKeys } from "@/lib/onboarding-preferences"

const homeToolIconByName = {
  Timer,
  BookOpen,
  Brain,
  ClipboardList,
  CalendarDays,
  UserRound,
  Compass,
  LockKeyhole,
  ShieldCheck,
  HeartHandshake,
  Route,
} as const

const flipWords = ["therapists", "students", "educators", "clients", "curious people"]

const proofLanes = [
  {
    title: "Learn anatomy with sourced prompts",
    description: "Build anatomy decks, practice from reviewed prompts, and keep progress when you create an account.",
    href: "/education/flashcards",
    action: "Study flashcards",
    icon: BookOpen,
    badge: "Public study",
  },
  {
    title: "Teach with a room code",
    description: "Turn anatomy review into a room-code game for study groups, classrooms, and solo practice.",
    href: "/anatomime",
    action: "Open Anatomime",
    icon: Brain,
    badge: "Classroom play",
  },
  {
    title: "Keep session pacing simple",
    description: "Use Chimer for treatment-room intervals, clock mode, and practical timing without setup friction.",
    href: "/chimer",
    action: "Start Chimer",
    icon: Timer,
    badge: "Alpha ready",
  },
  {
    title: "Document under local control",
    description: "Create SOAP, intake, journal, and ROM records in a private browser vault.",
    href: "/notes",
    action: "Review notes",
    icon: ShieldCheck,
    badge: "Local-first",
  },
  {
    title: "Organize care workflows",
    description: "Set up services, availability, booking links, waitlists, and provider capacity.",
    href: "/calendar",
    action: "Open calendar",
    icon: CalendarDays,
    badge: "Signed-in",
  },
  {
    title: "Support what comes next",
    description: "Unlock paid features, support new tools, and help MassageLab stay useful for independent practice.",
    href: "/pricing",
    action: "View pricing",
    icon: HeartHandshake,
    badge: "Memberships",
  },
] as const

export default async function Home() {
  const session = await getCurrentSession()
  const userId = session?.user?.id
  const signedIn = typeof userId === "string"
  const primaryAccountHref = signedIn ? "/account" : "/register"
  const practiceHref = signedIn ? "/calendar" : "/register?callbackUrl=%2Fcalendar"
  const accountToolHref = signedIn ? "/account" : "/register"
  const membershipHref = signedIn ? "/account?tab=membership" : "/pricing"
  const baseHomeTools = homeToolCatalog.map((tool) => ({
    ...tool,
    icon: homeToolIconByName[tool.icon as keyof typeof homeToolIconByName],
  }))
  const baseToolsByKey = new Map(baseHomeTools.map((tool) => [tool.key, tool]))

  let visibleTools = baseHomeTools
  if (userId) {
    const preference = await prisma.userPreference.findUnique({ where: { userId: userId } })
    const savedOnboarding = objectRecord(objectRecord(preference?.appSettings).onboarding)
    const preferenceHomeToolKeys = resolveOnboardingHomeToolKeys(savedOnboarding)
    const preferredKeys = new Set(preferenceHomeToolKeys)
    const orderedTools = []

    for (const key of preferenceHomeToolKeys) {
      const tool = baseToolsByKey.get(key)
      if (tool) {
        orderedTools.push(tool)
      }
    }

    visibleTools = [...orderedTools, ...baseHomeTools.filter((tool) => !preferredKeys.has(tool.key))]
  }

  const actionRouter = [
    {
      title: "Study anatomy",
      description: "Build a deck, try public prompts, and save mastery once signed in.",
      href: "/education/flashcards",
      icon: GraduationCap,
    },
    {
      title: "Teach or play",
      description: "Start Anatomime for solo review or shared classroom play.",
      href: "/anatomime",
      icon: Brain,
    },
    {
      title: "Run a session",
      description: "Open a practical treatment-room timer without account setup.",
      href: "/chimer",
      icon: Timer,
    },
    {
      title: "Organize a practice",
      description: signedIn ? "Go to your calendar workspace." : "Create an account to continue to the calendar workspace.",
      href: practiceHref,
      icon: CalendarDays,
    },
    {
      title: "Document locally",
      description: "See how local SOAP, intake, journal, and ROM records work.",
      href: "/notes",
      icon: LockKeyhole,
    },
    {
      title: "Just exploring",
      description: "Jump to the catalog of what is currently available.",
      href: "#available-tools",
      icon: Route,
    },
  ] as const

  return (
    <AppPageShell width="full" contentClassName="gap-8">
      <section className="grid gap-8 py-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.55fr)] lg:items-center lg:py-8">
        <div className="min-w-0">
          <h1 className="sr-only">MassageLab</h1>
          <div aria-hidden="true" className="relative mb-5 flex w-full justify-start py-3 sm:py-4">
            <div className="absolute inset-x-0 top-1/2 h-16 -translate-y-1/2 rounded-full bg-brand-orange-glow/28 blur-3xl dark:bg-brand-orange-glow/20 sm:inset-x-10" />
            <span
              className="ml-brand-asset-frame relative inline-block aspect-[10/3] w-full max-w-[32rem] overflow-visible rounded-2xl align-top"
              data-testid="home-brand-wordmark"
              style={{ viewTransitionName: "massagelab-wordmark" }}
            >
              <Image
                src="/brand/massagelab-home-logo-badge-padded-20260615.png"
                alt=""
                width={1536}
                height={760}
                className="absolute h-auto w-[128%] max-w-none object-contain"
                style={{ left: "-10%", top: "-58.333%" }}
                data-testid="home-brand-wordmark-image"
                sizes="(max-width: 640px) 105vw, 655px"
                loading="eager"
                priority
              />
            </span>
          </div>

          <h2 className="max-w-4xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl">
            MassageLab helps <FlipWords words={flipWords} duration={2200} className="align-baseline" /> make anatomy, care, and practice tools more useful.
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            A practical toolkit for learning anatomy, teaching body concepts, timing sessions, organizing care, and keeping your work under your control.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-primary hover:bg-brand-orange-glow">
              <Link href={primaryAccountHref}>{signedIn ? "Open your account" : "Create a free account"}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#available-tools">Explore tools</Link>
            </Button>
          </div>
        </div>

        <AppSurface
          title="Start where it helps"
          description="Use a tool right away, or create an account when you want saved progress, remembered settings, and a personalized workspace."
          icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
          className={appCalloutClassName}
        >
          <div className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-md border border-primary/30 bg-background/60 p-3">
              <p className="font-medium text-foreground">Learn the body</p>
              <p className="mt-1">Study with flashcards, play Anatomime, and revisit the concepts that need work.</p>
            </div>
            <div className="rounded-md border border-primary/30 bg-background/60 p-3">
              <p className="font-medium text-foreground">Run your day</p>
              <p className="mt-1">Use Chimer, calendar tools, and local records to keep practice work organized.</p>
            </div>
          </div>
        </AppSurface>
      </section>

      <section aria-labelledby="home-proof-heading" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Useful before the pitch</p>
            <h2 id="home-proof-heading" className="text-2xl font-semibold sm:text-3xl">Concrete tools for different reasons to visit</h2>
          </div>
          <Button asChild variant="outline">
            <Link href={membershipHref}>{signedIn ? "Review membership" : "See pricing"}</Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {proofLanes.map((lane) => {
            const Icon = lane.icon
            return (
              <AppSurface
                key={lane.title}
                title={lane.title}
                description={lane.description}
                icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                badge={lane.badge}
              >
                <Button asChild variant="outline" className="w-full">
                  <Link href={lane.href}>{lane.action}</Link>
                </Button>
              </AppSurface>
            )
          })}
        </div>
      </section>

      <AppSurface
        title={<h2 className="text-xl font-semibold">What are you here for today?</h2>}
        description="Pick a shortcut. You can ignore this and keep browsing."
        icon={<LayoutDashboard className="h-5 w-5" aria-hidden="true" />}
        contentClassName="gap-4"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {actionRouter.map((item) => {
            const Icon = item.icon
            return (
              <Button key={item.title} asChild variant="outline" className="h-auto justify-start whitespace-normal border-border/80 bg-background/70 p-4 text-left hover:border-primary/60 hover:bg-accent">
                <Link href={item.href}>
                  <span className="flex min-w-0 items-start gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{item.title}</span>
                      <span className="mt-1 block text-sm font-normal leading-5 text-muted-foreground">{item.description}</span>
                    </span>
                  </span>
                </Link>
              </Button>
            )
          })}
        </div>
      </AppSurface>

      <AppSurface contentClassName="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex items-start gap-3">
          <UserRound className="mt-1 h-5 w-5 shrink-0 text-brand-orange" />
          <div>
            <h2 className="text-xl font-semibold">Create an account when you want MassageLab to remember you</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Save flashcard progress, deck templates, settings, and profile defaults. Your signed-in home can become a personalized launchpad as the toolset grows.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 md:justify-end">
          <Button asChild className="bg-primary hover:bg-brand-orange-glow">
            <Link href={primaryAccountHref}>{signedIn ? "Open account" : "Create a free account"}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={membershipHref}>{signedIn ? "View membership" : "View pricing"}</Link>
          </Button>
        </div>
      </AppSurface>

      <section id="available-tools" aria-labelledby="available-tools-heading" className="scroll-mt-20 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Available now</p>
            <h2 id="available-tools-heading" className="text-2xl font-semibold sm:text-3xl">Available tools</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            A quick scan of the tools you can open from MassageLab now.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleTools.map((tool) => {
            const Icon = tool.icon
            const isAccountTool = tool.key === "account_memberships"
            const href = isAccountTool ? accountToolHref : tool.href
            const action = isAccountTool && !signedIn ? "Create account" : tool.action
            return (
              <AppSurface
                key={tool.key}
                title={tool.title}
                description={tool.description}
                icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                badge={tool.status}
              >
                <Button asChild variant="outline" className="w-full">
                  <Link href={href}>{action}</Link>
                </Button>
              </AppSurface>
            )
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <AppSurface
          title="Local-first clinical boundary"
          description={
            <>
              Notes, journals, intake forms, ROM sessions, and treatment details stay on your device in this alpha. Exported files stay under your control.
            </>
          }
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          className={appCalloutClassName}
        />

        <AppSurface
          title="Help build the next tools"
          description={
            <>
              Memberships and donations help build more education tools, practice workflows, and secure foundations for future features.
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
