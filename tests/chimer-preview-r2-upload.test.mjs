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
      env: {
        ...process.env,
        MASSAGELAB_PUBLIC_MEDIA_R2_ACCESS_KEY_ID: "",
        MASSAGELAB_PUBLIC_MEDIA_R2_SECRET_ACCESS_KEY: "",
      },
    })

    assert.equal(result.status, 0, result.stderr)
    const json = result.stdout.match(/\{\s*"dryRun": true[\s\S]*$/)?.[0]
    assert.ok(json, result.stdout)
    const summary = JSON.parse(json)
    assert.equal(summary.dryRun, true)
    assert.equal(summary.objectCount, expectedMedia.length + 1)
    assert.deepEqual(
      summary.objects.map(({ objectKey }) => path.basename(objectKey)).sort(),
      [...expectedMedia, "index.json"].sort(),
    )

    const contentTypes = Object.fromEntries(
      summary.objects.map(({ objectKey, contentType }) => [path.basename(objectKey), contentType]),
    )
    for (const name of expectedMedia) {
      assert.equal(contentTypes[name], name.endsWith(".webp") ? "image/webp" : "video/webm")
    }
    assert.equal(contentTypes["index.json"], "application/json; charset=utf-8")
    assert.doesNotMatch(result.stdout, /Uploaded/)
  })
})
