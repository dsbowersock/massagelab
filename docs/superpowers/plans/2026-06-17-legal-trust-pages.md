# Legal Trust Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish MassageLab's current-state legal/trust pages and require versioned acceptance at registration, membership checkout, and professional/practice activation.

**Architecture:** Store legal document metadata and page content in a small shared registry, render `/legal` and `/legal/[slug]` from that registry, and persist acceptance records in a dedicated Prisma model. Enforcement stays server-side for registration, Stripe checkout, and credential/professional activation; UI checkboxes only collect explicit user acknowledgement.

**Tech Stack:** Next.js App Router, React/TypeScript client forms, Prisma/Postgres, node:test, existing `AppPageShell`/`AppSurface` UI primitives, existing account/billing server actions and API routes.

---

## File Structure

- Create `lib/legal-documents.js`: document registry with keys, slugs, labels, effective date, version, required acceptance groups, and current-state page sections.
- Create `lib/legal-acceptance.js`: server-safe helpers for document lookup, request metadata capture, idempotent acceptance writes, and acceptance validation.
- Create `app/legal/page.tsx`: public legal index page.
- Create `app/legal/[slug]/page.tsx`: public legal document renderer.
- Modify `prisma/schema.prisma`: add `LegalAcceptance` model and `User.legalAcceptances` relation.
- Create `prisma/migrations/20260617120000_legal_acceptances/migration.sql`: create table, indexes, unique guard, and foreign key.
- Modify `app/register/page.tsx`: add required Terms and Privacy checkboxes and send accepted document ids to registration API.
- Modify `app/api/account/register/route.ts`: validate and persist Terms and Privacy acceptance during registration.
- Modify `components/membership/pricing-cards.tsx`: add required Membership/Billing/Refund checkbox to checkout forms.
- Modify `app/api/billing/checkout/route.ts`: validate and persist billing terms acceptance before Stripe checkout creation.
- Modify `app/account/page.tsx`: add required Therapist Agreement checkbox to credential verification form.
- Modify `app/account/actions.ts`: validate and persist Therapist Agreement acceptance before credential/professional request creation.
- Modify `lib/navigation.js`: expose a legal/trust route without adding all legal pages to primary sidebar.
- Add tests in `tests/legal-documents.test.mjs` and `tests/legal-acceptance.test.mjs`.
- Extend focused existing tests only when a pure helper can cover the changed behavior without mocking Next internals.

## Task 1: Create The Legal Document Registry

**Files:**
- Create: `lib/legal-documents.js`
- Test: `tests/legal-documents.test.mjs`

- [ ] **Step 1: Write the registry tests**

Create `tests/legal-documents.test.mjs`:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LEGAL_DOCUMENT_KEYS,
  LEGAL_DOCUMENT_VERSION,
  getLegalDocumentByKey,
  getLegalDocumentBySlug,
  legalDocumentAcceptanceId,
  requiredLegalDocumentsForEvent,
} from "../lib/legal-documents.js"

describe("legal document registry", () => {
  it("defines the Branch 1 legal documents with one version source", () => {
    assert.equal(LEGAL_DOCUMENT_VERSION, "2026-06-legal-v1")
    assert.deepEqual(LEGAL_DOCUMENT_KEYS, [
      "terms",
      "privacy",
      "membership-billing-refunds",
      "therapist-agreement",
      "cookies",
      "local-first-health-wellness-data",
    ])
  })

  it("resolves legal documents by key and slug", () => {
    const terms = getLegalDocumentByKey("terms")
    const privacy = getLegalDocumentBySlug("privacy")

    assert.equal(terms.label, "Terms of Service")
    assert.equal(terms.route, "/legal/terms")
    assert.equal(privacy.key, "privacy")
    assert.equal(privacy.version, LEGAL_DOCUMENT_VERSION)
    assert.equal(legalDocumentAcceptanceId(terms), "terms:2026-06-legal-v1")
  })

  it("maps acceptance events to the required current documents", () => {
    assert.deepEqual(
      requiredLegalDocumentsForEvent("registration").map((document) => document.key),
      ["terms", "privacy"],
    )
    assert.deepEqual(
      requiredLegalDocumentsForEvent("checkout").map((document) => document.key),
      ["membership-billing-refunds"],
    )
    assert.deepEqual(
      requiredLegalDocumentsForEvent("professional-activation").map((document) => document.key),
      ["therapist-agreement"],
    )
  })
})
```

- [ ] **Step 2: Run the registry test and verify it fails**

Run: `npm run test -- tests/legal-documents.test.mjs`

Expected: FAIL because `lib/legal-documents.js` does not exist.

- [ ] **Step 3: Implement the registry**

Create `lib/legal-documents.js` with this shape:

```js
// @ts-check

export const LEGAL_DOCUMENT_VERSION = "2026-06-legal-v1"
export const LEGAL_EFFECTIVE_DATE = "June 17, 2026"
export const LEGAL_BUSINESS_IDENTITY = "Massage Lab, operated by Derrick Bowersock"

export const LEGAL_DOCUMENT_KEYS = Object.freeze([
  "terms",
  "privacy",
  "membership-billing-refunds",
  "therapist-agreement",
  "cookies",
  "local-first-health-wellness-data",
])

