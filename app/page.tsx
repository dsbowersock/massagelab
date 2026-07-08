import Link from "next/link"
import Image from "next/image"
import {
  BookOpen,
  Brain,
  CalendarDays,
  Calculator,
  ClipboardList,
  Compass,
  GraduationCap,
  HeartHandshake,
  LayoutDashboard,
  LockKeyhole,
  Radio,
  Route,
  ShieldCheck,
  Sparkles,
  Timer,
  UserRound,
} from "lucide-react"
import { getCurrentSession } from "@/auth"
import { prisma } from "@/lib/prisma"
import { FlipWords } from "@/components/home/flip-words"
import { HomeToolRails } from "@/components/home/home-tool-rails"
import { AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { MetalAttentionButton } from "@/components/ui/metal-attention-button"
import { homeToolCatalog, objectRecord, resolveOnboardingHomeToolKeys } from "@/lib/onboarding-preferences"
import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/")

const homeToolIconByName = {
  Timer,
  BookOpen,
  Brain,
  Calculator,
  ClipboardList,
  CalendarDays,
  UserRound,
  Compass,
  LockKeyhole,
  ShieldCheck,
  HeartHandshake,
  Radio,
  Route,
} as const

const flipWords = ["therapists", "students", "educators", "clients", "curious people"]

const proofLanes = [
  {
    title: "Massage anatomy flashcards",
    description: "Build sourced anatomy decks, practice reviewed image and recall prompts, and save mastery after creating an account.",
    href: "/education/flashcards",
    action: "Study flashcards",
    icon: BookOpen,
    badge: "Public study",
  },
  {
    title: "Anatomime classroom game",
    description: "Turn massage anatomy review into a room-code game for study groups, classrooms, and solo practice.",
    href: "/anatomime",
    action: "Open Anatomime",
    icon: Brain,
    badge: "Classroom play",
  },
  {
    title: "Massage session timer",
    description: "Use Chimer for treatment-room intervals, full-screen clock mode, and practical timing without setup friction.",
    href: "/chimer",
    action: "Start Chimer",
    icon: Timer,
    badge: "Alpha ready",
  },
  {
    title: "Local-first massage documentation",
    description: "Review the local browser vault for SOAP notes, intake forms, journals, and ROM records.",
    href: "/notes",
    action: "Review notes",
    icon: ShieldCheck,
    badge: "Local-first",
  },
  {
    title: "Massage wellness tools",
    description: "Use public breathing, music, quick check-ins, body-sensation tracking, and non-diagnostic reflection tools.",
    href: "/wellness",
    action: "Open wellness",
    icon: Radio,
    badge: "Public tools",
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
  const membershipButtonVariant = "ctaBlue"
  const baseHomeTools = homeToolCatalog.map((tool) => ({
    ...tool,
    icon: homeToolIconByName[tool.icon as keyof typeof homeToolIconByName],
  }))
  const baseToolsByKey = new Map(baseHomeTools.map((tool) => [tool.key, tool]))

  let visibleTools = baseHomeTools
  if (userId) {
    const preference = await prisma.userPreference.findUnique({
      where: { userId },
      select: { appSettings: true },
    })
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
      description: "Open massage anatomy flashcards, try public prompts, and save mastery once signed in.",
      href: "/education/flashcards",
      icon: GraduationCap,
    },
    {
      title: "Teach or play",
      description: "Start Anatomime for solo review or a massage anatomy classroom game.",
      href: "/anatomime",
      icon: Brain,
    },
    {
      title: "Run a session",
      description: "Open a practical massage session timer without account setup.",
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
    <AppPageShell width="full" className="pt-0 sm:pt-0 lg:pt-0" contentClassName="gap-8">
      <section className="grid gap-8 pb-4 pt-px lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.55fr)] lg:items-center lg:py-8">
        <div className="min-w-0">
          <h1 className="sr-only">MassageLab</h1>
          <div aria-hidden="true" className="relative mb-1 flex w-full justify-start pb-0 pt-1 sm:pb-0 sm:pt-2">
            <span
              className="ml-brand-asset-frame relative inline-block w-full max-w-[34rem] overflow-visible align-top"
              data-testid="home-brand-wordmark"
              style={{ viewTransitionName: "massagelab-wordmark" }}
            >
              <Image
                src="/brand/massagelab-wordmark-final-20260622.png"
                alt=""
                width={1518}
                height={593}
                className="relative h-auto w-full object-contain"
                data-testid="home-brand-wordmark-image"
                sizes="(max-width: 640px) 92vw, 544px"
                loading="eager"
                priority
              />
            </span>
          </div>

          <h2 className="max-w-4xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl">
            MassageLab helps <FlipWords words={flipWords} duration={2200} className="align-baseline" /> use massage anatomy flashcards, a massage session timer, classroom games, and local-first practice tools.
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Start with public study and timing tools. Create an account when you want saved flashcard progress, remembered timer settings, and a more personal workspace.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {signedIn ? (
              <Button asChild size="lg" variant="cta">
                <Link href={primaryAccountHref}>Open your account</Link>
              </Button>
            ) : (
              <MetalAttentionButton asChild size="lg">
                <Link href={primaryAccountHref}>Create a free account</Link>
              </MetalAttentionButton>
            )}
            <Button asChild size="lg" variant="secondary">
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
              <p className="mt-1">Study with massage anatomy flashcards, play Anatomime, and revisit the concepts that need work.</p>
            </div>
            <div className="rounded-md border border-primary/30 bg-background/60 p-3">
              <p className="font-medium text-foreground">Run your day</p>
              <p className="mt-1">Use a massage session timer, calendar tools, wellness tools, and local records to keep practice work organized.</p>
            </div>
          </div>
        </AppSurface>
      </section>

      <section aria-labelledby="home-proof-heading" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Useful before the pitch</p>
            <h2 id="home-proof-heading" className="text-2xl font-semibold sm:text-3xl">Focused tools for common massage searches</h2>
          </div>
          <Button asChild variant={membershipButtonVariant}>
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
                <Button asChild variant="secondary" className="w-full">
                  <Link href={lane.href}>{lane.action}</Link>
                </Button>
              </AppSurface>
            )
          })}
        </div>
      </section>

      <AppSurface
        title={<h2 className="text-xl font-semibold">What are you here for today?</h2>}
        description="Pick a shortcut for anatomy study, timing, wellness, or local-first documentation. You can ignore this and keep browsing."
        icon={<LayoutDashboard className="h-5 w-5" aria-hidden="true" />}
        contentClassName="gap-4"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {actionRouter.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.title}
                href={item.href}
                className="rounded-md border border-border/80 bg-background/70 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Button asChild variant="secondary" className="w-full justify-center gap-2" tabIndex={-1}>
                  <span>
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{item.title}</span>
                  </span>
                </Button>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </Link>
            )
          })}
        </div>
      </AppSurface>

      <section aria-labelledby="tool-discovery-heading" className="space-y-4">
        <div>
          <p className="text-sm font-medium text-primary">Tool discovery</p>
          <h2 id="tool-discovery-heading" className="text-2xl font-semibold sm:text-3xl">Pick up where MassageLab can help</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Browse practice, study, wellness, music, and business tools in a swipeable hub. Sign in when you want MassageLab to remember your shortcuts and progress.
          </p>
        </div>
        <HomeToolRails />
      </section>

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
          {signedIn ? (
            <Button asChild variant="cta">
              <Link href={primaryAccountHref}>Open account</Link>
            </Button>
          ) : (
            <MetalAttentionButton asChild>
              <Link href={primaryAccountHref}>Create a free account</Link>
            </MetalAttentionButton>
          )}
          <Button asChild variant={membershipButtonVariant}>
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
                <Button asChild variant="secondary" className="w-full">
                  <Link href={href}>{action}</Link>
                </Button>
              </AppSurface>
            )
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <AppSurface
          title="Local-first massage documentation boundary"
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
          <Button asChild variant="ctaBlue">
            <Link href="/roadmap">Open roadmap</Link>
          </Button>
        </AppSurface>
      </section>
    </AppPageShell>
  )
}
