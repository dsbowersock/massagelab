import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import manifestAnchors from "../data/atmoshaper/signature-sound-derived-audio-manifests.json" with { type: "json" }

const qaModule = await import("../lib/atmoshaper/signature-sound-derived-audio-qa.js").catch(() => ({}))
const createSignatureSoundDerivedAudioQaDraft = qaModule.createSignatureSoundDerivedAudioQaDraft
const validateSignatureSoundDerivedAudioQa = qaModule.validateSignatureSoundDerivedAudioQa
const committedQaText = await readFile(new URL("../data/atmoshaper/signature-sound-derived-audio-qa.json", import.meta.url), "utf8").catch(() => null)
const committedBatch02QaText = await readFile(new URL("../data/atmoshaper/signature-sound-derived-audio-qa-batch-02-air-traffic-control.json", import.meta.url), "utf8").catch(() => null)

const OUTPUT_IDENTITIES = [
  "2a024d7cc5923cc465b088faaccec79583924314b3cd19b17f18a31815d5f987",
  "87d5eee5402707237cd5f3dd37bad23aa71dca63beee5fce896726ad05740ec3",
  "05152d472168db2e14773ddcb42f15fcd164610c0a72bfa30ecf1801be9e55bb",
  "e06aaf0b5986441ac2631b44757ba372cd2a5579ecbc28a72931e48446854a24",
]
const BATCH_SHA = "1dc03a71719a12e4e5e47ebf0410f7ed9e308b06d7a1e2434a3de853d8ac2f6a"
const MANIFEST_SHA = "04f96575eb156fc39913244b9e7f30d46025f7b3580031e15af2cc1e8c3b53a8"
const BATCH02_OUTPUT_IDENTITIES = [
  "ae65ff444044fd7a713f562c8dfb1bc3791772c30f8630202168bc920b390841",
  "5ffa603aa9a82f868dd313b701b9be96522d7946f0d2c58b90b6a61328505cd5",
  "9fca2831507f4358482990ef59d782e5644416a4d42577514d8179d8924fb259",
  "69739bc553c8951bad44d74e23b8239714624ed4f5def924fd0c0f51d7400d24",
  "efd91d7d1d27beb767e5fb722692287d5444caa00b9cde994f4fae2cf624b6c0",
  "ccba6404ea543ff1c90962ebe460e164bc64b74c4687d03c89d74d379b5253ac",
  "3241d8a1c3edf26ce90d6e783b44c719cd0b91d7962b1512f10577566d5e2719",
  "933417bf27386a363ee2d15454e40b4a6700d718487164fddca683b921b83b27",
  "cd5171e95fb84bad8a8dc04a5ca06dece87eb820fc14a33f33fa9693dbf5daf0",
  "2cf9c1ed0055c3be67cf089e939d80386e738b875268ebf7561ee2eb2d1b1e89",
  "2c855cc62b68bc185250100de988547cccf3520b6c1170abf9974a41475d4cde",
  "5165355a7b7f7314640a4d251a54df191c366cc0b6249cbcd5f6e75dd37dc2b8",
]
const BATCH02_SHA = "87a79b019a119ef781640fb344a8f3b688a2aa7fd0a0457a7da29a1b1da17008"
const BATCH02_MANIFEST_SHA = "fb0163b77a656f92f61bcc2bd63d46b9ad74bbc55fb9b4557268beab95a1ef94"
const manifest = {
  version: 1,
  batchDeclarationSha256: BATCH_SHA,
  outputs: OUTPUT_IDENTITIES.map((outputIdentity) => ({ outputIdentity })),
}
const batch02Manifest = {
  version: 1,
  batchDeclarationSha256: BATCH02_SHA,
  outputs: BATCH02_OUTPUT_IDENTITIES.map((outputIdentity) => ({ outputIdentity })),
}

function draft(overrides = {}) {
  return {
    version: 1,
    batchDeclarationSha256: BATCH_SHA,
    manifestSha256: MANIFEST_SHA,
    updatedAt: "2026-08-25T18:20:05.070Z",
    outputs: {
      [OUTPUT_IDENTITIES[0]]: {
        note: "",
        sourceHeardAt: "2026-08-25T18:19:19.172Z",
        derivedHeardAt: "2026-08-25T18:19:09.256Z",
      },
    },
    ...overrides,
  }
}