const legalDocuments = [
  {
    key: "terms",
    slug: "terms",
    label: "Terms of Service",
    shortLabel: "Terms",
    route: "/legal/terms",
    version: LEGAL_DOCUMENT_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    summary: "Rules for adult account use, acceptable use, professional responsibility, and MassageLab's current service boundaries.",
    sections: [
      {
        title: "Who operates MassageLab",
        body: [
          `${LEGAL_BUSINESS_IDENTITY}, provides MassageLab as a private-alpha software platform for education, timing, scheduling, memberships, wellness self-tracking, and local-first professional documentation tools.`,
          "MassageLab is not a medical provider, emergency service, insurer, legal advisor, compliance advisor, or substitute for professional judgment.",
        ],
      },
      {
        title: "Adult accounts only",
        body: [
          "MassageLab accounts are intended for adults who are at least 18 years old.",
          "Therapists and practices are responsible for any consent, guardian involvement, and documentation rules that apply when they work with minor clients outside the MassageLab account system.",
        ],
      },
      {
        title: "Professional responsibility",
        body: [
          "Massage therapists, practice owners, and practice staff remain responsible for licensure, scope of practice, client consent, documentation, privacy obligations, recordkeeping, fees, cancellation rules, and professional judgment.",
          "MassageLab may provide forms, templates, scheduling tools, education tools, and local-first documentation surfaces, but MassageLab does not guarantee that any workflow satisfies a legal, licensing, insurance, tax, employment, or professional-board requirement.",
        ],
      },
      {
        title: "Acceptable use",
        body: [
          "Users must not use MassageLab unlawfully, misrepresent credentials, access information they are not authorized to access, disrupt security controls, submit harmful or misleading content, or use the service for emergency needs.",
          "MassageLab may suspend or restrict access when necessary to protect the service, users, privacy, billing integrity, or legal obligations.",
        ],
      },
      {
        title: "Current dispute posture",
        body: [
          "These terms are written for Ohio as the current governing-law context. Detailed dispute, venue, arbitration, or class-action language should be finalized by a licensed attorney before broader public reliance.",
        ],
      },
    ],
  },
  {
    key: "privacy",
    slug: "privacy",
    label: "Privacy Policy",
    shortLabel: "Privacy",
    route: "/legal/privacy",
    version: LEGAL_DOCUMENT_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    summary: "How MassageLab handles account, membership, booking, wellness, support, diagnostics, and local-first professional-record boundaries.",
    sections: [
      {
        title: "Information MassageLab handles",
        body: [
          "MassageLab may handle account, authentication, role, profile, membership, billing metadata, calendar, booking, support, diagnostics, app preference, education progress, and client-owned wellness self-tracking information.",
          "Stripe handles payment processing. MassageLab does not intentionally store full payment card numbers.",
        ],
      },
      {
        title: "Local-first professional records",
        body: [
          "SOAP, intake, journal, therapist ROM, and related therapist professional-record content stay in the user's encrypted browser vault in this alpha unless future hosted clinical storage passes documented compliance gates.",
          "The local vault passphrase is not sent to MassageLab. Encrypted local storage and exports do not replace device security, backups, staff policies, or professional recordkeeping obligations.",
        ],
      },
      {
        title: "Client-owned wellness self-tracking",
        body: [
          "Signed-in wellness entries are client-owned self-tracking records. They are separate from therapist professional records and are not diagnosis, emergency monitoring, medical advice, or automatic therapist-facing data.",
          "Anonymous wellness practice flows run in browser memory only unless the user signs in and saves entries.",
        ],
      },
      {
        title: "Diagnostics and support",
        body: [
          "MassageLab uses privacy-scrubbed diagnostics to improve reliability. Diagnostic and support paths should not include client PHI, clinical notes, or sensitive professional-record content.",
          "Support requests should avoid client-identifying health information or sensitive clinical details.",
        ],
      },
      {
        title: "User choices",
        body: [
          "Users may use direct export tools where available, such as wellness exports and local vault exports. Broader account export and account deletion request workflows are planned separately.",
          "Some records may need to be retained when legally, professionally, operationally, security, payment, dispute, or audit needs require it.",
        ],
      },
    ],
  },
  {
    key: "membership-billing-refunds",
    slug: "membership-billing-refunds",
    label: "Membership, Billing, and Refund Terms",
    shortLabel: "Billing Terms",
    route: "/legal/membership-billing-refunds",
    version: LEGAL_DOCUMENT_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    summary: "Stripe-backed membership billing, cancellation, and the 31-calendar-day renewal refund rule.",
    sections: [
      {
        title: "Memberships",
        body: [
          "MassageLab currently uses Free, Student, Supporter, Therapist, and Practice membership language. Supporter, Therapist, and Practice are Stripe-backed paid memberships.",
          "Memberships fund current paid features and future careful work, but they do not currently unlock hosted transcription, cloud SOAP drafting, HIPAA-ready sync, or server-side PHI storage.",
        ],
      },
      {
        title: "Billing",
        body: [
          "Paid memberships may be billed monthly or yearly through Stripe. There are no free trials in the current membership posture.",
          "Users manage active subscriptions, payment methods, invoices, and cancellation through Stripe-hosted billing flows where available.",
        ],
      },
      {
        title: "Refunds",
        body: [
          "A user may request a full refund if they cancel within 31 calendar days of any membership renewal payment.",
          "Refund requests should be sent to MassageLab support. Stripe processing, fraud, abuse, chargeback, or legal constraints may affect handling.",
        ],
      },
      {
        title: "Provider payments",
        body: [
          "Provider/client payment collection through MassageLab is future/planned. Separate payment terms will be needed before that feature is enabled.",
        ],
      },
    ],
  },
  {
    key: "therapist-agreement",
    slug: "therapist-agreement",
    label: "Therapist Agreement",
    shortLabel: "Therapist Agreement",
    route: "/legal/therapist-agreement",
    version: LEGAL_DOCUMENT_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    summary: "Professional/practice user responsibilities for licensure, scope, client consent, privacy, documentation, and practice access.",
    sections: [
      {
        title: "Who must accept this agreement",
        body: [
          "This agreement applies to users acting in a professional or practice capacity, including licensed therapists, practice owners, practice therapists, and practice staff.",
        ],
      },
      {
        title: "Professional responsibility",
        body: [
          "Professional users are responsible for licensure, certification, scope of practice, professional judgment, client consent, documentation accuracy, privacy obligations, staff access, fees, cancellations, and records they create or maintain.",
          "MassageLab does not verify professional competence and does not guarantee legal authority to practice.",
        ],
      },
      {
        title: "Documentation responsibility",
        body: [
          "MassageLab local-first documentation tools may help organize forms, SOAP notes, journals, ROM sessions, body maps, and related materials.",
          "Professional users remain responsible for reviewing, correcting, exporting, protecting, and retaining records as required by their own legal, professional, and practice obligations.",
        ],
      },
      {
        title: "Client consent and privacy",
        body: [
          "Professional users are responsible for obtaining appropriate client consent before collecting, storing, recording, transcribing, or using client information.",
          "Professional users must not put client PHI or sensitive clinical details into account preferences, support requests, diagnostics, calendar reminders, or other non-clinical app fields.",
        ],
      },
    ],
  },
  {
    key: "cookies",
    slug: "cookies",
    label: "Functional Cookie Notice",
    shortLabel: "Cookies",
    route: "/legal/cookies",
    version: LEGAL_DOCUMENT_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    summary: "MassageLab's functional-only cookie and similar browser storage posture.",
    sections: [
      {
        title: "Functional-only posture",
        body: [
          "MassageLab uses cookies or similar browser storage only where needed for login, session security, preferences, fraud or abuse prevention, and core app functionality.",
          "MassageLab does not use advertising cookies, ad targeting, marketing retargeting, or ad personalization.",
        ],
      },
      {
        title: "Future analytics",
        body: [
          "If analytics are added later, they should be privacy-preserving and disclosed before use.",
        ],
      },
    ],
  },
  {
    key: "local-first-health-wellness-data",
    slug: "local-first-health-wellness-data",
    label: "Local-First Health and Wellness Data Notice",
    shortLabel: "Health Data Notice",
    route: "/legal/local-first-health-wellness-data",
    version: LEGAL_DOCUMENT_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    summary: "Plain-language explanation of local-first professional records, client-owned wellness records, and future hosted clinical gates.",
    sections: [
      {
        title: "Three data zones",
        body: [
          "MassageLab separates ordinary account/contact/booking data, client-owned wellness self-tracking, and therapist professional records.",
          "These zones have different privacy expectations and should not be treated as one shared clinical record.",
        ],
      },
      {
        title: "Local-first professional records",
        body: [
          "Therapist-created professional records remain local-first and user-controlled in the encrypted browser vault during this alpha.",
          "Hosted clinical storage and automatic therapist viewing of client wellness data are not active.",
        ],
      },
      {
        title: "Wellness self-tracking",
        body: [
          "Client-owned wellness entries can help users notice patterns, but MassageLab does not diagnose, treat, monitor emergencies, make insurance decisions, or provide medical advice.",
        ],
      },
      {
        title: "Future hosted clinical storage",
        body: [
          "Future hosted clinical storage requires separate legal, security, BAA, audit, access-control, retention, incident-response, and operating-policy review before implementation.",
        ],
      },
    ],
  },
]

