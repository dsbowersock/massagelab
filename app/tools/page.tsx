import { BriefcaseBusiness, CalendarDays, HeartPulse, Timer } from "lucide-react"
import { AppActionLink, AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/tools")

const toolLinks = [
  {
    href: "/chimer",
    title: "Chimer",
    description: "Open the public massage session timer and full-screen clock mode.",
    icon: Timer,
    badge: "Public",
  },
  {
    href: "/tools/business-planner",
    title: "Business Planner",
    description: "Estimate massage session pricing, time off, workload, and take-home planning.",
    icon: BriefcaseBusiness,
    badge: "Public",
  },
  {
    href: "/wellness",
    title: "Wellness",
    description: "Use public breathing, music, practice logging, and non-diagnostic reflection tools.",
    icon: HeartPulse,
    badge: "Public",
  },
  {
    href: "/calendar",
    title: "Calendar",
    description: "Open scheduling tools for practice calendars, booking, availability, and capacity planning.",
    icon: CalendarDays,
    badge: "Signed-in",
  },
] as const

export default function ToolsPage() {
  return (
    <AppPageShell width="wide" contentClassName="gap-6">
      <AppSurface
        title="MassageLab Tools"
        description="Public and signed-in tools for massage session timing, business planning, wellness practice, and scheduling."
        icon={<Timer className="h-5 w-5" aria-hidden="true" />}
        badge="Tool index"
        className={appCalloutClassName}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {toolLinks.map((tool) => {
          const Icon = tool.icon
          return (
            <AppActionLink
              key={tool.href}
              href={tool.href}
              icon={<Icon className="h-5 w-5" aria-hidden="true" />}
              title={tool.title}
              description={tool.description}
              badge={tool.badge}
            />
          )
        })}
      </div>
    </AppPageShell>
  )
}