describe("AtmoShaper Signature derived-audio QA", () => {
  it("exposes one shared closed validator", () => {
    assert.equal(typeof validateSignatureSoundDerivedAudioQa, "function")
    assert.equal(typeof createSignatureSoundDerivedAudioQaDraft, "function")
  })

  if (typeof validateSignatureSoundDerivedAudioQa === "function") {
  it("creates an empty exact draft for a newly rendered batch", () => {
    const qa = createSignatureSoundDerivedAudioQaDraft({ manifest, manifestSha256: MANIFEST_SHA })
    assert.equal(qa.batchDeclarationSha256, BATCH_SHA)
    assert.equal(qa.manifestSha256, MANIFEST_SHA)
    assert.deepEqual(Object.keys(qa.outputs), OUTPUT_IDENTITIES)
    assert.ok(Object.values(qa.outputs).every((entry) => entry.note === "" && entry.decision === undefined))
  })

  it("normalizes a fingerprint-bound partial browser draft without inventing decisions", () => {
    const raw = draft()
    const normalized = validateSignatureSoundDerivedAudioQa(raw, { manifest, manifestSha256: MANIFEST_SHA })
    assert.equal(normalized.outputs[OUTPUT_IDENTITIES[0]].decision, undefined)
    assert.deepEqual(normalized.outputs[OUTPUT_IDENTITIES[1]], { note: "" })
    raw.outputs[OUTPUT_IDENTITIES[0]].note = "mutated"
    assert.equal(normalized.outputs[OUTPUT_IDENTITIES[0]].note, "")
  })

  it("fails closed on stale identity, unknown fields, invalid evidence, and incomplete final QA", () => {
    assert.throws(() => validateSignatureSoundDerivedAudioQa(draft({ manifestSha256: "f".repeat(64) }), { manifest, manifestSha256: MANIFEST_SHA }), /stale/i)
    assert.throws(() => validateSignatureSoundDerivedAudioQa({ ...draft(), surprise: true }, { manifest, manifestSha256: MANIFEST_SHA }), /unknown/i)
    assert.throws(() => validateSignatureSoundDerivedAudioQa(draft({ outputs: { ["9".repeat(64)]: { note: "" } } }), { manifest, manifestSha256: MANIFEST_SHA }), /unknown/i)
    assert.throws(() => validateSignatureSoundDerivedAudioQa(draft({ outputs: { [OUTPUT_IDENTITIES[0]]: { note: "", decision: "pass" } } }), { manifest, manifestSha256: MANIFEST_SHA }), /heard/i)
    assert.throws(() => validateSignatureSoundDerivedAudioQa(draft({ outputs: { [OUTPUT_IDENTITIES[0]]: { note: "", decision: "reject" } } }), { manifest, manifestSha256: MANIFEST_SHA }), /note|heard/i)
    assert.throws(() => validateSignatureSoundDerivedAudioQa(draft(), { manifest, manifestSha256: MANIFEST_SHA, requireComplete: true }), /decision|complete/i)
  })

  it("accepts the four exact user-approved artifacts as complete QA", () => {
    assert.ok(committedQaText, "expected committed derived-audio QA")
    const committedQa = JSON.parse(committedQaText)
    const normalized = validateSignatureSoundDerivedAudioQa(committedQa, { manifest, manifestSha256: MANIFEST_SHA, requireComplete: true })
    assert.deepEqual(Object.keys(normalized.outputs), OUTPUT_IDENTITIES)
    assert.ok(Object.values(normalized.outputs).every((entry) => entry.decision === "pass"))
    assert.equal(manifestAnchors.entries[0].state, "audible-qa-passed")
  })

  it("accepts all 12 explicitly passed Air Traffic artifacts without replacing Campfire QA", () => {
    assert.ok(committedQaText, "expected retained Campfire derived-audio QA")
    assert.ok(committedBatch02QaText, "expected committed Air Traffic derived-audio QA")
    const committedBatch02Qa = JSON.parse(committedBatch02QaText)
    const normalized = validateSignatureSoundDerivedAudioQa(committedBatch02Qa, {
      manifest: batch02Manifest,
      manifestSha256: BATCH02_MANIFEST_SHA,
      requireComplete: true,
    })
    assert.deepEqual(Object.keys(normalized.outputs), BATCH02_OUTPUT_IDENTITIES)
    assert.ok(Object.values(normalized.outputs).every((entry) => entry.decision === "pass"))
    assert.ok(Object.values(normalized.outputs).every((entry) => entry.sourceHeardAt && entry.derivedHeardAt))
    assert.equal(manifestAnchors.entries[0].state, "audible-qa-passed")
    assert.equal(manifestAnchors.entries[1].state, "audible-qa-passed")
  })
  }

  it("keeps the development review client on the shared validator", async () => {
    const client = await readFile(new URL("../app/dev/candidates/processing/derived-audio-review.tsx", import.meta.url), "utf8")
    const treatmentClient = await readFile(new URL("../app/dev/candidates/processing/treatment-audition-review.tsx", import.meta.url), "utf8")
    const page = await readFile(new URL("../app/dev/candidates/processing/page.tsx", import.meta.url), "utf8")
    assert.match(client, /validateSignatureSoundDerivedAudioQa/)
    assert.doesNotMatch(client, /function validateSavedQa/)
    assert.match(client, /initialQa/)
    assert.match(client, /Date\.parse\(savedQa\.updatedAt\).*Date\.parse\(current\.updatedAt\)/s)
    assert.match(treatmentClient, /validateSignatureSoundDerivedAudioQa/)
    assert.match(treatmentClient, /initialQa/)
    assert.match(page, /signature-sound-derived-audio-qa\.json/)
    assert.match(page, /signature-sound-derived-audio-qa-batch-02-air-traffic-control\.json/)
    assert.match(page, /committedQas\.find/)
    assert.match(page, /requireComplete:\s*true/)
  })

  it("anchors the selected Sci-Fi Whistles treatment as audible-QA-passed without changing prior approvals", () => {
    assert.equal(manifestAnchors.entries[0].state, "audible-qa-passed")
    assert.equal(manifestAnchors.entries[1].state, "audible-qa-passed")
    assert.deepEqual(manifestAnchors.entries[2], {
      batchId: "batch-03-sci-fi-whistles-treatment-audition",
      batchDeclarationSha256: "e05aadb04e87f56e9df4f69cba180ce37ca0f4481fbfc0fa2c981bdd4fb4163a",
      manifestRelativePath: "batch-manifest.json",
      manifestSha256: "8ff6856b1342a8d88366eeae48e1307b7cbc0921ef0ef7755fce8ac4f7faa6c6",
      state: "audible-qa-passed",
    })
  })

  it("anchors the selected Boiling Water 8-second crossfade as audible-QA-passed", () => {
    assert.deepEqual(manifestAnchors.entries[3], {
      batchId: "batch-04-boiling-water-edit-audition",
      batchDeclarationSha256: "7ba27607e61fdd09f3cad2c6898fec8726dd9762d798ad1437ff8120ae6e16e4",
      manifestRelativePath: "batch-manifest.json",
      manifestSha256: "dbbdb177e8cd47fa2923528f9de834a5ad1cdb87fe3c2cc3c780bf67a2a6c5c6",
      state: "audible-qa-passed",
    })
    assert.ok(manifestAnchors.entries.slice(0, 4).every(({ state }) => state === "audible-qa-passed"))
  })

  it("anchors the reviewed Dryer comparison as complete with the dry source selected", () => {
    assert.deepEqual(manifestAnchors.entries[4], {
      batchId: "batch-05-dryer-trim-audition",
      batchDeclarationSha256: "15ae5817239e3b43da3a520bae261fdf03756401d05220b06885996b18cfe2b9",
      manifestRelativePath: "batch-manifest.json",
      manifestSha256: "2612f3cf58c2be61ad3f609fc5e6237af34143c1185a983f5a892a58a11d9d9d",
      state: "audible-qa-complete-dry-selected",
    })
  })
})
