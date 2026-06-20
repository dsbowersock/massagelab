import Link from "next/link"
import { Radio } from "lucide-react"
import { AtmosphereBreathingGuide } from "@/components/atmosphere/breathing-guide"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"

export default function WellnessBreathingPage() {
  return (
    <AppPageShell width="wide" contentClassName="gap-5 pb-28">
      <section className="flex flex-col gap-3">
        <p className="text-sm uppercase tracking-normal text-primary">Wellness</p>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
              Breathing guide
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Use a simple visual pacer to settle the room before, during, or after a session.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/wellness">Wellness hub</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/music">Music stations</Link>
              </Button>
            </div>
          </div>
          <AppSurface
            title="Music link"
            description="Start a music station, then keep audio running while you use this breathing tool."
            icon={<Radio className="h-5 w-5" aria-hidden="true" />}
            badge="Audio compatible"
          />
        </div>
      </section>

      <AtmosphereBreathingGuide />
    </AppPageShell>
  )
}
