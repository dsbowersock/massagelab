# Local-First Client Intake Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tablet-friendly local-first client intake workflow that a client can complete on the therapist's device, then hand back for therapist review and note-taking without uploading PHI.

**Architecture:** Keep the workflow on the existing `/notes/intake` route and continue using browser `localStorage`, local JSON/DOC/PDF export, and import from user-controlled files. Extract the intake document shape and export formatting into a small helper so the page, tests, and future SOAP handoff can share one canonical schema. Do not add Prisma tables, API routes, hosted clinical sync, or account preference sync.

**Tech Stack:** Next.js App Router client components, React state, browser `localStorage`, existing shadcn/Radix UI primitives, `lib/local-documents.js`, Node test runner, and Playwright browser QA.

---

## Branch

Recommended branch: `codex/local-first-client-intake-forms`

## Scope

This branch should improve the existing local-first intake route rather than creating a full form-builder product. It should produce one useful client-facing workflow:

- A client can fill out intake on a tablet with large, clear sections.
- The browser saves only when the user chooses local save.
- The therapist can review a concise summary after handoff.
- The therapist can export JSON/DOC/PDF.
- The therapist can clear the form before handing the tablet to the next client.
- No request body, API route, account preference sync, service worker cache, or database row stores PHI.

Out of scope:

- Hosted clinical sync.
- Client portal accounts.
- Custom form-builder templates.
- Signature legality beyond local acknowledgement capture.
- 3D/spatial anatomy tooling.

## File Structure

- Create `lib/local-client-intake.js`: canonical intake storage key, empty document, normalization from current and legacy intake exports, text export formatting, and therapist handoff summary.
- Create `tests/local-client-intake.test.mjs`: unit tests for normalization, legacy import, export text, and summary behavior.
- Modify `app/notes/intake/page.tsx`: use the shared helper, reorganize the UI into tablet-friendly sections, add therapist handoff/review summary, and add confirmed clear-for-next-client behavior.
- Create `tests/local-client-intake-page.test.mjs`: source-level guardrails for the intake page so client-facing controls, local-only storage, and no API upload code stay visible.
- Modify `tests/browser/local-first.spec.ts`: extend the local-first browser QA to fill the client-facing intake workflow, save locally, export, and confirm clearing does not upload clinical content.
- Modify `docs/wiki/privacy-and-phi.md`: document the new intake storage key and shared-tablet handoff expectations.
- Modify `docs/project-state.md` and `docs/project-log.md` only if the implementation changes priority, scope, or findings from this plan.

---

### Task 1: Add The Client Intake Document Helper

**Files:**
- Create: `lib/local-client-intake.js`
- Create: `tests/local-client-intake.test.mjs`

- [ ] **Step 1: Write the failing helper tests**

Create `tests/local-client-intake.test.mjs`:

