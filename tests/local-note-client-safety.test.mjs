import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

describe("local note client safety guards", () => {
  it("uses local calendar dates for journal and ROM entry defaults", async () => {
    const journal = await readFile(new URL("../app/notes/journal/client-page.tsx", import.meta.url), "utf8")
    const rom = await readFile(new URL("../app/notes/rom/client-page.tsx", import.meta.url), "utf8")

    assert.match(journal, /function formatLocalDate/)
    assert.match(rom, /function formatLocalDate/)
    assert.doesNotMatch(journal, /toISOString\(\)\.slice\(0,\s*10\)/)
    assert.doesNotMatch(rom, /toISOString\(\)\.slice\(0,\s*10\)/)
  })

  it("keeps ROM device baselines tied to their selected sensor axis", async () => {
    const source = await readFile(new URL("../app/notes/rom/client-page.tsx", import.meta.url), "utf8")

    assert.match(source, /\btype\s+DeviceBaseline\s*=\s*\{\s*axis\s*:\s*MeasurementAxis\s*;\s*value\s*:\s*number\s*\}/)
    assert.match(source, /baseline\?\.axis === axis/)
    assert.match(source, /baselineForAxis\.value/)
  })

  it("normalizes imported SOAP arrays before merging them into local documents", async () => {
    const source = await readFile(new URL("../app/notes/soap/client-page.tsx", import.meta.url), "utf8")

    assert.match(source, /subjectiveEntries: Array\.isArray\(data\.subjectiveEntries\)/)
    assert.match(source, /objectiveEntries: Array\.isArray\(data\.objectiveEntries\)/)
    assert.match(source, /techniques: Array\.isArray\(data\.assessment\?\.techniques\)/)
  })

  it("routes therapist documentation through the shared professional-record vault", async () => {
    for (const route of ["soap", "intake", "journal", "rom"]) {
      const source = await readFile(new URL(`../app/notes/${route}/client-page.tsx`, import.meta.url), "utf8")

      assert.match(source, /ProfessionalRecordVaultGate/)
      assert.match(source, /PlaintextOutputWarningAction/)
      assert.doesNotMatch(source, /localStorage\.(?:getItem|setItem|removeItem)/)
      assert.doesNotMatch(source, /parseLocalDocumentJson/)
      assert.doesNotMatch(source, /massagelab-soap-draft/)
      assert.doesNotMatch(source, /massagelab-client-journal-draft/)
      assert.doesNotMatch(source, /massagelab-rom-session-draft/)
      assert.doesNotMatch(source, /Export JSON/)
      assert.doesNotMatch(source, /Research JSON/)
      assert.doesNotMatch(source, /fetch\s*\(/)
      assert.doesNotMatch(source, /\/api\/clinical\/sync/)
      assert.doesNotMatch(source, /\/api\/clients\//)
      assert.doesNotMatch(source, /\/api\/account\/preferences/)
      assert.doesNotMatch(source, /prisma/i)
    }
  })

  it("keeps the vault passphrase in React memory only", async () => {
    const source = await readFile(new URL("../app/notes/professional-record-vault-provider.tsx", import.meta.url), "utf8")

    assert.match(source, /PROFESSIONAL_RECORD_VAULT_STORAGE_KEY/)
    assert.match(source, /useState\(""\)/)
    assert.doesNotMatch(source, /sessionStorage/)
    assert.doesNotMatch(source, /document\.cookie/)
    assert.doesNotMatch(source, /account\/preferences/)
  })
})