export const LEGAL_DOCUMENTS = Object.freeze(legalDocuments.map((document) => Object.freeze({
  ...document,
  sections: Object.freeze(document.sections.map((section) => Object.freeze({
    ...section,
    body: Object.freeze(section.body),
  }))),
})))

const DOCUMENT_BY_KEY = new Map(LEGAL_DOCUMENTS.map((document) => [document.key, document]))
const DOCUMENT_BY_SLUG = new Map(LEGAL_DOCUMENTS.map((document) => [document.slug, document]))

const ACCEPTANCE_EVENTS = Object.freeze({
  registration: Object.freeze(["terms", "privacy"]),
  checkout: Object.freeze(["membership-billing-refunds"]),
  "professional-activation": Object.freeze(["therapist-agreement"]),
})

export function getLegalDocumentByKey(key) {
  const document = DOCUMENT_BY_KEY.get(String(key ?? ""))
  if (!document) throw new Error(`Unknown legal document key: ${key}`)
  return document
}

export function getLegalDocumentBySlug(slug) {
  const document = DOCUMENT_BY_SLUG.get(String(slug ?? ""))
  if (!document) throw new Error(`Unknown legal document slug: ${slug}`)
  return document
}

export function legalDocumentAcceptanceId(document) {
  return `${document.key}:${document.version}`
}

