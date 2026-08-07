import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

import {
  CATALOG_R2_MEDIA_CACHE_CONTROL,
  CATALOG_R2_RELEASE_PREFIX,
  buildCatalogMediaAllowlist,
  createCatalogR2Objects,
  loadCatalogR2PublicationPlan,
  validateCatalogMediaFiles,
} from "../scripts/chimer-preview-generation/catalog-r2-publication.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const uploaderPath = path.join(repoRoot, "scripts/chimer-preview-generation/catalog-r2-upload.mjs")

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

async function createFixture(testContext) {
  const catalogDir = await fs.mkdtemp(path.join(os.tmpdir(), "massagelab-catalog-r2-"))
  testContext.after(() => fs.rm(catalogDir, { recursive: true, force: true }))

  const fileBodies = new Map([
    ["massage-lab-example/recipe-1/landscape/low.webm", Buffer.from("webm media")],
    ["massage-lab-example/recipe-1/landscape/low.mp4", Buffer.from("mp4 media")],
    ["massage-lab-example/recipe-1/landscape/poster.webp", Buffer.from("webp poster")],
  ])

  for (const [relativePath, body] of fileBodies) {
    const filePath = path.join(catalogDir, ...relativePath.split("/"))
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, body)
  }
  // This closely resembles a real local validation artifact, but no catalog
  // field references it. The planner must never discover it by directory scan.
  await fs.writeFile(
    path.join(catalogDir, "massage-lab-example", "recipe-1", "landscape", "validation.json"),
    "diagnostic only",
  )

  const metadata = (relativePath) => {
    const body = fileBodies.get(relativePath)
    return { url: relativePath, bytes: body.length, sha256: sha256(body) }
  }
  const catalog = {
    schemaVersion: 3,
    catalogRevision: "catalog-approved-1",
    entries: [{
      backgroundId: "massage-lab-example",
      reviewStatus: "approved",
      renditions: [
        { ...metadata("massage-lab-example/recipe-1/landscape/low.webm") },
        { ...metadata("massage-lab-example/recipe-1/landscape/low.mp4") },
      ],
      posters: {
        landscape: metadata("massage-lab-example/recipe-1/landscape/poster.webp"),
      },
    }],
  }

  return { catalog, catalogDir }
}

describe("Chimer catalog R2 publication planner", () => {
  it("maps only approved rendition/poster references to immutable fixed-prefix objects", async (testContext) => {
    const { catalog, catalogDir } = await createFixture(testContext)
    const allowlist = buildCatalogMediaAllowlist(catalog)
    await validateCatalogMediaFiles({ catalogDir, media: allowlist })
    const objects = createCatalogR2Objects({
      media: allowlist,
      publicBaseUrl: "https://media.example.test",
    })

    assert.equal(objects.length, 3)
    assert.deepEqual(
      objects.map(({ objectKey }) => objectKey),
      [
        `${CATALOG_R2_RELEASE_PREFIX}/massage-lab-example/recipe-1/landscape/low.mp4`,
        `${CATALOG_R2_RELEASE_PREFIX}/massage-lab-example/recipe-1/landscape/low.webm`,
        `${CATALOG_R2_RELEASE_PREFIX}/massage-lab-example/recipe-1/landscape/poster.webp`,
      ],
    )
    assert.deepEqual(
      objects.map(({ contentType }) => contentType),
      ["video/mp4", "video/webm", "image/webp"],
    )
    assert.ok(objects.every(({ cacheControl }) => cacheControl === CATALOG_R2_MEDIA_CACHE_CONTROL))
    assert.ok(objects.every(({ publicUrl, objectKey }) => publicUrl === `https://media.example.test/${objectKey}`))
    assert.ok(objects.every(({ sourceRelativePath }) => sourceRelativePath !== "massage-lab-example/recipe-1/landscape/validation.json"))
  })

  it("rejects unapproved catalog metadata and unsafe media references", async (testContext) => {
    const { catalog } = await createFixture(testContext)
    const cases = [
      ["candidate entry", (value) => { value.entries[0].reviewStatus = "candidate" }, /not approved/],
      ["non-approved revision", (value) => { value.catalogRevision = "catalog-candidate-1" }, /catalog-approved-1/],
      ["absolute URL", (value) => { value.entries[0].renditions[0].url = "https://example.test/low.webm" }, /relative POSIX path/],
      ["traversal", (value) => { value.entries[0].renditions[0].url = "nested/..\/low.webm" }, /traversal/],
      ["backslashes", (value) => { value.entries[0].renditions[0].url = "nested\\low.webm" }, /backslashes/],
      ["unknown extension", (value) => { value.entries[0].renditions[0].url = "nested/low.json" }, /unsupported extension/],
      ["duplicate paths", (value) => { value.entries[0].renditions[1].url = value.entries[0].renditions[0].url }, /duplicate media path/],
    ]

    for (const [label, mutate, expectedError] of cases) {
      const invalidCatalog = structuredClone(catalog)
      mutate(invalidCatalog)
      assert.throws(() => buildCatalogMediaAllowlist(invalidCatalog), expectedError, label)
    }
  })

  it("rejects missing, byte-mismatched, and hash-mismatched local media before upload", async (testContext) => {
    const { catalog, catalogDir } = await createFixture(testContext)
    const missingCatalog = structuredClone(catalog)
    missingCatalog.entries[0].renditions[0].url = "massage-lab-example/recipe-1/landscape/missing.webm"
    const missingAllowlist = buildCatalogMediaAllowlist(missingCatalog)
    await assert.rejects(
      validateCatalogMediaFiles({ catalogDir, media: missingAllowlist }),
      /missing local media file/,
    )

    const bytesCatalog = structuredClone(catalog)
    bytesCatalog.entries[0].renditions[0].bytes += 1
    await assert.rejects(
      validateCatalogMediaFiles({ catalogDir, media: buildCatalogMediaAllowlist(bytesCatalog) }),
      /byte mismatch/,
    )

    const hashCatalog = structuredClone(catalog)
    hashCatalog.entries[0].renditions[0].sha256 = "0".repeat(64)
    await assert.rejects(
      validateCatalogMediaFiles({ catalogDir, media: buildCatalogMediaAllowlist(hashCatalog) }),
      /SHA-256 mismatch/,
    )
  })

  it("enforces the exact release object contract before local upload validation", async (testContext) => {
    const { catalog, catalogDir } = await createFixture(testContext)
    const catalogPath = path.join(catalogDir, "index.json")
    await fs.writeFile(catalogPath, `${JSON.stringify(catalog)}\n`)

    await assert.rejects(
      loadCatalogR2PublicationPlan({ catalogPath }),
      /must reference exactly 1728 objects/,
    )
  })

  it("rejects arbitrary catalog object-prefix overrides before any upload action", () => {
    const result = spawnSync(process.execPath, [
      uploaderPath,
      "upload",
      "--dry-run",
      "--object-prefix",
      "unapproved-prefix",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 30_000,
      env: {
        ...process.env,
        R2_ACCESS_KEY_ID: "",
        R2_SECRET_ACCESS_KEY: "",
      },
    })

    assert.equal(result.error, undefined, `uploader failed to run: ${result.error?.message}`)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /catalog release prefix is fixed/i)
  })
})
