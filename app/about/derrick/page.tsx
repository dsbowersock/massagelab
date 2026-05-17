import Link from "next/link"
import { Hammer, ShieldCheck, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"

export default function AboutDerrickPage() {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="space-y-5">
          <PageHeading>About Derrick</PageHeading>
          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <div className="mb-2 flex items-center gap-2">
                <UserRound className="h-5 w-5 text-brand-orange" aria-hidden="true" />
                <CardTitle>Derrick Bowersock</CardTitle>
              </div>
              <CardDescription>
                Derrick Bowersock is building MassageLab as an active private-alpha project for massage tools, education workflows, and future practice support. This page is intentionally brief until fuller public bio copy is ready.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild className="bg-primary hover:bg-brand-orange-glow">
                <Link href="/about">About MassageLab</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/support">Contact support</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <Hammer className="mb-2 h-5 w-5 text-brand-orange" aria-hidden="true" />
              <CardTitle>Current focus</CardTitle>
              <CardDescription>
                The immediate work is alpha stability, account clarity, pricing transparency, local-first privacy boundaries, and safer paths toward future hosted clinical infrastructure.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-brand-orange/40 bg-primary/10 backdrop-blur">
            <CardHeader>
              <ShieldCheck className="mb-2 h-5 w-5 text-brand-orange" aria-hidden="true" />
              <CardTitle>Credential note</CardTitle>
              <CardDescription>
                MassageLab should only publish professional credentials, licensure details, or practice claims after Derrick provides the exact wording to use.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  )
}
