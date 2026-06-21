import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

describe("local intake workspace page source", () => {
  it("uses the shared local intake contract and exposes v1 workspace surfaces", async () => {
    const source = await readFile(new URL("../app/notes/intake/client-page.tsx", import.meta.url), "utf8")

    assert.match(source, /ProfessionalRecordVaultGate/)
    assert.match(source, /ProfessionalRecordVaultTransferControls/)
    assert.match(source, /PlaintextOutputWarningAction/)
    assert.match(source, /saveIntakeWorkspace/)
    assert.match(source, /createFormResponseExportText/)
    assert.match(source, /professional-record vault/)
    assert.match(source, /Therapist local dashboard/)
    assert.match(source, /Tablet fill mode/)
    assert.match(source, /Form builder/)
    assert.match(source, /Client account contact page/)
    assert.match(source, /Clear for next client/)
    assert.match(source, /Start follow-up intake/)
    assert.match(source, /Use in SOAP/)
    assert.match(source, /createSoapDraftFromIntakeDocument/)
    assert.match(source, /router\.push\("\/notes\/soap"\)/)
    assert.match(source, /localClientId/)
  })

  it("does not add clinical upload, account sync, or Prisma access to the local intake page", async () => {
    const source = await readFile(new URL("../app/notes/intake/client-page.tsx", import.meta.url), "utf8")

    assert.doesNotMatch(source, /fetch\s*\(/)
    assert.doesNotMatch(source, /\/api\/clinical\/sync/)
    assert.doesNotMatch(source, /\/api\/clients\//)
    assert.doesNotMatch(source, /\/api\/account\/preferences/)
    assert.doesNotMatch(source, /\/notes\/soap\?/)
    assert.doesNotMatch(source, /window\.location/)
    assert.doesNotMatch(source, /prisma/i)
    assert.doesNotMatch(source, /localStorage\.setItem/)
    assert.doesNotMatch(source, /Export workspace JSON/)
    assert.doesNotMatch(source, /Export document JSON/)
    assert.doesNotMatch(source, /accept="application\/json,\.json"/)
  })

  it("does not fall back to unrelated local documents or preserve answers across template switches", async () => {
    const source = await readFile(new URL("../app/notes/intake/client-page.tsx", import.meta.url), "utf8")

    assert.doesNotMatch(source, /\?\?\s*workspace\.documents\[0\]/)
    assert.match(source, /selectedDocumentId\s*\?\s*workspace\.documents\.find/)
    assert.match(source, /setActiveResponse\(blankResponse\(copy\.id, \[copy, \.\.\.workspace\.templates\]\)\)/)
    assert.match(source, /setActiveResponse\(blankResponse\(template\.id, \[template, \.\.\.workspace\.templates\]\)\)/)
    assert.match(source, /setActiveResponse\(blankResponse\(fallbackTemplateId, workspace\.templates\)\)/)
  })

  it("keeps the intake client on named local workspace types instead of a broad record alias", async () => {
    const source = await readFile(new URL("../app/notes/intake/client-page.tsx", import.meta.url), "utf8")
    const typesSource = await readFile(new URL("../app/notes/intake/types.ts", import.meta.url), "utf8")

    assert.match(source, /import type \{[\s\S]*IntakeWorkspace[\s\S]*IntakeTemplate[\s\S]*IntakeFormResponse/)
    assert.match(source, /useState<IntakeWorkspace>/)
    assert.match(source, /type DashboardPanelProps = \{/)
    assert.match(source, /type TabletFillPanelProps = \{/)
    assert.match(source, /type FormBuilderPanelProps = \{/)
    assert.match(typesSource, /export type IntakeWorkspace = \{/)
    assert.match(typesSource, /export type IntakeClinicalDocument = \{/)
    assert.doesNotMatch(source, /type AnyRecord = Record<string, any>/)
    assert.doesNotMatch(source, /: any\b| as any\b|useState<any>/)
  })

  it("keeps built-in templates grounded in current intake and pain-map fields", async () => {
    const source = await readFile(new URL("../lib/local-intake-builder.js", import.meta.url), "utf8")

    for (const marker of [
      "Full intake form",
      "Follow-up intake",
      "Changes since last visit",
      "Current symptoms",
      "Today's goals",
      "Pain/discomfort map",
      "Preferred Name",
      "Desired Pressure",
      "Medical Conditions",
      "Informed Consent",
      "Sciatic Area (Buttock)",
      "${side} [${part}]",
      "AES-GCM",
    ]) {
      assert.ok(source.includes(marker), `Expected local intake builder to include ${marker}`)
    }
  })
})
