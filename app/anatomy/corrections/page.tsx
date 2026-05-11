import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentSession } from "@/auth"
import { createCorrectionFlagAction } from "@/app/anatomy/corrections/actions"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { Textarea } from "@/components/ui/textarea"

export default async function AnatomyCorrectionsPage() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const [terms, flags] = await Promise.all([
    prisma.anatomyTerm.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, preferredName: true },
      orderBy: { preferredName: "asc" },
      take: 200,
    }),
    prisma.anatomyCorrectionFlag.findMany({
      where: { createdById: session.user.id },
      include: {
        term: {
          select: { preferredName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ])

  return (
    <CorrectionShell>
      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>Flag anatomy content</CardTitle>
          <CardDescription>
            Report incorrect or unclear anatomy content. Users can flag issues, but only editors/admins can change published content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCorrectionFlagAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="term_id">Term</Label>
              <select id="term_id" name="term_id" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">General anatomy content issue</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.preferredName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue_type">Issue type</Label>
              <select id="issue_type" name="issue_type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="content">Content</option>
                <option value="definition">Definition</option>
                <option value="relationship">Relationship</option>
                <option value="source">Source</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Issue</Label>
              <Textarea id="message" name="message" rows={4} required />
            </div>
            <Button type="submit" className="bg-primary hover:bg-brand-orange-glow">
              Submit flag
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>Your flags</CardTitle>
          <CardDescription>Track the correction flags you have submitted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">You have not submitted any correction flags yet.</p>
          ) : (
            flags.map((flag) => (
              <div key={flag.id} className="rounded-md border border-neutral-800 bg-background/70 p-4">
                <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-medium">{flag.term?.preferredName ?? "General content issue"}</p>
                  <span className="text-sm text-brand-orange">{flag.status}</span>
                </div>
                <p className="text-sm text-muted-foreground">{flag.issueType}: {flag.message}</p>
                {flag.resolutionNote && <p className="mt-2 text-sm text-muted-foreground">Resolution: {flag.resolutionNote}</p>}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link href="/account">Back to account</Link>
      </Button>
    </CorrectionShell>
  )
}

function CorrectionShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeading>Anatomy Corrections</PageHeading>
        {children}
      </div>
    </div>
  )
}
