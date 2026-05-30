import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

describe("local intake workspace page source", () => {
  it("uses the shared local intake contract and exposes v1 workspace surfaces", async () => {
    const source = await readFile(new URL("../app/notes/intake/client-page.tsx", import.meta.url), "utf8")

    assert.match(source, /INTAKE_WORKSPACE_STORAGE_KEY/)
    assert.match(source, /createEncryptedIntakeWorkspaceVault/)
    assert.match(source, /decryptEncryptedIntakeWorkspaceVault/)
    assert.match(source, /createEncryptedIntakeBundle/)
    assert.match(source, /createFormResponseExportText/)
    assert.match(source, /Unlock intake vault/)
    assert.match(source, /Create encrypted vault/)
    assert.match(source, /Encrypt existing workspace/)
    assert.match(source, /Therapist local dashboard/)
    assert.match(source, /Tablet fill mode/)
    assert.match(source, /Form builder/)
    assert.match(source, /Client account contact page/)
    assert.match(source, /Export encrypted bundle/)
    assert.match(source, /Clear for next client/)
    assert.match(source, /localClientId/)
  })

  it("does not add clinical upload, account sync, or Prisma access to the local intake page", async () => {
    const source = await readFile(new URL("../app/notes/intake/client-page.tsx", import.meta.url), "utf8")

    assert.doesNotMatch(source, /fetch\s*\(/)
    assert.doesNotMatch(source, /\/api\/clinical\/sync/)
    assert.doesNotMatch(source, /\/api\/clients\//)
    assert.doesNotMatch(source, /\/api\/account\/preferences/)
    assert.doesNotMatch(source, /prisma/i)
    assert.doesNotMatch(source, /localStorage\.setItem\(INTAKE_WORKSPACE_STORAGE_KEY,\s*JSON\.stringify\((?:nextWorkspace|normalized)\)/)
  })

  it("keeps built-in templates grounded in current intake and pain-map fields", async () => {
    const source = await readFile(new URL("../lib/local-intake-builder.js", import.meta.url), "utf8")

    for (const marker of [
      "Full intake form",
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