```js
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  CLIENT_INTAKE_STORAGE_KEY,
  createClientHandoffSummary,
  createClientIntakeExportText,
  emptyClientIntakeDocument,
  normalizeClientIntakeDocument,
} from "../lib/local-client-intake.js"

describe("local client intake documents", () => {
  it("defines the tablet intake storage contract", () => {
    assert.equal(CLIENT_INTAKE_STORAGE_KEY, "massagelab-client-intake-draft-v1")
    assert.equal(emptyClientIntakeDocument.schemaVersion, 2)
    assert.equal(emptyClientIntakeDocument.formType, "client-intake")
    assert.deepEqual(emptyClientIntakeDocument.consents, {
      treatmentConsent: false,
      privacyAcknowledgement: false,
      clientSignature: "",
      signedAt: "",
    })
  })

  it("normalizes current client intake documents without accepting unknown shapes", () => {
    const normalized = normalizeClientIntakeDocument({
      schemaVersion: 2,
      formType: "client-intake",
      client: {
        fullName: "  Jane Client  ",
        dateOfBirth: "1990-04-12",
        phone: "555-1212",
        email: "jane@example.com",
        emergencyContact: "Jordan 555-2222",
      },
      session: {
        date: "2026-05-27",
        goals: "  Less neck tension  ",
        focusAreas: "neck, shoulders",
        pressurePreference: "medium",
      },
      health: {
        currentConditions: "headaches",
        medications: "none",
        allergies: "",
        surgeries: "",
        contraindications: "check left shoulder",
        pregnancyNotes: "",
      },
      consents: {
        treatmentConsent: true,
        privacyAcknowledgement: true,
        clientSignature: "Jane Client",
        signedAt: "2026-05-27T12:00:00.000Z",
      },
      therapistReview: {
        reviewedBy: "Derrick",
        reviewedAt: "2026-05-27T12:10:00.000Z",
        reviewNotes: "Discuss shoulder before session.",
      },
      ignored: "drop me",
    })

    assert.equal(normalized.client.fullName, "Jane Client")
    assert.equal(normalized.session.goals, "Less neck tension")
    assert.equal(normalized.health.contraindications, "check left shoulder")
    assert.equal(normalized.consents.treatmentConsent, true)
    assert.equal(normalized.therapistReview.reviewNotes, "Discuss shoulder before session.")
    assert.equal("ignored" in normalized, false)
  })

  it("upgrades legacy intake exports from the current alpha route", () => {
    const normalized = normalizeClientIntakeDocument({
      schemaVersion: 1,
      formType: "intake",
      clientName: "Legacy Client",
      dateOfBirth: "1985-08-01",
      phone: "555-3333",
      email: "legacy@example.com",
      emergencyContact: "Pat 555-4444",
      currentConditions: "low back tension",
      medications: "ibuprofen as needed",
      contraindications: "avoid deep pressure over bruise",
      goals: "relaxation and hip mobility",
      notes: "First visit.",
    })

    assert.equal(normalized.formType, "client-intake")
    assert.equal(normalized.client.fullName, "Legacy Client")
    assert.equal(normalized.health.currentConditions, "low back tension")
    assert.equal(normalized.session.goals, "relaxation and hip mobility")
    assert.equal(normalized.therapistReview.reviewNotes, "First visit.")
  })

  it("creates therapist review text without hiding local-first responsibility", () => {
    const document = normalizeClientIntakeDocument({
      ...emptyClientIntakeDocument,
      client: { ...emptyClientIntakeDocument.client, fullName: "Jane Client" },
      session: { ...emptyClientIntakeDocument.session, goals: "neck tension" },
      consents: { ...emptyClientIntakeDocument.consents, treatmentConsent: true, privacyAcknowledgement: true },
    })

    const text = createClientIntakeExportText(document)
    const summary = createClientHandoffSummary(document)

    assert.match(text, /MassageLab Client Intake/)
    assert.match(text, /Local-first export/)
    assert.match(text, /Jane Client/)
    assert.match(summary, /Jane Client/)
    assert.match(summary, /Treatment consent: Yes/)
    assert.match(summary, /Privacy acknowledgement: Yes/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/local-client-intake.test.mjs
```

Expected: FAIL because `lib/local-client-intake.js` does not exist.

- [ ] **Step 3: Implement the helper**

Create `lib/local-client-intake.js`:

