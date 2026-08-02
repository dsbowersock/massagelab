import assert from "node:assert/strict"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const uploaderPath = path.join(repoRoot, "scripts/chimer-preview-generation/upload-r2.mjs")
const previewDir = path.join(repoRoot, "public/chimer/background-previews")
const backgroundIds = ["massage-lab-dna", "massage-lab-twisted-cubes"]
const suffixes = ["", "-square", "-vertical"]
const dryRunSummaryPrefix = "MASSAGELAB_R2_DRY_RUN_SUMMARY="
const expectedCacheControl = "public, max-age=300, must-revalidate"
const expectedMedia = backgroundIds.flatMap((id) => (
  suffixes.flatMap((suffix) => [`${id}${suffix}.webm`, `${id}${suffix}.webp`])
))

describe("Chimer preview R2 uploader", () => {
  it("selects all DNA/Cubes videos, posters, and index metadata in a mutation-free dry run", () => {
    const result = spawnSync(process.execPath, [
      uploaderPath,
      "upload",
      "--dry-run",
      "--input-dir", previewDir,
      "--public-base-url", "https://media.example.test",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 30_000,
      env: {
        ...process.env,
        MASSAGELAB_PUBLIC_MEDIA_R2_ACCESS_KEY_ID: "",
        MASSAGELAB_PUBLIC_MEDIA_R2_SECRET_ACCESS_KEY: "",
        MASSAGELAB_PUBLIC_MEDIA_METADATA_CACHE_CONTROL: expectedCacheControl,
      },
    })

    assert.equal(result.error, undefined, `uploader failed to run: ${result.error?.message}`)
    assert.equal(
      result.status,
      0,
      `uploader exited non-zero (signal: ${result.signal ?? "none"}). stderr: ${result.stderr ?? "<empty>"}`,
    )
    const summaryLine = result.stdout.split(/\r?\n/)
      .find((line) => line.startsWith(dryRunSummaryPrefix))
    assert.ok(
      summaryLine,
      `missing "${dryRunSummaryPrefix}" line. stdout: ${result.stdout || "<empty>"}`,
    )
    const summary = JSON.parse(summaryLine.slice(dryRunSummaryPrefix.length))
    assert.equal(summary.dryRun, true)
    const selectedObjects = summary.objects.filter(({ objectKey }) => {
      const name = path.basename(objectKey)
      return name === "index.json" || backgroundIds.some((id) => name.startsWith(id))
    })
    assert.equal(selectedObjects.length, expectedMedia.length + 1)
    assert.deepEqual(
      selectedObjects.map(({ objectKey }) => path.basename(objectKey)).sort(),
      [...expectedMedia, "index.json"].sort(),
    )

    const contentTypes = Object.fromEntries(
      selectedObjects.map(({ objectKey, contentType }) => [path.basename(objectKey), contentType]),
    )
    const cacheControls = Object.fromEntries(
      selectedObjects.map(({ objectKey, cacheControl }) => [path.basename(objectKey), cacheControl]),
    )
    for (const name of expectedMedia) {
      assert.equal(contentTypes[name], name.endsWith(".webp") ? "image/webp" : "video/webm")
      assert.equal(
        cacheControls[name],
        expectedCacheControl,
      )
    }
    assert.equal(contentTypes["index.json"], "application/json; charset=utf-8")
    assert.equal(cacheControls["index.json"], expectedCacheControl)
    assert.doesNotMatch(result.stdout, /Uploaded/)
  })
})
