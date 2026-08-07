import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
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
  readCatalogMediaSnapshot,
  validateCatalogMediaFiles,
} from "../scripts/chimer-preview-generation/catalog-r2-publication.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const uploaderPath = path.join(repoRoot, "scripts/chimer-preview-generation/catalog-r2-upload.mjs")
const realCatalogPath = path.join(repoRoot, "public/chimer/background-preview-catalog/index.json")
const CHILD_UPLOADER_PUBLIC_MEDIA_ENV_KEYS = [
  "CLOUDFLARE_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "MASSAGELAB_PUBLIC_MEDIA_R2_ENDPOINT",
  "MASSAGELAB_R2_ENDPOINT",
  "MASSAGELAB_PUBLIC_MEDIA_PUBLIC_BASE_URL",
  "MASSAGELAB_PUBLIC_MEDIA_BUCKET",
]

/** Clears every inherited public-media setting before a child uploader test. */
function childUploaderEnv(overrides = {}, inheritedEnv = process.env) {
  const env = { ...inheritedEnv }
  for (const key of CHILD_UPLOADER_PUBLIC_MEDIA_ENV_KEYS) delete env[key]
  return { ...env, ...overrides }
}

/**
 * The tracked catalog index is not proof that its 862 MB ignored media payload
 * exists. CI must never infer this publication gate from metadata alone.
 */
function realCatalogMediaAvailable() {
  if (!existsSync(realCatalogPath)) return false
  try {
    const catalog = JSON.parse(readFileSync(realCatalogPath, "utf8"))
    const referencedUrls = catalog.entries.flatMap((entry) => [
      ...entry.renditions.map((rendition) => rendition.url),
      ...Object.values(entry.posters).map((poster) => poster.url),
    ])
    return referencedUrls.length === 1_728 && referencedUrls.every((relativePath) =>
      typeof relativePath === "string"
        && existsSync(path.join(path.dirname(realCatalogPath), ...relativePath.split("/"))))
  } catch {
    return false
  }
}

