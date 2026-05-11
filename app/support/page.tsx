import Link from "next/link"
import { Mail, Map, ShieldCheck } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"
import { SupportContactForm } from "@/app/support/support-contact-form"

async function getSupportDefaults() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return {
      name: "",
      contact: "",
    }
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { displayName: true, therapistName: true },
  }).catch(() => null)

  return {
    name: profile?.displayName || profile?.therapistName || session.user.name || "",
    contact: session.user.email || "",
  }
}

export default async function SupportPage() {
  const defaults = await getSupportDefaults()

  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="space-y-5">
          <PageHeading>User Support</PageHeading>
          <Card className="border-neutral-800 bg-card/90 backdrop-blur">
            <CardHeader>
              <div className="mb-2 flex items-center gap-2">
                <Mail className="h-5 w-5 text-brand-orange" />
                <CardTitle>Get help with MassageLab</CardTitle>
              </div>
              <CardDescription>
                Send a support request to contactmassagelab@gmail.com. Please avoid sending client PHI or sensitive clinical details.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        <SupportContactForm initialName={defaults.name} initialContact={defaults.contact} />

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/roadmap">
            <Card className="h-full border-neutral-800 bg-card/90 backdrop-blur transition-colors hover:bg-accent">
              <CardHeader>
                <div className="mb-2 flex items-center gap-2">
                  <Map className="h-5 w-5 text-brand-orange" />
                  <CardTitle>Roadmap</CardTitle>
                </div>
                <CardDescription>See planned product work, compliance milestones, and funding-dependent features.</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Card className="border-brand-orange/40 bg-primary/10 backdrop-blur">
            <CardHeader>
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-brand-orange" />
                <CardTitle>Privacy note</CardTitle>
              </div>
              <CardDescription>
                Support messages are sent through your email client. MassageLab does not upload this form content from the browser.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  )
}
