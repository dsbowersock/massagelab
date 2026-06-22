import Link from "next/link"
import { BriefcaseBusiness, Calculator, ClipboardList, Megaphone, NotebookPen } from "lucide-react"
import { AppActionLink, AppInset, AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/tools/business-planner")

const plannedTools = [
  {
    title: "Service menu planner",
    description: "Compare session lengths, add-ons, and pricing patterns before publishing a menu.",
    icon: ClipboardList,
  },
  {
    title: "Practice launch checklist",
    description: "Turn business-plan homework into concrete setup, licensing, and operations steps.",
    icon: NotebookPen,
  },
  {
    title: "Marketing rhythm planner",
    description: "Plan simple outreach, retention, and referral habits without turning massage into busywork.",
    icon: Megaphone,
  },
] as const

export default function BusinessPlannerHubPage() {
  return (
    <AppPageShell width="wide" contentClassName="gap-6">
      <AppSurface
        title="Business Planner"
        description="Massage business planning tools for students, therapists, educators, and small practice owners."
        icon={<BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />}
        badge="Public tools"
        className={appCalloutClassName}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <AppInset className="p-3">
            <p className="text-xs uppercase tracking-normal text-muted-foreground">First Tool</p>
            <p className="mt-1 text-lg font-semibold">Income Planner</p>
          </AppInset>
          <AppInset className="p-3">
            <p className="text-xs uppercase tracking-normal text-muted-foreground">Saved Work</p>
            <p className="mt-1 text-lg font-semibold">One current worksheet</p>
          </AppInset>
          <AppInset className="p-3">
            <p className="text-xs uppercase tracking-normal text-muted-foreground">Boundary</p>
            <p className="mt-1 text-lg font-semibold">Business data only</p>
          </AppInset>
        </div>
      </AppSurface>

      <AppActionLink
        href="/tools/business-planner/income"
        icon={<Calculator className="h-5 w-5" aria-hidden="true" />}
        title="Business Income Planner"
        description="Estimate take-home goals, session pricing, time off, workload capacity, and wage comparisons without doing the math by hand."
        badge="Live"
      />

      <section aria-labelledby="planned-business-tools-heading" className="space-y-3">
        <div>
          <p className="text-sm font-medium text-primary">Planned next</p>
          <h2 id="planned-business-tools-heading" className="text-2xl font-semibold">Future business planner tools</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plannedTools.map((tool) => {
            const Icon = tool.icon
            return (
              <AppSurface
                key={tool.title}
                title={tool.title}
                description={tool.description}
                icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                badge="Planned"
              />
            )
          })}
        </div>
      </section>

      <AppSurface
        title="Use these numbers as planning estimates"
        description="The planner is for education and business planning. It does not replace tax, accounting, employment, or legal advice."
      >
        <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/about">
          Learn why MassageLab is building tools from inside massage practice
        </Link>
      </AppSurface>
    </AppPageShell>
  )
}