```js
export const CLIENT_INTAKE_STORAGE_KEY = "massagelab-client-intake-draft-v1"

export const emptyClientIntakeDocument = {
  schemaVersion: 2,
  formType: "client-intake",
  client: {
    fullName: "",
    dateOfBirth: "",
    phone: "",
    email: "",
    emergencyContact: "",
  },
  session: {
    date: "",
    goals: "",
    focusAreas: "",
    pressurePreference: "",
  },
  health: {
    currentConditions: "",
    medications: "",
    allergies: "",
    surgeries: "",
    contraindications: "",
    pregnancyNotes: "",
  },
  consents: {
    treatmentConsent: false,
    privacyAcknowledgement: false,
    clientSignature: "",
    signedAt: "",
  },
  therapistReview: {
    reviewedBy: "",
    reviewedAt: "",
    reviewNotes: "",
  },
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function text(value) {
  return typeof value === "string" ? value.trim() : ""
}

function bool(value) {
  return value === true
}

function normalizeCurrent(value) {
  const source = isPlainObject(value) ? value : {}
  const client = isPlainObject(source.client) ? source.client : {}
  const session = isPlainObject(source.session) ? source.session : {}
  const health = isPlainObject(source.health) ? source.health : {}
  const consents = isPlainObject(source.consents) ? source.consents : {}
  const therapistReview = isPlainObject(source.therapistReview) ? source.therapistReview : {}

  return {
    schemaVersion: 2,
    formType: "client-intake",
    client: {
      fullName: text(client.fullName),
      dateOfBirth: text(client.dateOfBirth),
      phone: text(client.phone),
      email: text(client.email),
      emergencyContact: text(client.emergencyContact),
    },
    session: {
      date: text(session.date),
      goals: text(session.goals),
      focusAreas: text(session.focusAreas),
      pressurePreference: text(session.pressurePreference),
    },
    health: {
      currentConditions: text(health.currentConditions),
      medications: text(health.medications),
      allergies: text(health.allergies),
      surgeries: text(health.surgeries),
      contraindications: text(health.contraindications),
      pregnancyNotes: text(health.pregnancyNotes),
    },
    consents: {
      treatmentConsent: bool(consents.treatmentConsent),
      privacyAcknowledgement: bool(consents.privacyAcknowledgement),
      clientSignature: text(consents.clientSignature),
      signedAt: text(consents.signedAt),
    },
    therapistReview: {
      reviewedBy: text(therapistReview.reviewedBy),
      reviewedAt: text(therapistReview.reviewedAt),
      reviewNotes: text(therapistReview.reviewNotes),
    },
  }
}

function normalizeLegacy(value) {
  const source = isPlainObject(value) ? value : {}

  return normalizeCurrent({
    schemaVersion: 2,
    formType: "client-intake",
    client: {
      fullName: source.clientName,
      dateOfBirth: source.dateOfBirth,
      phone: source.phone,
      email: source.email,
      emergencyContact: source.emergencyContact,
    },
    session: {
      goals: source.goals,
    },
    health: {
      currentConditions: source.currentConditions,
      medications: source.medications,
      contraindications: source.contraindications,
    },
    therapistReview: {
      reviewNotes: source.notes,
    },
  })
}

export function normalizeClientIntakeDocument(value) {
  if (!isPlainObject(value)) {
    return emptyClientIntakeDocument
  }

  if (value.formType === "intake") {
    return normalizeLegacy(value)
  }

  if (value.formType !== "client-intake") {
    return emptyClientIntakeDocument
  }

  return normalizeCurrent(value)
}

function line(label, value) {
  return value ? `${label}: ${value}` : `${label}:`
}

function yesNo(value) {
  return value ? "Yes" : "No"
}

export function createClientHandoffSummary(document) {
  const data = normalizeClientIntakeDocument(document)

  return [
    line("Client", data.client.fullName),
    line("Date of birth", data.client.dateOfBirth),
    line("Goals", data.session.goals),
    line("Focus areas", data.session.focusAreas),
    line("Pressure preference", data.session.pressurePreference),
    line("Current conditions", data.health.currentConditions),
    line("Contraindications / precautions", data.health.contraindications),
    line("Treatment consent", yesNo(data.consents.treatmentConsent)),
    line("Privacy acknowledgement", yesNo(data.consents.privacyAcknowledgement)),
  ].join("\n")
}

export function createClientIntakeExportText(document) {
  const data = normalizeClientIntakeDocument(document)

  return [
    "MassageLab Client Intake",
    "Local-first export. User is responsible for PHI storage and sharing.",
    "",
    "Client",
    line("Name", data.client.fullName),
    line("Date of birth", data.client.dateOfBirth),
    line("Phone", data.client.phone),
    line("Email", data.client.email),
    line("Emergency contact", data.client.emergencyContact),
    "",
    "Session",
    line("Date", data.session.date),
    line("Goals", data.session.goals),
    line("Focus areas", data.session.focusAreas),
    line("Pressure preference", data.session.pressurePreference),
    "",
    "Health",
    line("Current conditions", data.health.currentConditions),
    line("Medications", data.health.medications),
    line("Allergies", data.health.allergies),
    line("Surgeries", data.health.surgeries),
    line("Contraindications / precautions", data.health.contraindications),
    line("Pregnancy notes", data.health.pregnancyNotes),
    "",
    "Consent",
    line("Treatment consent", yesNo(data.consents.treatmentConsent)),
    line("Privacy acknowledgement", yesNo(data.consents.privacyAcknowledgement)),
    line("Client signature", data.consents.clientSignature),
    line("Signed at", data.consents.signedAt),
    "",
    "Therapist Review",
    line("Reviewed by", data.therapistReview.reviewedBy),
    line("Reviewed at", data.therapistReview.reviewedAt),
    line("Review notes", data.therapistReview.reviewNotes),
  ].join("\n")
}
```

- [ ] **Step 4: Run helper tests**

Run:

```bash
node --test tests/local-client-intake.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/local-client-intake.js tests/local-client-intake.test.mjs
git commit -m "feat: add local client intake document helper"
```

---

### Task 2: Add Page Guardrail Tests For Tablet Intake

**Files:**
- Create: `tests/local-client-intake-page.test.mjs`

