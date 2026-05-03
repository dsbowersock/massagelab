import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentSession } from "@/auth"
import { canManageAnatomyContent } from "@/lib/account-permissions"
import type { AccountRole } from "@/lib/domain-types"
import { prisma } from "@/lib/prisma"
import {
  createAnatomyAliasAction,
  createAnatomyRelationshipAction,
  createAnatomySourceAction,
  createAnatomyTermAction,
  updateAnatomyTermAction,
  updateCorrectionFlagAction,
} from "@/app/admin/anatomy/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"
import { Textarea } from "@/components/ui/textarea"

type AnatomyTermRow = {
  id: string
  slug: string
  kind: string
  preferredName: string
  summary: string | null
  regions: string[]
  bodySystems: string[]
  difficulty: string
  status: string
}

const TERM_KINDS = ["SYSTEM", "ORGAN", "TISSUE", "BONE", "MUSCLE", "JOINT", "NERVE", "VESSEL", "LIGAMENT", "TENDON", "CELL", "OTHER"]
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"]
const STATUSES = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]
const FLAG_STATUSES = ["OPEN", "RESOLVED", "REJECTED"]

export default async function AnatomyAdminPage() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const roles = await prisma.userRole.findMany({
    where: { userId: session.user.id },
    select: { role: true },
  })
  const roleValues = (roles as Array<{ role: AccountRole }>).map((roleRow) => roleRow.role)

  if (!canManageAnatomyContent(roleValues)) {
    redirect("/account")
  }

  const [terms, flags] = await Promise.all([
    prisma.anatomyTerm.findMany({
      select: {
        id: true,
        slug: true,
        kind: true,
        preferredName: true,
        summary: true,
        regions: true,
        bodySystems: true,
        difficulty: true,
        status: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.anatomyCorrectionFlag.findMany({
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
    <AdminShell>
      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>Create anatomy term</CardTitle>
          <CardDescription>
            Published terms can be read by public tools. Draft and review terms stay visible to editors/admins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createAnatomyTermAction} className="grid gap-4 md:grid-cols-2">
            <TextField id="preferred_name" label="Preferred name" required />
            <TextField id="slug" label="Slug" placeholder="auto-generated if blank" />
            <SelectField id="kind" label="Kind" values={TERM_KINDS} />
            <SelectField id="difficulty" label="Difficulty" values={DIFFICULTIES} defaultValue="MEDIUM" />
            <SelectField id="status" label="Status" values={STATUSES} defaultValue="DRAFT" />
            <TextField id="body_systems" label="Body systems" placeholder="skeletal, muscular" />
            <TextField id="regions" label="Regions" placeholder="upper-extremity, thorax" />
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="summary">Summary</Label>
              <Textarea id="summary" name="summary" rows={3} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" className="bg-[#ff7043] hover:bg-[#f4511e]">
                Create term
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>Recent terms</CardTitle>
          <CardDescription>Edit status, difficulty, regions, systems, and summaries for recent terms.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {terms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No database terms found yet. Run `npm run anatomy:seed` to import the local library.</p>
          ) : (
            terms.map((term) => (
              <form key={term.id} action={updateAnatomyTermAction} className="rounded-md border border-neutral-800 bg-background/70 p-4">
                <input type="hidden" name="id" value={term.id} />
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField id={`name-${term.id}`} name="preferred_name" label={term.slug} defaultValue={term.preferredName} />
                  <SelectField id={`difficulty-${term.id}`} name="difficulty" label="Difficulty" values={DIFFICULTIES} defaultValue={term.difficulty} />
                  <SelectField id={`status-${term.id}`} name="status" label="Status" values={STATUSES} defaultValue={term.status} />
                  <TextField id={`systems-${term.id}`} name="body_systems" label="Body systems" defaultValue={term.bodySystems.join(", ")} />
                  <TextField id={`regions-${term.id}`} name="regions" label="Regions" defaultValue={term.regions.join(", ")} />
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`summary-${term.id}`}>Summary</Label>
                    <Textarea id={`summary-${term.id}`} name="summary" defaultValue={term.summary ?? ""} rows={2} />
                  </div>
                </div>
                <Button type="submit" variant="outline" className="mt-4">
                  Save term
                </Button>
              </form>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>Aliases, relationships, and sources</CardTitle>
          <CardDescription>Use stable relationships now so future flashcards, SOAP helpers, and games can share the same content graph.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <form action={createAnatomyAliasAction} className="space-y-3 rounded-md border border-neutral-800 bg-background/70 p-4">
            <h3 className="font-semibold">Add alias</h3>
            <TermSelect terms={terms} id="term_id" label="Term" />
            <TextField id="alias" label="Alias" required />
            <Button type="submit" variant="outline">Add alias</Button>
          </form>

          <form action={createAnatomyRelationshipAction} className="space-y-3 rounded-md border border-neutral-800 bg-background/70 p-4">
            <h3 className="font-semibold">Add relationship</h3>
            <TermSelect terms={terms} id="source_term_id" label="Source term" />
            <TextField id="relationship_type" label="Type" placeholder="part-of, innervates, attaches-to" required />
            <TermSelect terms={terms} id="target_term_id" label="Target term" />
            <Button type="submit" variant="outline">Add relationship</Button>
          </form>

          <form action={createAnatomySourceAction} className="space-y-3 rounded-md border border-neutral-800 bg-background/70 p-4">
            <h3 className="font-semibold">Add source</h3>
            <TextField id="label" label="Label" required />
            <TextField id="slug" label="Slug" />
            <TextField id="url" label="URL" />
            <TextField id="license" label="License" />
            <TextField id="attribution" label="Attribution" required />
            <Button type="submit" variant="outline">Add source</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>Correction flags</CardTitle>
          <CardDescription>Users can flag issues; editors/admins decide whether to resolve or reject them.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No correction flags yet.</p>
          ) : (
            flags.map((flag) => (
              <form key={flag.id} action={updateCorrectionFlagAction} className="rounded-md border border-neutral-800 bg-background/70 p-4">
                <input type="hidden" name="id" value={flag.id} />
                <div className="mb-3">
                  <p className="text-sm font-medium">{flag.term?.preferredName ?? "General content issue"}</p>
                  <p className="text-sm text-muted-foreground">{flag.issueType}: {flag.message}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-end">
                  <SelectField id={`flag-status-${flag.id}`} name="status" label="Status" values={FLAG_STATUSES} defaultValue={flag.status} />
                  <TextField id={`flag-note-${flag.id}`} name="resolution_note" label="Resolution note" defaultValue={flag.resolutionNote ?? ""} />
                  <Button type="submit" variant="outline">Update</Button>
                </div>
              </form>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>Seed import</CardTitle>
          <CardDescription>
            Run `npm run anatomy:seed` after Prisma migrations to import the local bones/muscles fallback.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/anatomime">Open Anatomime</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/account">Back to account</Link>
          </Button>
        </CardContent>
      </Card>
    </AdminShell>
  )
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeading>Anatomy Admin</PageHeading>
        {children}
      </div>
    </div>
  )
}

function TextField({
  id,
  name,
  label,
  defaultValue,
  placeholder,
  required,
}: {
  id: string
  name?: string
  label: string
  defaultValue?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name ?? id} defaultValue={defaultValue} placeholder={placeholder} required={required} />
    </div>
  )
}

function SelectField({
  id,
  name,
  label,
  values,
  defaultValue,
}: {
  id: string
  name?: string
  label: string
  values: string[]
  defaultValue?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name ?? id}
        defaultValue={defaultValue ?? values[0]}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {values.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </div>
  )
}

function TermSelect({ terms, id, label }: { terms: AnatomyTermRow[]; id: string; label: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} name={id} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
        {terms.map((term) => (
          <option key={term.id} value={term.id}>
            {term.preferredName}
          </option>
        ))}
      </select>
    </div>
  )
}
