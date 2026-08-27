import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"

import { resolveDevSignatureDerivedAudio } from "../lib/atmoshaper/dev-derived-audio.js"

function manifestFor(bytes, overrides = {}) {
  return {
    version: 1,
    outputs: [{
      outputIdentity: "a".repeat(64),
      outputRelativePath: "campfire/artifact.wav",
      outputMeasurement: {
        outputSha256: createHash("sha256").update(bytes).digest("hex"),
        byteSize: bytes.length,
      },
      ...overrides,
    }],
  }
}

async function writeCatalogBatch({ catalogRoot, batchId, externalDirectoryName, artifactBytes }) {
  const batchRoot = join(catalogRoot, externalDirectoryName)
  await mkdir(join(batchRoot, "campfire"), { recursive: true })
  await writeFile(join(batchRoot, "campfire", "artifact.wav"), artifactBytes)
  const manifest = { ...manifestFor(artifactBytes), batchId }
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`)
  await writeFile(join(batchRoot, "batch-manifest.json"), manifestBytes)
  return {
    batchRoot,
    manifest,
    manifestEntry: {
      batchId,
      manifestRelativePath: "batch-manifest.json",
      manifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
      state: "audible-qa-passed",
    },
  }
}

function registryFor(...batchIds) {
  return {
    version: 1,
    entries: batchIds.map((batchId, index) => ({
      batchId,
      declarationRelativePath: `data/atmoshaper/batch-${index + 1}.json`,
    })),
  }
}

describe("AtmoShaper development derived-audio streaming", () => {
  it("loads a checksum-anchored batch from its server-owned external directory name", async (context) => {
    const audioModule = await import("../lib/atmoshaper/dev-derived-audio.js")
    assert.equal(typeof audioModule.loadDevSignatureDerivedCatalogBatch, "function")
    const catalogRoot = await mkdtemp(join(tmpdir(), "atmoshaper-dev-derived-catalog-"))
    context.after(() => rm(catalogRoot, { recursive: true, force: true }))
    const batchId = "batch-02-air-traffic-control"
    const externalDirectoryName = "immutable-air-traffic-review-v7"
    const artifactBytes = Buffer.from("catalog derived wav bytes")
    const fixture = await writeCatalogBatch({ catalogRoot, batchId, externalDirectoryName, artifactBytes })

    const selected = await audioModule.loadDevSignatureDerivedCatalogBatch({
      batchId,
      catalogRoot,
      outputRoot: undefined,
      batchRegistry: registryFor(batchId),
      manifestEntries: [fixture.manifestEntry],
      externalDirectoryNames: { [batchId]: externalDirectoryName },
      nodeEnv: "development",
    })

    assert.equal(selected.batchId, batchId)
    assert.equal(selected.externalDirectoryName, externalDirectoryName)
    assert.equal(selected.manifestEntry, fixture.manifestEntry)
    assert.deepEqual(selected.manifest, fixture.manifest)
    const artifact = await resolveDevSignatureDerivedAudio({
      outputIdentity: "a".repeat(64),
      manifest: selected.manifest,
      outputRoot: selected.outputRoot,
      nodeEnv: "development",
    })
    assert.deepEqual(artifact.bytes, artifactBytes)
  })

  it("retains the exact single-root fallback when no catalog root is configured", async (context) => {
    const audioModule = await import("../lib/atmoshaper/dev-derived-audio.js")
    assert.equal(typeof audioModule.loadDevSignatureDerivedCatalogBatch, "function")
    const outputRoot = await mkdtemp(join(tmpdir(), "atmoshaper-dev-derived-fallback-"))
    context.after(() => rm(outputRoot, { recursive: true, force: true }))
    const batchId = "batch-01-campfire-boiling-water"
    const artifactBytes = Buffer.from("fallback derived wav bytes")
    const fixture = await writeCatalogBatch({
      catalogRoot: outputRoot,
      batchId,
      externalDirectoryName: "nested-fixture",
      artifactBytes,
    })
    await writeFile(join(outputRoot, "batch-manifest.json"), await readFile(join(fixture.batchRoot, "batch-manifest.json")))
    await mkdir(join(outputRoot, "campfire"))
    await writeFile(join(outputRoot, "campfire", "artifact.wav"), artifactBytes)

    const selected = await audioModule.loadDevSignatureDerivedCatalogBatch({
      batchId,
      catalogRoot: undefined,
      outputRoot,
      batchRegistry: registryFor(batchId),
      manifestEntries: [fixture.manifestEntry],
      externalDirectoryNames: { [batchId]: "ignored-while-using-fallback" },
      nodeEnv: "development",
    })

    assert.equal(selected.outputRoot, outputRoot)
    assert.equal(selected.externalDirectoryName, null)
    assert.deepEqual(selected.manifest, fixture.manifest)
  })

  it("selects only a batch present exactly once in both the registry and manifest anchors", async (context) => {
    const audioModule = await import("../lib/atmoshaper/dev-derived-audio.js")
    assert.equal(typeof audioModule.loadDevSignatureDerivedCatalogBatch, "function")
    const catalogRoot = await mkdtemp(join(tmpdir(), "atmoshaper-dev-derived-closed-"))
    context.after(() => rm(catalogRoot, { recursive: true, force: true }))
    const batchId = "batch-02-air-traffic-control"
    const fixture = await writeCatalogBatch({
      catalogRoot,
      batchId,
      externalDirectoryName: batchId,
      artifactBytes: Buffer.from("closed catalog bytes"),
    })
    const base = {
      batchId,
      catalogRoot,
      outputRoot: undefined,
      batchRegistry: registryFor(batchId),
      manifestEntries: [fixture.manifestEntry],
      externalDirectoryNames: { [batchId]: batchId },
      nodeEnv: "development",
    }

    await assert.rejects(
      audioModule.loadDevSignatureDerivedCatalogBatch({ ...base, batchId: "batch-99-browser-input" }),
      /unknown|registry|anchor/i,
    )
    await assert.rejects(
      audioModule.loadDevSignatureDerivedCatalogBatch({ ...base, manifestEntries: [] }),
      /anchor|manifest/i,
    )
    await assert.rejects(
      audioModule.loadDevSignatureDerivedCatalogBatch({
        ...base,
        manifestEntries: [fixture.manifestEntry, { ...fixture.manifestEntry }],
      }),
      /duplicate|exactly once/i,
    )
  })

  it("rejects escaping external names, symlinked batch roots, and manifest drift", async (context) => {
    const audioModule = await import("../lib/atmoshaper/dev-derived-audio.js")
    assert.equal(typeof audioModule.loadDevSignatureDerivedCatalogBatch, "function")
    const catalogRoot = await mkdtemp(join(tmpdir(), "atmoshaper-dev-derived-contained-"))
    const outsideRoot = await mkdtemp(join(tmpdir(), "atmoshaper-dev-derived-outside-"))
    context.after(() => Promise.all([
      rm(catalogRoot, { recursive: true, force: true }),
      rm(outsideRoot, { recursive: true, force: true }),
    ]))
    const batchId = "batch-03-sci-fi-whistles-treatment-audition"
    const fixture = await writeCatalogBatch({
      catalogRoot: outsideRoot,
      batchId,
      externalDirectoryName: "physical-batch",
      artifactBytes: Buffer.from("outside catalog bytes"),
    })
    const base = {
      batchId,
      catalogRoot,
      outputRoot: undefined,
      batchRegistry: registryFor(batchId),
      manifestEntries: [fixture.manifestEntry],
      externalDirectoryNames: { [batchId]: "linked-batch" },
      nodeEnv: "development",
    }

    await assert.rejects(
      audioModule.loadDevSignatureDerivedCatalogBatch({
        ...base,
        externalDirectoryNames: { [batchId]: "../physical-batch" },
      }),
      /directory|relative|path|portable/i,
    )
    await symlink(
      fixture.batchRoot,
      join(catalogRoot, "linked-batch"),
      process.platform === "win32" ? "junction" : "dir",
    )
    await assert.rejects(audioModule.loadDevSignatureDerivedCatalogBatch(base), /outside|catalog|root/i)

    const local = await writeCatalogBatch({
      catalogRoot,
      batchId,
      externalDirectoryName: "local-batch",
      artifactBytes: Buffer.from("local catalog bytes"),
    })
    await assert.rejects(
      audioModule.loadDevSignatureDerivedCatalogBatch({
        ...base,
        manifestEntries: [{ ...local.manifestEntry, manifestSha256: "f".repeat(64) }],
        externalDirectoryNames: { [batchId]: "local-batch" },
      }),
      /changed|checksum|anchor/i,
    )
  })

  it("keeps the batch-qualified API route path-closed and catalog-aware", async () => {
    const derivedRouteRoot = new URL(
      "../app/api/dev/atmoshaper-candidates/derived/",
      import.meta.url,
    )
    const routeDirectories = (await readdir(derivedRouteRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("["))
      .map(({ name }) => name)
    assert.deepEqual(routeDirectories, ["[batchOrOutputIdentity]"])
    const compatibilityRoute = await readFile(new URL(
      "../app/api/dev/atmoshaper-candidates/derived/[batchOrOutputIdentity]/route.ts",
      import.meta.url,
    ), "utf8")
    const routeUrl = new URL(
      "../app/api/dev/atmoshaper-candidates/derived/[batchOrOutputIdentity]/[outputIdentity]/route.ts",
      import.meta.url,
    )
    assert.equal(existsSync(routeUrl), true, "Batch-qualified derived-audio route must exist")
    const route = await readFile(routeUrl, "utf8")
    assert.match(compatibilityRoute, /batchOrOutputIdentity/)
    assert.match(compatibilityRoute, /outputIdentity:\s*\(await context\.params\)\.batchOrOutputIdentity/)
    assert.match(route, /NODE_ENV\s*===\s*["']production["']/)
    assert.match(route, /ATMOSHAPER_SIGNATURE_DERIVED_CATALOG_ROOT/)
    assert.match(route, /ATMOSHAPER_SIGNATURE_DERIVED_ROOT/)
    assert.match(route, /loadDevSignatureDerivedCatalogBatch/)
    assert.match(route, /batchId:\s*params\.batchOrOutputIdentity/)
    assert.match(route, /outputIdentity/)
    assert.match(route, /signature-sound-derived-audio-batch-registry\.json/)
    assert.match(route, /signature-sound-derived-audio-manifests\.json/)
    assert.match(route, /signature-sound-derived-audio-batch-04-boiling-water-edit-audition\.json/)
    assert.match(route, /validateSignatureSoundEditAuditionManifest/)
    assert.match(route, /batch-03-sci-fi-whistles-treatment-audition-v2/)
    assert.match(route, /batch-04-boiling-water-edit-audition-v2/)
    assert.match(route, /signature-sound-derived-audio-batch-05-dryer-trim-audition\.json/)
    assert.match(route, /batch-05-dryer-trim-audition/)
    assert.doesNotMatch(route, /searchParams\.get\s*\(/)
    assert.doesNotMatch(route, /(?:root|path)\s*:\s*\(await context\.params\)/)
    assert.match(route, /Accept-Ranges/)
  })

  it("selects the one checksum-matching manifest anchor for the configured batch root", async (context) => {
    const { loadDevSignatureDerivedManifestSnapshot } = await import("../lib/atmoshaper/dev-derived-audio.js")
    const root = await mkdtemp(join(tmpdir(), "atmoshaper-dev-derived-manifest-"))
    context.after(() => rm(root, { recursive: true, force: true }))
    const manifest = { version: 1, batchId: "batch-02-air-traffic-control", outputs: [] }
    const bytes = Buffer.from(`${JSON.stringify(manifest)}\n`)
    await writeFile(join(root, "batch-manifest.json"), bytes)
    const matching = {
      batchId: manifest.batchId,
      manifestRelativePath: "batch-manifest.json",
      manifestSha256: createHash("sha256").update(bytes).digest("hex"),
      state: "rendered-pending-audible-qa",
    }
    const snapshot = await loadDevSignatureDerivedManifestSnapshot({
      outputRoot: root,
      manifestEntries: [{ ...matching, batchId: "wrong", manifestSha256: "f".repeat(64) }, matching],
      nodeEnv: "development",
    })

    assert.deepEqual(snapshot.manifest, manifest)
    assert.deepEqual(snapshot.manifestEntry, matching)
  })

  it("serves only exact manifest-listed bytes beneath the configured root", async (context) => {
    const root = await mkdtemp(join(tmpdir(), "atmoshaper-dev-derived-"))
    context.after(() => rm(root, { recursive: true, force: true }))
    await mkdir(join(root, "campfire"))
    const bytes = Buffer.from("derived wav bytes")
    await writeFile(join(root, "campfire", "artifact.wav"), bytes)
    const resolved = await resolveDevSignatureDerivedAudio({
      outputIdentity: "a".repeat(64),
      manifest: manifestFor(bytes),
      outputRoot: root,
      nodeEnv: "development",
    })
    assert.deepEqual(resolved.bytes, bytes)
    assert.equal(resolved.byteSize, bytes.length)
    assert.equal(resolved.mimeType, "audio/wav")
  })

  it("fails closed in production and on unknown, escaping, duplicate, or changed artifacts", async (context) => {
    const root = await mkdtemp(join(tmpdir(), "atmoshaper-dev-derived-reject-"))
    context.after(() => rm(root, { recursive: true, force: true }))
    await mkdir(join(root, "campfire"))
    const bytes = Buffer.from("derived wav bytes")
    await writeFile(join(root, "campfire", "artifact.wav"), bytes)
    const base = {
      outputIdentity: "a".repeat(64),
      manifest: manifestFor(bytes),
      outputRoot: root,
      nodeEnv: "development",
    }
    await assert.rejects(resolveDevSignatureDerivedAudio({ ...base, nodeEnv: "production" }), /production/i)
    await assert.rejects(resolveDevSignatureDerivedAudio({ ...base, outputIdentity: "b".repeat(64) }), /unknown/i)
    await assert.rejects(resolveDevSignatureDerivedAudio({ ...base, manifest: { version: 1, outputs: [...base.manifest.outputs, ...base.manifest.outputs] } }), /duplicate/i)
    await assert.rejects(resolveDevSignatureDerivedAudio({ ...base, manifest: manifestFor(bytes, { outputRelativePath: "../escape.wav" }) }), /relative|outside|path/i)
    await writeFile(join(root, "campfire", "artifact.wav"), Buffer.from("changed wav bytes"))
    await assert.rejects(resolveDevSignatureDerivedAudio(base), /size|content|checksum/i)
  })
})
