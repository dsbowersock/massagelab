import Link from "next/link"
import { HeartHandshake, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"

const fundingNeeds = [
  "HIPAA-capable hosting",
  "Safe cross-device sync for clinical records",
  "Client portal for shared notes and self-reporting",
  "Pain, sensation, and incident journals",
  "Range-of-motion and movement tools using phone sensors",
  "Local-first SOAP notes, intake, export, and import tools",
  "Student and massage license verification automation",
]

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeading>Support MassageLab</PageHeading>

        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeartHandshake className="h-5 w-5 text-[#ff7043]" />
              Fund the clinical sync roadmap
            </CardTitle>
            <CardDescription>
              MassageLab can already keep clinical tools local-first. Hosted clinical sync needs compliant infrastructure and operational work before it can responsibly handle therapist or client records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              {fundingNeeds.map((need) => (
                <div key={need} className="rounded-md border border-neutral-800 bg-background/70 p-3 text-sm">
                  {need}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-[#ff7043] hover:bg-[#f4511e]">
                <Link href="/login">Create an account</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Use local-first tools</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/support#donate-placeholder">Donate now</Link>
              </Button>
            </div>
            <p id="donate-placeholder" className="text-xs text-muted-foreground">
              Stripe donation checkout is coming soon.
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#ff7043]/40 bg-[#ff7043]/10 backdrop-blur">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <ShieldCheck className="mt-1 h-5 w-5 text-[#ff7043]" />
            <div>
              <CardTitle>Current boundary</CardTitle>
              <CardDescription>
                Memberships and donations can support the roadmap, but they do not enable hosted clinical storage yet. Notes, journals, intake forms, and movement data remain local-first until the compliance gate is complete.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