export function requiredLegalDocumentsForEvent(event) {
  const keys = ACCEPTANCE_EVENTS[event]
  if (!keys) throw new Error(`Unknown legal acceptance event: ${event}`)
  return keys.map((key) => getLegalDocumentByKey(key))
}
```

- [ ] **Step 4: Run the registry test and verify it passes**

Run: `npm run test -- tests/legal-documents.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the registry slice**

Run:

```bash
git add lib/legal-documents.js tests/legal-documents.test.mjs
git commit -m "Add legal document registry"
```

## Task 2: Render Legal Pages

**Files:**
- Create: `app/legal/page.tsx`
- Create: `app/legal/[slug]/page.tsx`

- [ ] **Step 1: Add the legal index page**

Create `app/legal/page.tsx`:

```tsx
import Link from "next/link"
import { FileText, ShieldCheck } from "lucide-react"
import { LEGAL_BUSINESS_IDENTITY, LEGAL_DOCUMENTS } from "@/lib/legal-documents"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Legal | MassageLab",
  description: "MassageLab legal and trust documents.",
}

export default function LegalIndexPage() {
  return (
    <AppPageShell width="standard" contentClassName="gap-5">
      <AppSurface
        title="Legal and trust documents"
        description={`${LEGAL_BUSINESS_IDENTITY}. These documents describe MassageLab's current private-alpha boundaries.`}
        icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {LEGAL_DOCUMENTS.map((document) => (
          <AppSurface key={document.key} title={document.label} description={document.summary} icon={<FileText className="h-5 w-5" aria-hidden="true" />}>
            <p className="text-sm text-muted-foreground">Effective {document.effectiveDate}</p>
            <Button asChild variant="outline">
              <Link href={document.route}>Read {document.shortLabel}</Link>
            </Button>
          </AppSurface>
        ))}
      </div>
    </AppPageShell>
  )
}
```

- [ ] **Step 2: Add the dynamic legal document page**

Create `app/legal/[slug]/page.tsx`:

```tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, FileText } from "lucide-react"
import { LEGAL_DOCUMENTS, getLegalDocumentBySlug, legalDocumentAcceptanceId } from "@/lib/legal-documents"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"

