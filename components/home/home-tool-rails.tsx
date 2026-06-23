import Link from "next/link"
import {
  BookOpen,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  HeartPulse,
  type LucideIcon,
  Radio,
  Timer,
  Wind,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const railIcons = {
  BookOpen,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  HeartPulse,
  Radio,
  Timer,
  Wind,
} satisfies Record<string, LucideIcon>

export type HomeRailItem = {
  title: string
  description: string
  href: string
  action: string
  badge: string
  icon: keyof typeof railIcons
}

export type HomeToolRail = {
  id: string
  title: string
  description: string
  items: HomeRailItem[]
}

export const publicHomeToolRails: HomeToolRail[] = [
  {
    id: "practice",
    title: "Practice tools",
    description: "Session timing, scheduling, and local-first work surfaces.",
    items: [
      { title: "Chimer", description: "Treatment-room intervals and clock mode.", href: "/chimer", action: "Start timer", badge: "Public", icon: "Timer" },
      { title: "Calendar", description: "Scheduling entry point and booking workspace.", href: "/calendar", action: "Open calendar", badge: "Signed-in saves", icon: "CalendarDays" },
      { title: "Local-first notes", description: "SOAP, intake, journal, and ROM vault preview.", href: "/notes", action: "Review notes", badge: "Local-first", icon: "ClipboardList" },
    ],
  },
  {
    id: "study",
    title: "Study tools",
    description: "Anatomy study and classroom-friendly games.",
    items: [
      { title: "Flashcards", description: "Sourced anatomy decks and typed review.", href: "/education/flashcards", action: "Study", badge: "Public study", icon: "BookOpen" },
      { title: "Anatomime", description: "Solo or shared anatomy clue play.", href: "/anatomime", action: "Play", badge: "Classroom", icon: "Brain" },
    ],
  },
  {
    id: "wellness",
    title: "Wellness tools",
    description: "Public practice tracking and client-owned self-reporting.",
    items: [
      { title: "Wellness hub", description: "Quick logs, body sensations, ROM, and reflection.", href: "/wellness", action: "Open wellness", badge: "Practice mode", icon: "HeartPulse" },
      { title: "Breathing guide", description: "A simple breathing pacer for settling.", href: "/wellness/breathing", action: "Start breathing", badge: "Public", icon: "Wind" },
    ],
  },
  {
    id: "music",
    title: "Music and focus",
    description: "Generative stations for massage-room pacing, studying, or focus.",
    items: [
      { title: "Music", description: "Swipeable station rails with a persistent player.", href: "/music", action: "Open music", badge: "Public audio", icon: "Radio" },
    ],
  },
  {
    id: "business",
    title: "Business tools",
    description: "Planning worksheets for students and independent therapists.",
    items: [
      { title: "Business planner", description: "Income, startup costs, service menus, and launch tasks.", href: "/tools/business-planner", action: "Open planner", badge: "Browser-local", icon: "BriefcaseBusiness" },
    ],
  },
]

export function HomeToolRails({ rails = publicHomeToolRails }: { rails?: HomeToolRail[] }) {
  return (
    <div className="space-y-8">
      {rails.map((rail) => (
        <section key={rail.id} aria-label={rail.title} className="space-y-3">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-normal">{rail.title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{rail.description}</p>
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
            {rail.items.map((item) => {
              const Icon = railIcons[item.icon]

              return (
                <article
                  key={item.title}
                  className={cn(
                    "flex min-w-[min(76vw,17rem)] snap-start flex-col rounded-md border border-border/80 bg-card/95 p-4 shadow-xl shadow-black/20 ring-1 ring-white/[0.03]",
                    "sm:min-w-[18rem] lg:min-w-[19rem]",
                  )}
                >
                  <div className="mb-4 flex aspect-[4/3] items-center justify-center rounded-md border border-border/70 bg-background/75">
                    <Icon className="size-12 text-primary" aria-hidden="true" />
                  </div>
                  <div className="flex min-h-40 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <Badge variant="outline" className="shrink-0 border-primary/50 text-primary">{item.badge}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                    <Button asChild variant="outline" className="mt-auto">
                      <Link href={item.href}>{item.action}</Link>
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
