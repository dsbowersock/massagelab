import Link from "next/link"
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  Calculator,
  ClipboardList,
  ListChecks,
  NotebookPen,
  PackagePlus,
  type LucideIcon,
} from "lucide-react"
import { AppActionLink, AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { BUSINESS_PLAN_TOOL_ROUTES } from "@/lib/business-plan-template-tools"
import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/tools/business-planner")

const toolIcons = {
  BadgeDollarSign,
  Calculator,
  ClipboardList,
  ListChecks,
  NotebookPen,
  PackagePlus,
} satisfies Record<string, LucideIcon>

export default function BusinessPlannerHubPage() {
  return (
    <AppPageShell width="wide" contentClassName="gap-6">

      <section aria-labelledby="business-tools-heading" className="space-y-3">
        <div>
          <p className="text-sm font-medium text-primary">From the student template</p>
          <h2 id="business-tools-heading" className="text-2xl font-semibold">Business planner tools</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {BUSINESS_PLAN_TOOL_ROUTES.map((tool) => {
            const Icon = toolIcons[tool.icon as keyof typeof toolIcons] ?? BriefcaseBusiness
            return (
              <AppActionLink
                href={tool.href}
                key={tool.title}
                icon={<Icon className="h-5 w-5" aria-hidden="true" />}
                title={tool.title}
                description={tool.description}
                badge={tool.status}
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