export function generateStaticParams() {
  return LEGAL_DOCUMENTS.map((document) => ({ slug: document.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const document = LEGAL_DOCUMENTS.find((candidate) => candidate.slug === slug)
  return {
    title: document ? `${document.label} | MassageLab` : "Legal | MassageLab",
    description: document?.summary ?? "MassageLab legal and trust document.",
  }
}

export default async function LegalDocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let document

  try {
    document = getLegalDocumentBySlug(slug)
  } catch {
    notFound()
  }

  return (
    <AppPageShell width="prose" contentClassName="gap-5">
      <div>
        <Button asChild variant="ghost" className="mb-3">
          <Link href="/legal">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Legal documents
          </Link>
        </Button>
        <AppSurface
          title={document.label}
          description={document.summary}
          icon={<FileText className="h-5 w-5" aria-hidden="true" />}
        >
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p>Effective: {document.effectiveDate}</p>
            <p>Version: {legalDocumentAcceptanceId(document)}</p>
          </div>
        </AppSurface>
      </div>
      {document.sections.map((section) => (
        <AppSurface key={section.title} title={section.title}>
          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </AppSurface>
      ))}
      <AppSurface title="Attorney review">
        <p className="text-sm leading-6 text-muted-foreground">
          These documents are practical starting terms for MassageLab's current product state and should be reviewed by a licensed attorney before broad public reliance.
        </p>
      </AppSurface>
    </AppPageShell>
  )
}
```

- [ ] **Step 3: Run typecheck for the new pages**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 4: Commit the page slice**

Run:

```bash
git add app/legal lib/legal-documents.js
git commit -m "Add legal trust pages"
```

## Task 3: Add Legal Acceptance Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260617120000_legal_acceptances/migration.sql`

- [ ] **Step 1: Add the Prisma relation and model**

Modify `model User` in `prisma/schema.prisma` to include:

```prisma
  legalAcceptances      LegalAcceptance[]
```

Add this model near other account/billing models:

```prisma
model LegalAcceptance {
  id              String   @id @default(cuid())
  userId          String
  documentKey     String
  documentVersion String
  acceptedAt      DateTime @default(now())
  ipAddress       String?
  userAgent       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@unique([userId, documentKey, documentVersion])
  @@index([userId])
  @@index([documentKey, documentVersion])
}
```

- [ ] **Step 2: Add the SQL migration**

Create `prisma/migrations/20260617120000_legal_acceptances/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentKey" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegalAcceptance_userId_documentKey_documentVersion_key" ON "LegalAcceptance"("userId", "documentKey", "documentVersion");

-- CreateIndex
CREATE INDEX "LegalAcceptance_userId_idx" ON "LegalAcceptance"("userId");

-- CreateIndex
CREATE INDEX "LegalAcceptance_documentKey_documentVersion_idx" ON "LegalAcceptance"("documentKey", "documentVersion");

-- AddForeignKey
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Validate Prisma**

Run: `npm run prisma:validate`

Expected: PASS.

- [ ] **Step 4: Generate Prisma client**

Run: `npm run prisma:generate`

Expected: PASS.

- [ ] **Step 5: Commit the schema slice**

Run:

```bash
git add prisma/schema.prisma prisma/migrations/20260617120000_legal_acceptances/migration.sql
git commit -m "Add legal acceptance persistence"
```

## Task 4: Implement Legal Acceptance Helpers

**Files:**
- Create: `lib/legal-acceptance.js`
- Test: `tests/legal-acceptance.test.mjs`

- [ ] **Step 1: Write helper tests**

Create `tests/legal-acceptance.test.mjs`:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  acceptedDocumentIdsFromInput,
  hasAcceptedCurrentDocuments,
  legalRequestMetadata,
  recordLegalAcceptances,
} from "../lib/legal-acceptance.js"
import { requiredLegalDocumentsForEvent } from "../lib/legal-documents.js"

function createMockDb(existingRows = []) {
  const rows = [...existingRows]
  return {
    rows,
    legalAcceptance: {
      findMany: async ({ where }) => rows.filter((row) => (
        row.userId === where.userId &&
        where.OR.some((candidate) => (
          row.documentKey === candidate.documentKey &&
          row.documentVersion === candidate.documentVersion
        ))
      )),
      upsert: async ({ where, create }) => {
        const key = where.userId_documentKey_documentVersion
        let row = rows.find((candidate) => (
          candidate.userId === key.userId &&
          candidate.documentKey === key.documentKey &&
          candidate.documentVersion === key.documentVersion
        ))
        if (!row) {
          row = { ...create, id: `acceptance_${rows.length + 1}` }
          rows.push(row)
        }
        return row
      },
    },
  }
}

describe("legal acceptance helpers", () => {
  it("normalizes accepted document ids from arrays, sets, and records", () => {
    assert.deepEqual(
      acceptedDocumentIdsFromInput(["terms:2026-06-legal-v1", "", "privacy:2026-06-legal-v1"]),
      new Set(["terms:2026-06-legal-v1", "privacy:2026-06-legal-v1"]),
    )
    assert.deepEqual(
      acceptedDocumentIdsFromInput({ "terms:2026-06-legal-v1": true, "privacy:2026-06-legal-v1": false }),
      new Set(["terms:2026-06-legal-v1"]),
    )
  })

  it("records acceptances idempotently with request metadata", async () => {
    const db = createMockDb()
    const documents = requiredLegalDocumentsForEvent("registration")
    const metadata = { ipAddress: "203.0.113.10", userAgent: "node-test" }

    await recordLegalAcceptances({ prismaClient: db, userId: "user_1", documents, metadata })
    await recordLegalAcceptances({ prismaClient: db, userId: "user_1", documents, metadata })

    assert.equal(db.rows.length, 2)
    assert.deepEqual(db.rows.map((row) => row.documentKey).sort(), ["privacy", "terms"])
    assert.equal(db.rows[0].ipAddress, "203.0.113.10")
    assert.equal(db.rows[0].userAgent, "node-test")
  })

  it("checks current document acceptance coverage", async () => {
    const documents = requiredLegalDocumentsForEvent("checkout")
    const db = createMockDb([{ userId: "user_1", documentKey: "membership-billing-refunds", documentVersion: "2026-06-legal-v1" }])

    assert.equal(await hasAcceptedCurrentDocuments({ prismaClient: db, userId: "user_1", documents }), true)
    assert.equal(await hasAcceptedCurrentDocuments({ prismaClient: db, userId: "user_2", documents }), false)
  })

  it("extracts request metadata without query strings or bodies", () => {
    const request = new Request("https://example.test/register", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 198.51.100.7",
        "user-agent": "legal-test",
      },
    })

    assert.deepEqual(legalRequestMetadata(request), {
      ipAddress: "203.0.113.10",
      userAgent: "legal-test",
    })
  })
})
```

- [ ] **Step 2: Run the helper test and verify it fails**

Run: `npm run test -- tests/legal-acceptance.test.mjs`

Expected: FAIL because `lib/legal-acceptance.js` does not exist.

- [ ] **Step 3: Implement the helper**

Create `lib/legal-acceptance.js`:

```js
// @ts-check

import { legalDocumentAcceptanceId } from "./legal-documents.js"

export function acceptedDocumentIdsFromInput(input) {
  const ids = new Set()

  if (Array.isArray(input) || input instanceof Set) {
    for (const value of input) addAcceptedId(ids, value)
    return ids
  }

  if (input && typeof input === "object") {
    for (const [key, value] of Object.entries(input)) {
      if (value === true) addAcceptedId(ids, key)
    }
  }

  return ids
}

function addAcceptedId(ids, value) {
  if (typeof value === "string" && value.trim()) ids.add(value.trim())
}

export function missingRequiredLegalDocuments({ acceptedDocumentIds, documents }) {
  const accepted = acceptedDocumentIdsFromInput(acceptedDocumentIds)
  return documents.filter((document) => !accepted.has(legalDocumentAcceptanceId(document)))
}

export function legalRequestMetadata(request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return {
    ipAddress: forwardedFor || request.headers.get("x-real-ip") || null,
    userAgent: request.headers.get("user-agent") || null,
  }
}

export async function recordLegalAcceptances({ prismaClient, userId, documents, metadata = {} }) {
  const acceptedAt = new Date()
  const rows = []

  for (const document of documents) {
    rows.push(await prismaClient.legalAcceptance.upsert({
      where: {
        userId_documentKey_documentVersion: {
          userId,
          documentKey: document.key,
          documentVersion: document.version,
        },
      },
      create: {
        userId,
        documentKey: document.key,
        documentVersion: document.version,
        acceptedAt,
        ipAddress: metadata.ipAddress ?? null,
        userAgent: metadata.userAgent ?? null,
      },
      update: {},
    }))
  }

  return rows
}

export async function hasAcceptedCurrentDocuments({ prismaClient, userId, documents }) {
  const existing = await prismaClient.legalAcceptance.findMany({
    where: {
      userId,
      OR: documents.map((document) => ({
        documentKey: document.key,
        documentVersion: document.version,
      })),
    },
    select: {
      documentKey: true,
      documentVersion: true,
    },
  })
  const accepted = new Set(existing.map((row) => `${row.documentKey}:${row.documentVersion}`))

  return documents.every((document) => accepted.has(legalDocumentAcceptanceId(document)))
}
```

- [ ] **Step 4: Run helper and registry tests**

Run: `npm run test -- tests/legal-documents.test.mjs tests/legal-acceptance.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the helper slice**

Run:

```bash
git add lib/legal-acceptance.js tests/legal-acceptance.test.mjs
git commit -m "Add legal acceptance helpers"
```

## Task 5: Enforce Terms And Privacy Acceptance At Registration

**Files:**
- Modify: `app/register/page.tsx`
- Modify: `app/api/account/register/route.ts`
- Optional test update: add route-helper tests only if route logic is extracted into a pure helper.

- [ ] **Step 1: Update the registration UI**

In `app/register/page.tsx`, import legal helpers:

```tsx
import { legalDocumentAcceptanceId, requiredLegalDocumentsForEvent } from "@/lib/legal-documents"
```

Inside `RegisterPage`, define:

```tsx
  const registrationDocuments = requiredLegalDocumentsForEvent("registration")
  const [acceptedLegalDocuments, setAcceptedLegalDocuments] = useState<string[]>([])
```

Add this helper inside the component:

```tsx
  function toggleLegalDocument(documentId: string, checked: boolean) {
    setAcceptedLegalDocuments((current) => (
      checked
        ? Array.from(new Set([...current, documentId]))
        : current.filter((candidate) => candidate !== documentId)
    ))
  }
```

Send the accepted ids in the registration request:

```tsx
body: JSON.stringify({ name, email, password, acceptedLegalDocuments }),
```

Add required checkbox controls before the submit button:

```tsx
{registrationDocuments.map((document) => {
  const documentId = legalDocumentAcceptanceId(document)
  return (
    <label key={document.key} className="flex gap-3 rounded-md border border-border/80 bg-background/70 p-3 text-sm">
      <input
        type="checkbox"
        className="mt-1"
        checked={acceptedLegalDocuments.includes(documentId)}
        onChange={(event) => toggleLegalDocument(documentId, event.target.checked)}
        required
      />
      <span>
        I agree to the{" "}
        <Link href={document.route} className="text-brand-orange underline-offset-4 hover:underline">
          {document.label}
        </Link>
        .
      </span>
    </label>
  )
})}
```

- [ ] **Step 2: Update registration API enforcement**

In `app/api/account/register/route.ts`, import:

```ts
import { acceptedDocumentIdsFromInput, legalRequestMetadata, missingRequiredLegalDocuments, recordLegalAcceptances } from "@/lib/legal-acceptance"
import { requiredLegalDocumentsForEvent } from "@/lib/legal-documents"
```

After parsing `body`, define:

```ts
const requiredDocuments = requiredLegalDocumentsForEvent("registration")
const missingLegalDocuments = missingRequiredLegalDocuments({
  acceptedDocumentIds: acceptedDocumentIdsFromInput(body.acceptedLegalDocuments),
  documents: requiredDocuments,
})
```

Before creating the user, reject missing acceptance:

```ts
if (missingLegalDocuments.length > 0) {
  await recordFailedAttempt("REGISTER", key)
  return NextResponse.json({
    message: `Accept ${missingLegalDocuments.map((document) => document.shortLabel).join(" and ")} before creating an account.`,
  }, { status: 400 })
}
```

After `ensureUserRole(user.id, user.email)`, record acceptance:

```ts
await recordLegalAcceptances({
  prismaClient: prisma,
  userId: user.id,
  documents: requiredDocuments,
  metadata: legalRequestMetadata(request),
})
```

- [ ] **Step 3: Run targeted checks**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 4: Commit registration enforcement**

Run:

```bash
git add app/register/page.tsx app/api/account/register/route.ts
git commit -m "Require legal acceptance at registration"
```

## Task 6: Enforce Billing Terms Before Checkout

**Files:**
- Modify: `components/membership/pricing-cards.tsx`
- Modify: `app/api/billing/checkout/route.ts`

- [ ] **Step 1: Update pricing form UI**

In `components/membership/pricing-cards.tsx`, import:

```tsx
import { getLegalDocumentByKey, legalDocumentAcceptanceId } from "@/lib/legal-documents"
```

Inside `PlanAction`, before the return form, define:

```tsx
const billingTerms = getLegalDocumentByKey("membership-billing-refunds")
const billingTermsId = legalDocumentAcceptanceId(billingTerms)
```

Add a hidden accepted document value and required checkbox inside the checkout form before the button:

```tsx
<input type="hidden" name="acceptedLegalDocuments" value={billingTermsId} />
<label className="mb-3 flex gap-3 rounded-md border border-border/80 bg-background/70 p-3 text-xs text-muted-foreground">
  <input type="checkbox" name="billingTermsAccepted" value="true" className="mt-1" required />
  <span>
    I agree to the{" "}
    <Link href={billingTerms.route} className="text-brand-orange underline-offset-4 hover:underline">
      {billingTerms.label}
    </Link>
    .
  </span>
</label>
```

- [ ] **Step 2: Update checkout API parsing**

In `app/api/billing/checkout/route.ts`, import:

```ts
import { acceptedDocumentIdsFromInput, hasAcceptedCurrentDocuments, legalRequestMetadata, missingRequiredLegalDocuments, recordLegalAcceptances } from "@/lib/legal-acceptance"
import { requiredLegalDocumentsForEvent } from "@/lib/legal-documents"
```

Return accepted legal fields from `checkoutRequest()` for both form and JSON:

```ts
acceptedLegalDocuments: formData.getAll("acceptedLegalDocuments"),
billingTermsAccepted: formData.get("billingTermsAccepted") === "true",
```

and:

```ts
acceptedLegalDocuments: body.acceptedLegalDocuments,
billingTermsAccepted: body.billingTermsAccepted === true,
```

Before resolving Stripe price, add:

```ts
const requiredDocuments = requiredLegalDocumentsForEvent("checkout")
const acceptedDocumentIds = acceptedDocumentIdsFromInput(input.billingTermsAccepted ? input.acceptedLegalDocuments : [])
const alreadyAccepted = await hasAcceptedCurrentDocuments({
  prismaClient: prisma,
  userId: session.user.id,
  documents: requiredDocuments,
})
const missingLegalDocuments = alreadyAccepted ? [] : missingRequiredLegalDocuments({
  acceptedDocumentIds,
  documents: requiredDocuments,
})

if (missingLegalDocuments.length > 0) {
  return input.isForm
    ? accountRedirect("billing-terms-required")
    : NextResponse.json({ error: "Accept the membership billing and refund terms before checkout." }, { status: 400 })
}
```

After fetching the user and before Stripe calls, record accepted documents when needed:

```ts
if (!alreadyAccepted) {
  await recordLegalAcceptances({
    prismaClient: prisma,
    userId: session.user.id,
    documents: requiredDocuments,
    metadata: legalRequestMetadata(request),
  })
}
```

Update `billingMessage()` with:

```ts
if (code === "billing-terms-required") return "Accept the membership billing and refund terms before starting checkout."
```

- [ ] **Step 3: Run targeted checks**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 4: Commit checkout enforcement**

Run:

```bash
git add components/membership/pricing-cards.tsx app/api/billing/checkout/route.ts
git commit -m "Require billing terms before checkout"
```

## Task 7: Enforce Therapist Agreement For Professional Activation

**Files:**
- Modify: `app/account/page.tsx`
- Modify: `app/account/actions.ts`

- [ ] **Step 1: Update credential form UI**

In `app/account/page.tsx`, import:

```tsx
import { getLegalDocumentByKey, legalDocumentAcceptanceId } from "@/lib/legal-documents"
```

Inside `CredentialsTab`, define before return:

```tsx
const therapistAgreement = getLegalDocumentByKey("therapist-agreement")
const therapistAgreementId = legalDocumentAcceptanceId(therapistAgreement)
```

Add these fields before the Request verification button:

```tsx
<input type="hidden" name="acceptedLegalDocuments" value={therapistAgreementId} />
<label className="flex gap-3 rounded-md border border-border/80 bg-background/70 p-3 text-sm text-muted-foreground md:col-span-2">
  <input type="checkbox" name="therapistAgreementAccepted" value="true" className="mt-1" required />
  <span>
    I agree to the{" "}
    <Link href={therapistAgreement.route} className="text-brand-orange underline-offset-4 hover:underline">
      {therapistAgreement.label}
    </Link>{" "}
    before requesting professional or practice access.
  </span>
</label>
```

- [ ] **Step 2: Update server action enforcement**

In `app/account/actions.ts`, import:

```ts
import { acceptedDocumentIdsFromInput, missingRequiredLegalDocuments, recordLegalAcceptances } from "@/lib/legal-acceptance"
import { requiredLegalDocumentsForEvent } from "@/lib/legal-documents"
```

At the start of `requestCredentialVerificationAction`, after session validation:

```ts
const requiredDocuments = requiredLegalDocumentsForEvent("professional-activation")
const acceptedDocumentIds = acceptedDocumentIdsFromInput(
  formString(formData, "therapistAgreementAccepted") === "true"
    ? formData.getAll("acceptedLegalDocuments")
    : [],
)
const missingLegalDocuments = missingRequiredLegalDocuments({ acceptedDocumentIds, documents: requiredDocuments })

if (missingLegalDocuments.length > 0) {
  redirect("/account?tab=credentials&legal=therapist-agreement-required")
}

await recordLegalAcceptances({
  prismaClient: prisma,
  userId: session.user.id,
  documents: requiredDocuments,
  metadata: { ipAddress: null, userAgent: null },
})
```

If request metadata for server actions becomes available later through `headers()`, update this helper call in a follow-up. Branch 1 can still persist the required acceptance row; IP/user-agent are reliably captured in request routes and nullable in the schema for server-action paths.

- [ ] **Step 3: Add account notice for missing Therapist Agreement**

In `AccountPageProps.searchParams`, include:

```ts
legal?: string
```

Pass `legal={params?.legal}` to `AccountNotice`.

In `accountNotice`, add:

```ts
if (legal === "therapist-agreement-required") {
  return {
    title: "Therapist Agreement required",
    description: "Accept the Therapist Agreement before requesting professional or practice access.",
    tone: "destructive" as const,
  }
}
```

- [ ] **Step 4: Run targeted checks**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit professional activation enforcement**

Run:

```bash
git add app/account/page.tsx app/account/actions.ts
git commit -m "Require therapist agreement for credential requests"
```

## Task 8: Add Legal Links To Navigation And Trust Surfaces

**Files:**
- Modify: `lib/navigation.js`
- Modify: `app/support/page.tsx`
- Modify: `app/about/page.tsx`

- [ ] **Step 1: Add a legal account/support link**

In `lib/navigation.js`, add this route to `accountMenuRoutes` after support:

```js
{
  id: "legal",
  href: "/legal",
  label: "Legal",
  icon: "FileText",
  audiences: allAudiences,
  visibleInSidebar: true,
  groupId: "account",
},
```

Do not add all six legal pages to primary navigation.

- [ ] **Step 2: Add support page link**

In `app/support/page.tsx`, add a link card to `/legal` near the privacy note:

```tsx
<Link href="/legal">
  <AppSurface
    title="Legal and trust documents"
    description={<>Read MassageLab's current terms, privacy, billing, cookie, and local-first health data notices.</>}
    icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
    className={appCalloutClassName}
  />
</Link>
```

- [ ] **Step 3: Add about page link**

In `app/about/page.tsx`, add a secondary legal button beside pricing/about actions:

```tsx
<Button asChild variant="outline">
  <Link href="/legal">Legal documents</Link>
</Button>
```

- [ ] **Step 4: Run navigation tests**

Run: `npm run test -- tests/navigation-model.test.mjs`

Expected: PASS, after updating expected account/footer route ids if needed.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit link integration**

Run:

```bash
git add lib/navigation.js app/support/page.tsx app/about/page.tsx tests/navigation-model.test.mjs
git commit -m "Link legal documents from trust surfaces"
```

## Task 9: Full Validation And Documentation Sync

**Files:**
- Modify if needed: `docs/project-state.md`
- Modify if needed: `docs/project-log.md`

- [ ] **Step 1: Decide whether project docs need status updates**

If implementation lands and legal pages become live app surfaces, update:

```md
docs/project-state.md
docs/project-log.md
```

Use concise entries only. Preserve the existing legal/trust P2 language if this branch is not yet merged.

- [ ] **Step 2: Run Prisma validation**

Run: `npm run prisma:validate`

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 4: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 5: Run unit tests**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 6: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: Final diff review**

Run: `git diff --check`

Expected: no output.

Run: `git status --short`

Expected: only intentional uncommitted files, or clean after final commit.

- [ ] **Step 8: Final commit**

If docs were updated or any validation-only fixes remain, commit:

```bash
git add <changed-files>
git commit -m "Complete legal trust page rollout"
```

## Plan Self-Review

- Spec coverage: The plan covers all six pages, document versioning, acceptance persistence with IP/user-agent fields, registration acceptance, checkout acceptance, professional activation acceptance, footer/account/support discoverability, and exclusions for AI, research, hosted PHI, provider payments, account deletion, and account export.
- Placeholder scan: No `TBD`, `[Insert]`, or unspecified implementation tasks remain. The only conditional is the docs sync step, which has concrete skip/update criteria.
- Type consistency: The plan consistently uses `documentKey`, `documentVersion`, `legalDocumentAcceptanceId`, `requiredLegalDocumentsForEvent`, and `acceptedLegalDocuments`.