- [ ] **Step 1: Write the failing page source tests**

Create `tests/local-client-intake-page.test.mjs`:

```js
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

describe("client intake page source", () => {
  it("uses the shared local intake contract and exposes tablet handoff controls", async () => {
    const source = await readFile(new URL("../app/notes/intake/page.tsx", import.meta.url), "utf8")

    assert.match(source, /CLIENT_INTAKE_STORAGE_KEY/)
    assert.match(source, /emptyClientIntakeDocument/)
    assert.match(source, /normalizeClientIntakeDocument/)
    assert.match(source, /Tablet handoff/)
    assert.match(source, /Therapist review/)
    assert.match(source, /Clear for next client/)
    assert.match(source, /clientFullName/)
    assert.match(source, /clientSignature/)
  })

  it("does not add clinical upload or account sync paths to the local intake page", async () => {
    const source = await readFile(new URL("../app/notes/intake/page.tsx", import.meta.url), "utf8")

    assert.doesNotMatch(source, /fetch\s*\(/)
    assert.doesNotMatch(source, /\/api\/clinical\/sync/)
    assert.doesNotMatch(source, /\/api\/account\/preferences/)
    assert.doesNotMatch(source, /prisma/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/local-client-intake-page.test.mjs
```

Expected: FAIL because the page still uses the old inline form shape and lacks tablet handoff controls.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/local-client-intake-page.test.mjs
git commit -m "test: capture client intake tablet workflow expectations"
```

---

### Task 3: Refactor `/notes/intake` Into A Tablet-Friendly Workflow

**Files:**
- Modify: `app/notes/intake/page.tsx`

- [ ] **Step 1: Replace inline intake shape with the helper**

In `app/notes/intake/page.tsx`, replace `INTAKE_STORAGE_KEY`, `emptyIntakeForm`, `IntakeFormData`, and `generateIntakeText` with imports from the helper:

```tsx
import {
  CLIENT_INTAKE_STORAGE_KEY,
  createClientHandoffSummary,
  createClientIntakeExportText,
  emptyClientIntakeDocument,
  normalizeClientIntakeDocument,
} from "@/lib/local-client-intake"
```

Use the helper shape for state:

```tsx
type ClientIntakeData = typeof emptyClientIntakeDocument

const [formData, setFormData] = useState<ClientIntakeData>(emptyClientIntakeDocument)
```

Read local draft with the new key:

```tsx
useEffect(() => {
  const draft = window.localStorage.getItem(CLIENT_INTAKE_STORAGE_KEY)
  if (draft) {
    try {
      setFormData(normalizeClientIntakeDocument(JSON.parse(draft)))
    } catch {
      window.localStorage.removeItem(CLIENT_INTAKE_STORAGE_KEY)
    }
  }
}, [])
```

- [ ] **Step 2: Add nested field update helpers**

Add field helpers near the state declarations:

```tsx
type IntakeSection = "client" | "session" | "health" | "consents" | "therapistReview"

function updateNestedField<TSection extends IntakeSection>(
  section: TSection,
  field: keyof ClientIntakeData[TSection],
  value: string | boolean,
) {
  setMessage(null)
  setFormData((current) => ({
    ...current,
    [section]: {
      ...current[section],
      [field]: value,
    },
  }))
}
```

- [ ] **Step 3: Save, import, and export through the helper**

Update save/export/import functions:

```tsx
const saveDraft = () => {
  window.localStorage.setItem(CLIENT_INTAKE_STORAGE_KEY, JSON.stringify(formData))
  setMessage("Intake saved locally on this tablet.")
}

const exportForm = () => {
  downloadJson(filenameForIntake(formData), formData)
  setMessage("Exported a user-controlled JSON file. MassageLab did not upload this intake.")
}

const exportDoc = () => {
  downloadFile(
    filenameForIntake(formData, "doc"),
    createEditableDocumentHtml({ title: "MassageLab Client Intake", body: createClientIntakeExportText(formData) }),
    "application/msword",
  )
  setMessage("Exported an editable document. MassageLab did not upload this intake.")
}

const printPdf = () => {
  const opened = openPrintDocument(
    createEditableDocumentHtml({ title: "MassageLab Client Intake", body: createClientIntakeExportText(formData) }),
  )
  setMessage(opened ? "Opened a print view. Choose Save as PDF in your browser to export a PDF." : "Could not open the print view.")
}