const runRealCatalogDryRun = process.env.MASSAGELAB_RUN_REAL_CATALOG_R2_DRY_RUN === "1"
  && realCatalogMediaAvailable()

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
    ["massage-lab-example/recipe-1/square/poster.webp", Buffer.from("square webp poster")],
    ["massage-lab-example/recipe-1/vertical/poster.webp", Buffer.from("vertical webp poster")],
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
        square: metadata("massage-lab-example/recipe-1/square/poster.webp"),
        vertical: metadata("massage-lab-example/recipe-1/vertical/poster.webp"),
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

    assert.equal(CATALOG_R2_RELEASE_PREFIX, "chimer/background-preview-catalog/catalog-approved-1")
    assert.equal(CATALOG_R2_MEDIA_CACHE_CONTROL, "public, max-age=31536000, immutable")
    assert.equal(objects.length, 5)
    assert.deepEqual(
      objects.map(({ objectKey }) => objectKey),
      [
        `${CATALOG_R2_RELEASE_PREFIX}/massage-lab-example/recipe-1/landscape/low.mp4`,
        `${CATALOG_R2_RELEASE_PREFIX}/massage-lab-example/recipe-1/landscape/low.webm`,
        `${CATALOG_R2_RELEASE_PREFIX}/massage-lab-example/recipe-1/landscape/poster.webp`,
        `${CATALOG_R2_RELEASE_PREFIX}/massage-lab-example/recipe-1/square/poster.webp`,
        `${CATALOG_R2_RELEASE_PREFIX}/massage-lab-example/recipe-1/vertical/poster.webp`,
      ],
    )
    assert.deepEqual(
      objects.map(({ contentType }) => contentType),
      ["video/mp4", "video/webm", "image/webp", "image/webp", "image/webp"],
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
      ["missing poster", (value) => { delete value.entries[0].posters.square }, /exactly landscape, square, and vertical posters/],
      ["extra poster", (value) => { value.entries[0].posters.wide = value.entries[0].posters.square }, /exactly landscape, square, and vertical posters/],
      ["renamed poster", (value) => { value.entries[0].posters.portrait = value.entries[0].posters.vertical; delete value.entries[0].posters.vertical }, /exactly landscape, square, and vertical posters/],
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

  it("reads the exact manifest-hashed bytes that a live uploader can send", async (testContext) => {
    const { catalog, catalogDir } = await createFixture(testContext)
    const [validatedMedia] = await validateCatalogMediaFiles({
      catalogDir,
      media: buildCatalogMediaAllowlist(catalog),
    })

    const snapshot = await readCatalogMediaSnapshot(validatedMedia)
    assert.equal(sha256(snapshot), validatedMedia.sha256)

    await fs.writeFile(validatedMedia.sourcePath, "different bytes after preflight")
    await assert.rejects(
      readCatalogMediaSnapshot(validatedMedia),
      /byte mismatch|SHA-256 mismatch/,
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
      env: childUploaderEnv(),
    })

    assert.equal(result.error, undefined, `uploader failed to run: ${result.error?.message}`)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /catalog release prefix is fixed/i)
  })

  it("rejects insecure and direct R2 public base URLs before any upload action", () => {
    const cases = [
      ["http CLI option", ["--public-base-url", "http://media.example.test"], {}, /https/i],
      ["http environment", [], { MASSAGELAB_PUBLIC_MEDIA_PUBLIC_BASE_URL: "http://media.example.test" }, /https/i],
      ["r2.dev apex", ["--public-base-url", "https://r2.dev"], {}, /r2\.dev/i],
      ["r2.dev subdomain", ["--public-base-url", "https://preview.r2.dev"], {}, /r2\.dev/i],
      ["r2.dev trailing-dot subdomain", ["--public-base-url", "https://preview.r2.dev."], {}, /r2\.dev/i],
    ]

    for (const [label, extraArgs, extraEnv, expectedError] of cases) {
      const result = spawnSync(process.execPath, [
        uploaderPath,
        "upload",
        "--dry-run",
        ...extraArgs,
      ], {
        cwd: repoRoot,
        encoding: "utf8",
        timeout: 30_000,
        env: childUploaderEnv(extraEnv),
      })

      assert.equal(result.error, undefined, `${label}: uploader failed to run: ${result.error?.message}`)
      assert.equal(result.status, 1, `${label}: stdout: ${result.stdout}`)
      assert.match(result.stderr, expectedError, `${label}: stderr: ${result.stderr}`)
    }
  })

  it("clears an inherited hostile bucket before asserting the uploader dry-run default", () => {
    const env = childUploaderEnv({}, {
      PATH: process.env.PATH,
      MASSAGELAB_PUBLIC_MEDIA_BUCKET: "hostile-inherited-bucket",
    })
    assert.equal(env.MASSAGELAB_PUBLIC_MEDIA_BUCKET, undefined)
    assert.equal(env.PATH, process.env.PATH)
  })

  it("runs the exact credential-free dry run when the ignored catalog is available", {
    skip: !runRealCatalogDryRun,
  }, () => {
    const result = spawnSync(process.execPath, [
      uploaderPath,
      "upload",
      "--dry-run",
      "--public-base-url",
      "https://media.massagelab.app",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 60_000,
      env: childUploaderEnv({}, {
        ...process.env,
        MASSAGELAB_PUBLIC_MEDIA_BUCKET: "hostile-inherited-bucket",
      }),
    })

    assert.equal(result.error, undefined, `uploader failed to run: ${result.error?.message}`)
    assert.equal(result.status, 0, `dry run failed: ${result.stderr}`)
    const summaryLine = result.stdout.split(/\r?\n/)
      .find((line) => line.startsWith("MASSAGELAB_CATALOG_R2_DRY_RUN_SUMMARY="))
    assert.ok(summaryLine, `missing dry-run summary: ${result.stdout}`)
    assert.deepEqual(
      JSON.parse(summaryLine.slice("MASSAGELAB_CATALOG_R2_DRY_RUN_SUMMARY=".length)),
      {
        dryRun: true,
        catalogRevision: "catalog-approved-1",
        bucket: "massagelab-public-media",
        publicBaseUrl: "https://media.massagelab.app",
        objectPrefix: CATALOG_R2_RELEASE_PREFIX,
        objectCount: 1_728,
        totalBytes: 862_078_635,
        cacheControl: CATALOG_R2_MEDIA_CACHE_CONTROL,
        uploaded: false,
      },
    )
  })
})
