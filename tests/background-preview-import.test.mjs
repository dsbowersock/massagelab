import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, it } from "node:test"

import {
  approvedPilotFrameStripUrl,
  copyApprovedPilotMedia,
  resolveApprovedPilotContainedPath,
} from "../scripts/chimer-preview-generation/approved-pilot-import-paths.mjs"

async function createImportFixture(testContext) {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "massagelab-pilot-import-"))
  testContext.after(() => fs.rm(fixtureRoot, { recursive: true, force: true }))
  const sourceDir = path.join(fixtureRoot, "source")
  await fs.mkdir(path.join(sourceDir, "safe"), { recursive: true })
  await fs.writeFile(path.join(sourceDir, "safe", "clip.webm"), "approved media")
  await fs.writeFile(path.join(sourceDir, "safe", "clip.frames.png"), "frame evidence")
  return { fixtureRoot, sourceDir }
}

function entryWithUrls(urls) {
  return [{
    backgroundId: "massage-lab-example",
    renditions: urls.map((url) => ({
      url,
      codec: "vp9",
      bytes: url === "safe/clip.webm" ? Buffer.byteLength("approved media") : 1,
      sha256: url === "safe/clip.webm"
        ? createHash("sha256").update("approved media").digest("hex")
        : "a".repeat(64),
    })),
    posters: {},
  }]
}

describe("approved pilot media import paths", () => {
  it("copies validated media and optional frame evidence below the output root", async (testContext) => {
    const { fixtureRoot, sourceDir } = await createImportFixture(testContext)
    const outputDir = path.join(fixtureRoot, "output")

    copyApprovedPilotMedia(entryWithUrls(["safe/clip.webm"]), { sourceDir, outputDir })

    assert.equal(existsSync(path.join(outputDir, "safe", "clip.webm")), true)
    assert.equal(existsSync(path.join(outputDir, "safe", "clip.frames.png")), true)
  })

  it("rejects unsafe media paths before any earlier valid media can be written", async (testContext) => {
    const { fixtureRoot, sourceDir } = await createImportFixture(testContext)
    const cases = [
      ["traversal", "../outside.webm", /traversal/],
      ["dot segment", "safe/./outside.webm", /traversal/],
      ["empty segment", "safe//outside.webm", /canonical relative POSIX/],
      ["backslash", "safe\\outside.webm", /backslashes/],
      ["absolute URL", "https://example.test/outside.webm", /relative POSIX/],
      ["absolute path", "/outside.webm", /relative POSIX/],
      ["encoded traversal", "safe/%2e%2e/outside.webm", /encoded traversal/],
      ["encoded slash", "safe%2f..%2foutside.webm", /encoded traversal/],
    ]

    for (const [label, unsafeUrl, expectedError] of cases) {
      const outputDir = path.join(fixtureRoot, `output-${label.replaceAll(" ", "-")}`)
      assert.throws(
        () => copyApprovedPilotMedia(entryWithUrls(["safe/clip.webm", unsafeUrl]), { sourceDir, outputDir }),
        expectedError,
        label,
      )
      assert.equal(existsSync(outputDir), false, `${label}: importer wrote before complete path preflight`)
      assert.equal(existsSync(path.join(fixtureRoot, "outside.webm")), false, `${label}: outside media was written`)
    }
  })

  it("rejects same-size corruption before copying any previously verified media", async (testContext) => {
    const { fixtureRoot, sourceDir } = await createImportFixture(testContext)
    const outputDir = path.join(fixtureRoot, "output-corrupt")
    await fs.writeFile(path.join(sourceDir, "safe", "corrupt.webm"), "changed media!")
    const entries = entryWithUrls(["safe/clip.webm"])
    entries[0].posters = {
      landscape: {
        url: "safe/corrupt.webm",
        bytes: Buffer.byteLength("changed media!"),
        sha256: createHash("sha256").update("approved media").digest("hex"),
      },
    }

    assert.throws(
      () => copyApprovedPilotMedia(entries, { sourceDir, outputDir }),
      /approved media is missing or has changed: safe\/corrupt\.webm/,
    )
    assert.equal(existsSync(outputDir), false, "corruption must fail before any copy starts")
  })

  it("rejects an escaping derived frame-strip path before an outside write", async (testContext) => {
    const { fixtureRoot } = await createImportFixture(testContext)
    const outputDir = path.join(fixtureRoot, "output-frame-strip")
    const outsideFrameStrip = path.join(fixtureRoot, "outside.frames.png")

    assert.throws(
      () => approvedPilotFrameStripUrl("../outside.webm", "rendition"),
      /traversal/,
    )
    assert.throws(
      () => resolveApprovedPilotContainedPath(outputDir, "../outside.frames.png", "frame strip output"),
      /traversal/,
    )
    assert.equal(existsSync(outsideFrameStrip), false)
  })

  it("fails explicitly when an approved pilot entry has no canonical catalog batch", async () => {
    const importerSource = await fs.readFile(
      new URL("../scripts/chimer-preview-generation/import-approved-pilot.mjs", import.meta.url),
      "utf8",
    )
    assert.match(importerSource, /const batch = FULL_CATALOG_BATCHES\.find/)
    assert.match(importerSource, /if \(!batch\) throw new Error\(`\$\{entry\.backgroundId\}: approved pilot entry has no catalog batch\.`\)/)
    assert.ok(
      importerSource.indexOf("if (!batch)") < importerSource.indexOf("copyApprovedPilotMedia(sourceManifest.entries"),
      "batch membership fails before media copying",
    )
  })
})
