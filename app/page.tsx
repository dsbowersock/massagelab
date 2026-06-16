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
import { FlipWords } from "@/components/home/flip-words"
import { AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"

const flipWords = ["therapists", "students", "educators", "clients", "curious people"]

const proofLanes = [
  {
    title: "Learn anatomy with sourced prompts",
    description: "Build public flashcard decks from reviewed anatomy records, then save progress when you create an account.",
    href: "/education/flashcards",
    action: "Study flashcards",
    icon: BookOpen,
    badge: "Public study",
  },
  {
    title: "Teach with a room code",
    description: "Run Anatomime as a classroom game with reusable room codes, team turns, and shared review.",
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
    description: "SOAP, intake, journal, and ROM tools stay local-first while hosted clinical sync remains gated.",
    href: "/notes",
    action: "Review notes",
    icon: ShieldCheck,
    badge: "Local-first",
  },
  {
    title: "Organize care workflows",
    description: "Calendar, booking, waitlist, service settings, and provider capacity tools are ready for small-practice shaping.",
    href: "/calendar",
    action: "Open calendar",
    icon: CalendarDays,
    badge: "Signed-in",
  },
  {
    title: "Support the careful roadmap",
    description: "Memberships fund education, practice workflows, security, and the compliance groundwork required before hosted clinical sync.",
    href: "/pricing",
    action: "View pricing",
    icon: HeartHandshake,
    badge: "Memberships",
  },
] as const

const availableTools = [
  {
    title: "Chimer",
    description: "Treatment-room timer, interval pacing, and clock mode.",
    href: "/chimer",
    action: "Open Chimer",
    icon: Timer,
    status: "Public",
  },
  {
    title: "Education flashcards",
    description: "Sourced anatomy study with public decks and signed-in progress.",
    href: "/education/flashcards",
    action: "Study flashcards",
    icon: BookOpen,
    status: "Public + signed-in progress",
  },
  {
    title: "Anatomime",
    description: "Solo and shared classroom anatomy play with room codes.",
    href: "/anatomime",
    action: "Play Anatomime",
    icon: Brain,
    status: "Public",
  },
  {
    title: "Local-first notes",
    description: "SOAP, intake, journal, and ROM tools with encrypted browser-vault boundaries.",
    href: "/notes",
    action: "Open notes",
    icon: ClipboardList,
    status: "Membership + local-first",
  },
  {
    title: "Calendar and booking",
    description: "Scheduling, availability, booking settings, public links, waitlist, and capacity controls.",
    href: "/calendar",
    action: "Open calendar",
    icon: CalendarDays,
    status: "Signed-in",
  },
  {
    title: "Account and memberships",
    description: "Safe preferences, profile defaults, role verification, pricing, checkout, and billing portal.",
    href: "/account",
    action: "Open account",
    icon: UserRound,
    status: "Signed-in",
  },
  {
    title: "Roadmap and support",
    description: "Public roadmap, support links, and funding context for future careful infrastructure.",
    href: "/roadmap",
    action: "Open roadmap",
    icon: Compass,
    status: "Public",
  },
] as const

export default async function Home() {
  const session = await getCurrentSession()
  const signedIn = Boolean(session?.user?.id)
  const primaryAccountHref = signedIn ? "/account" : "/register"
  const practiceHref = signedIn ? "/calendar" : "/register?callbackUrl=%2Fcalendar"
  const accountToolHref = signedIn ? "/account" : "/register"
  const membershipHref = signedIn ? "/account?tab=membership" : "/pricing"

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
      description: signedIn ? "Go to your calendar workspace." : "Create an account first, then continue to the calendar workspace.",
      href: practiceHref,
      icon: CalendarDays,
    },
    {
      title: "Document locally",
      description: "Review local-first notes, intake, journal, and ROM boundaries.",
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
            <div className="absolute inset-x-0 top-1/2 h-16 -translate-y-1/2 rounded-full bg-brand-orange-glow/20 blur-3xl sm:inset-x-10" />
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

          <h2 className="max-w-4xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl">
            MassageLab helps <FlipWords words={flipWords} className="align-baseline" /> make anatomy, care, and practice tools more useful.
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Study anatomy, teach with games, pace treatment-room sessions, organize care, and keep professional records local-first while MassageLab grows carefully toward funded, reviewed infrastructure.
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
          title="Independence first"
          description="The public tools stay usable without a forced first-visit questionnaire. Sign in when you want saved progress, safe preferences, profile defaults, or memberships."
          icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
          className={appCalloutClassName}
        >
          <div className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-md border border-primary/30 bg-background/60 p-3">
              <p className="font-medium text-foreground">No forced public onboarding</p>
              <p className="mt-1">Visitors can inspect and use the public surfaces first.</p>
            </div>
            <div className="rounded-md border border-primary/30 bg-background/60 p-3">
              <p className="font-medium text-foreground">Account setup happens after signup</p>
              <p className="mt-1">Role questions can become useful setup instead of a gate.</p>
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
        description="Pick a path if you want a shortcut. This does not save a role or start onboarding."
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
            <h2 className="text-xl font-semibold">A free account makes the useful parts portable</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Save safe preferences, flashcard progress, deck templates, and profile defaults. Memberships help fund education features, practice workflows, security work, and the compliance groundwork required before any hosted clinical sync.
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
            The catalog stays explicit so visitors can inspect what exists today before deciding whether to create an account.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {availableTools.map((tool) => {
            const Icon = tool.icon
            const href = tool.title === "Account and memberships" ? accountToolHref : tool.href
            const action = tool.title === "Account and memberships" && !signedIn ? "Create account" : tool.action
            return (
              <AppSurface
                key={tool.title}
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
              MassageLab does not host notes, journals, intake forms, ROM sessions, or treatment details in this alpha. Exported files stay under user control.
            </>
          }
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          className={appCalloutClassName}
        />

        <AppSurface
          title="Support compliant sync groundwork"
          description={
            <>
              Memberships and donations help fund HIPAA-capable infrastructure planning, BAAs, audit logging, security review, and future cross-device clinical sync gates.
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