const importForm = async (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    setFormData(normalizeClientIntakeDocument(parseLocalDocumentJson(await file.text(), emptyClientIntakeDocument, {
      discriminatorKey: "formType",
      discriminatorValue: "client-intake",
    })))
    setMessage("Imported client intake. Review it before saving or exporting.")
  } catch {
    try {
      setFormData(normalizeClientIntakeDocument(JSON.parse(await file.text())))
      setMessage("Imported legacy intake. Review it before saving or exporting.")
    } catch {
      setMessage("Could not import that file. Choose a MassageLab intake JSON export.")
    }
  } finally {
    event.target.value = ""
  }
}
```

When implementing import, avoid reading `file.text()` twice in production code by assigning it once:

```tsx
const text = await file.text()
```

- [ ] **Step 4: Add the tablet handoff layout**

Keep `AppPageShell`, `AppSurface`, `AppInset`, `Button`, `Input`, `Label`, `Textarea`, `Checkbox`, and `AlertDialog` patterns already used elsewhere. The page should include these visible sections:

```tsx
<CardTitle>Tablet handoff</CardTitle>
<CardDescription>
  Hand this tablet to the client for intake, then review the summary before the session. Nothing is uploaded by this workflow.
</CardDescription>
```

Client fields must use stable labels/ids:

```tsx
<Input id="clientFullName" value={formData.client.fullName} onChange={(event) => updateNestedField("client", "fullName", event.target.value)} />
<Input id="clientDateOfBirth" type="date" value={formData.client.dateOfBirth} onChange={(event) => updateNestedField("client", "dateOfBirth", event.target.value)} />
<Input id="clientPhone" value={formData.client.phone} onChange={(event) => updateNestedField("client", "phone", event.target.value)} />
<Input id="clientEmail" type="email" value={formData.client.email} onChange={(event) => updateNestedField("client", "email", event.target.value)} />
<Input id="clientEmergencyContact" value={formData.client.emergencyContact} onChange={(event) => updateNestedField("client", "emergencyContact", event.target.value)} />
```

Session and health fields must include:

```tsx
<Textarea id="sessionGoals" value={formData.session.goals} onChange={(event) => updateNestedField("session", "goals", event.target.value)} />
<Textarea id="focusAreas" value={formData.session.focusAreas} onChange={(event) => updateNestedField("session", "focusAreas", event.target.value)} />
<Input id="pressurePreference" value={formData.session.pressurePreference} onChange={(event) => updateNestedField("session", "pressurePreference", event.target.value)} />
<Textarea id="currentConditions" value={formData.health.currentConditions} onChange={(event) => updateNestedField("health", "currentConditions", event.target.value)} />
<Textarea id="medications" value={formData.health.medications} onChange={(event) => updateNestedField("health", "medications", event.target.value)} />
<Textarea id="allergies" value={formData.health.allergies} onChange={(event) => updateNestedField("health", "allergies", event.target.value)} />
<Textarea id="contraindications" value={formData.health.contraindications} onChange={(event) => updateNestedField("health", "contraindications", event.target.value)} />
```

Consent fields must include:

```tsx
<Checkbox id="treatmentConsent" checked={formData.consents.treatmentConsent} onCheckedChange={(checked) => updateNestedField("consents", "treatmentConsent", checked === true)} />
<Checkbox id="privacyAcknowledgement" checked={formData.consents.privacyAcknowledgement} onCheckedChange={(checked) => updateNestedField("consents", "privacyAcknowledgement", checked === true)} />
<Input id="clientSignature" value={formData.consents.clientSignature} onChange={(event) => updateNestedField("consents", "clientSignature", event.target.value)} />
```

- [ ] **Step 5: Add therapist review and clear-for-next-client behavior**

Add a review panel:

```tsx
<CardTitle>Therapist review</CardTitle>
<pre className="whitespace-pre-wrap rounded-md border bg-background p-3 text-sm">{createClientHandoffSummary(formData)}</pre>
<Textarea id="therapistReviewNotes" value={formData.therapistReview.reviewNotes} onChange={(event) => updateNestedField("therapistReview", "reviewNotes", event.target.value)} />
```

Add confirmed clear behavior:

```tsx
const clearForNextClient = () => {
  window.localStorage.removeItem(CLIENT_INTAKE_STORAGE_KEY)
  setFormData(emptyClientIntakeDocument)
  setMessage("Intake cleared on this tablet. It is ready for the next client.")
}
```

The clear button must be labeled `Clear for next client`, and the final confirmation button must be labeled `Clear intake form`.

- [ ] **Step 6: Run page guardrail and helper tests**

Run:

```bash
node --test tests/local-client-intake.test.mjs tests/local-client-intake-page.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/notes/intake/page.tsx lib/local-client-intake.js tests/local-client-intake.test.mjs tests/local-client-intake-page.test.mjs
git commit -m "feat: make intake tablet handoff local-first"
```

---

### Task 4: Extend Browser QA For Tablet Intake

**Files:**
- Modify: `tests/browser/local-first.spec.ts`

- [ ] **Step 1: Update the browser test before changing behavior further**

Replace the intake portion of `tests/browser/local-first.spec.ts` with:

```ts
await gotoHydratedLocalPage(page, "/notes/intake")
await expect(page.getByText(/Tablet handoff/i)).toBeVisible()
await page.getByLabel(/Client full name/i).fill(ML_BROWSER_QA_SENTINEL)
await page.getByLabel(/Current conditions/i).fill(`${ML_BROWSER_QA_SENTINEL} with limited rotation`)
await page.getByLabel(/Goals/i).fill("reduce neck tension")
await page.getByLabel(/Client signature/i).fill("QA Client")
await page.getByRole("checkbox", { name: /treatment consent/i }).check()
await page.getByRole("checkbox", { name: /privacy acknowledgement/i }).check()
await page.getByRole("button", { name: /Save Local Draft/i }).click()
await expect(page.getByText(/Intake saved locally on this tablet/i)).toBeVisible()
await clickAndWaitForDownload(page, /Export JSON/i)
await expect(page.getByText(/MassageLab did not upload this intake/i)).toBeVisible()
await page.getByRole("button", { name: /Clear for next client/i }).click()
await page.getByRole("button", { name: /Clear intake form/i }).click()
await expect(page.getByText(/ready for the next client/i)).toBeVisible()
```

- [ ] **Step 2: Run the browser spec**

Run:

```bash
npx playwright test tests/browser/local-first.spec.ts --project=desktop-chromium
```

Expected: PASS and `clinical/account upload requests` remains `[]`.

- [ ] **Step 3: Commit**

```bash
git add tests/browser/local-first.spec.ts
git commit -m "test: cover tablet intake local-first handoff"
```

---

### Task 5: Update Local-First Privacy Documentation

**Files:**
- Modify: `docs/wiki/privacy-and-phi.md`

- [ ] **Step 1: Document the new intake storage key and tablet workflow**

In `docs/wiki/privacy-and-phi.md`, replace the intake bullet with:

```md
- Intake drafts for the tablet handoff workflow stay in the current browser under `massagelab-client-intake-draft-v1`. Legacy imports from `massagelab-intake-draft` are local files only and should be re-saved under the new shape if used.
```

Add this section after `Local-First Storage`:

```md
## Shared Tablet Workflow

