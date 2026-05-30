import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

describe("therapist note tool entitlements", () => {
  it("keeps note tools visible on the index while routing locked users to membership", async () => {
    const source = await readFile(new URL("../app/notes/page.tsx", import.meta.url), "utf8")

    assert.match(source, /getCurrentSession/)
    assert.match(source, /canUseLocalClinicalTools/)
    assert.match(source, /Therapist or Team\/Practice required/)
    assert.match(source, /account\?tab=membership/)
    assert.match(source, /href: "\/notes\/soap"/)
    assert.match(source, /href: "\/notes\/intake"/)
    assert.match(source, /href: "\/notes\/journal"/)
    assert.match(source, /href: "\/notes\/rom"/)
  })

  it("protects every therapist note-taking route behind the shared gate", async () => {
    for (const route of ["soap", "intake", "journal", "rom"]) {
      const page = await readFile(new URL(`../app/notes/${route}/page.tsx`, import.meta.url), "utf8")

      assert.doesNotMatch(page, /^"use client"/)
      assert.match(page, /TherapistNotesGate/)
      assert.match(page, /ClientPage/)
    }
  })

  it("uses a server-side gate with session capabilities, not plan display names", async () => {
    const source = await readFile(new URL("../app/notes/therapist-notes-gate.tsx", import.meta.url), "utf8")

    assert.match(source, /getCurrentSession/)
    assert.match(source, /canUseLocalClinicalTools/)
    assert.match(source, /Therapist membership required/)
    assert.doesNotMatch(source, /membershipLevel\s*===\s*"THERAPIST"/)
    assert.doesNotMatch(source, /membershipLevel\s*===\s*"PRACTICE"/)
  })
})
