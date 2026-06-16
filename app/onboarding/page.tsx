import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, BadgeCheck, Gamepad2, LayoutDashboard, MapPinned } from "lucide-react"
import { getCurrentSession } from "@/auth"
import {
  getOnboardingRecommendedPath,
  onboardingRoleOptions,
  onboardingUseCaseOptions,
  objectRecord,
} from "@/lib/onboarding-preferences"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { saveOnboardingAction } from "@/app/onboarding/actions"
import { AppInset, AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export const dynamic = "force-dynamic"

export default async function OnboardingPage() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fonboarding")
  }

  const preferences = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
  })
  const appSettings = objectRecord(preferences?.appSettings)
  const savedOnboarding = objectRecord(appSettings.onboarding)
  const savedRole = typeof savedOnboarding.primaryRole === "string" ? savedOnboarding.primaryRole : "public_wellness"
  const savedUseCases = new Set(Array.isArray(savedOnboarding.useCases) ? savedOnboarding.useCases.filter((value) => typeof value === "string") : [])
  const savedJurisdiction = typeof savedOnboarding.jurisdiction === "string" ? savedOnboarding.jurisdiction : ""
  const recommendedPath = getOnboardingRecommendedPath(savedRole)

  return (
    <AppPageShell title="Onboarding">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(18rem,0.42fr)]">
        <AppSurface
          title="Choose your starting path"
          description="A few account-safe answers help MassageLab put the right tools in reach after sign-in. You can skip this or change it later."
          contentClassName="gap-6"
        >
          <form action={saveOnboardingAction} className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2">
              {onboardingRoleOptions.map((role) => (
                <label
                  key={role.id}
                  className={cn(
                    "group relative flex min-h-36 cursor-pointer flex-col gap-3 rounded-lg border border-border/80 bg-background/70 p-4 shadow-sm transition hover:border-primary/70 hover:bg-primary/5",
                    "has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:shadow-primary/10",
                  )}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-base font-semibold">{role.label}</span>
                      <span className="mt-2 block text-sm leading-6 text-muted-foreground">{role.description}</span>
                    </span>
                    <input
                      type="radio"
                      name="primaryRole"
                      value={role.id}
                      defaultChecked={savedRole === role.id}
                      className="mt-1 h-4 w-4 accent-primary"
                    />
                  </span>
                  <span className="mt-auto flex items-center gap-2 text-xs font-medium text-brand-orange">
                    Starts near {formatPathLabel(role.recommendedPath)}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </label>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-base font-semibold">What are you here to do first?</Label>
                <p className="mt-1 text-sm text-muted-foreground">Pick any that should shape your shortcuts and suggested next steps.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {onboardingUseCaseOptions.map((useCase) => (
                  <label
                    key={useCase.id}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border/80 bg-background px-3 py-2 text-sm transition hover:border-primary/70 has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                  >
                    <input
                      type="checkbox"
                      name="useCases"
                      value={useCase.id}
                      defaultChecked={savedUseCases.has(useCase.id)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span>{useCase.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="space-y-2">
                <Label htmlFor="jurisdiction">Therapist state</Label>
                <Input
                  id="jurisdiction"
                  name="jurisdiction"
                  maxLength={2}
                  placeholder="OH"
                  defaultValue={savedJurisdiction}
                  aria-describedby="jurisdiction-help"
                />
                <p id="jurisdiction-help" className="text-xs leading-5 text-muted-foreground">
                  Optional. Used to guide license verification status; it does not verify a role by itself.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" size="lg" className="bg-primary hover:bg-brand-orange-glow">
                Save and continue
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/account">Skip for now</Link>
              </Button>
            </div>
          </form>
        </AppSurface>

        <aside className="space-y-4">
          <AppSurface
            title="Your setup map"
            description="This is intentionally lightweight: no clinical content, no role verification, and no subscription decision required."
            contentClassName="gap-3"
          >
            <SetupStep icon={<Gamepad2 className="h-4 w-4" aria-hidden="true" />} title="Pick a path" description="The route behaves more like a game setup screen than a blocking questionnaire." />
            <SetupStep icon={<LayoutDashboard className="h-4 w-4" aria-hidden="true" />} title="Tune shortcuts" description="Answers are stored as app preferences so future dashboards can use them." />
            <SetupStep icon={<BadgeCheck className="h-4 w-4" aria-hidden="true" />} title="Verify later" description="Therapist and student credentials still go through account verification." />
          </AppSurface>

          <AppInset className="p-4">
            <div className="flex items-start gap-3">
              <MapPinned className="mt-1 h-5 w-5 text-brand-orange" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold">Current next stop</h2>
                <p className="mt-1 text-sm text-muted-foreground">{formatPathLabel(recommendedPath)} based on the saved role.</p>
              </div>
            </div>
          </AppInset>
        </aside>
      </section>
    </AppPageShell>
  )
}

function SetupStep({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex gap-3 rounded-md border border-border/80 bg-background/70 p-3">
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-brand-orange">
        {icon}
      </span>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function formatPathLabel(path: string) {
  if (path.startsWith("/account")) return "account setup"
  if (path.startsWith("/education/flashcards")) return "flashcards"
  if (path.startsWith("/education")) return "education"
  if (path.startsWith("/anatomime")) return "Anatomime"
  if (path.startsWith("/calendar")) return "calendar"
  return "MassageLab"
}