- A therapist may hand a tablet to a client for local intake.
- The client-facing intake workflow must not call account, client, calendar, clinical sync, or other `/api/*` endpoints.
- The therapist should review the local summary before treatment and export or clear the form intentionally.
- `Clear for next client` removes the local draft from that browser and resets the page state before the tablet is handed to another client.
```

- [ ] **Step 2: Run documentation/source tests**

Run:

```bash
node --test tests/local-client-intake.test.mjs tests/local-client-intake-page.test.mjs tests/browser-qa-harness.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/wiki/privacy-and-phi.md
git commit -m "docs: document tablet intake privacy boundary"
```

---

### Task 6: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused local-first checks**

Run:

```bash
node --test tests/local-client-intake.test.mjs tests/local-client-intake-page.test.mjs tests/browser-qa-harness.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run project static checks**

Run:

```bash
npm run lint
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run browser local-first guard**

Run:

```bash
npx playwright test tests/browser/local-first.spec.ts --project=desktop-chromium
```

Expected: PASS, with no clinical/account upload requests.

- [ ] **Step 4: Run full unit test suite if time allows**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 5: Review diff**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. The status should show only intentional local-first intake, tests, and documentation files.

---

## Self-Review Notes

- Spec coverage: this plan covers the desired client tablet intake workflow, therapist review/handoff, local-only storage, export/clear behavior, and explicit deferral of hosted sync.
- Placeholder scan: no task relies on a placeholder implementation or a generic "add tests" instruction.
- Type consistency: the canonical document shape is `client`, `session`, `health`, `consents`, and `therapistReview`; all tests and page instructions use those names.
