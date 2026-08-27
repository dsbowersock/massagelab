import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

import { validateSignatureSoundDiscoveryReview } from "../lib/atmoshaper/signature-sound-discovery.js"
import { validateSignatureSoundListeningReview } from "../lib/atmoshaper/signature-sound-listening-review.js"
import {
  createSignatureSoundReviewProjection,
  validateSignatureSoundReviewWorkspace,
} from "../lib/atmoshaper/signature-sound-review-workspace.js"
import { runSignatureSoundConstructionReviewCli } from "../scripts/atmoshaper-signature-sound-construction-review.mjs"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const fixtureRoot = join(repoRoot, "tests", "fixtures", "atmoshaper")
const outputRelativePath = "data/atmoshaper/signature-sound-construction-review.json"

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"))
}

function compareText(left, right) {
  return left.toLowerCase().localeCompare(right.toLowerCase(), "en") || left.localeCompare(right, "en")
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort(compareText).map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

async function createInputs() {
  const [moodistConcepts, rawDiscovery, strategyPolicy, rawListening, exportedListeningReview, rawWorkspace] = await Promise.all([
    readJson(join(repoRoot, "data/atmoshaper/moodist-concepts.json")),
    readJson(join(repoRoot, "data/atmoshaper/signature-sound-review.json")),
    readJson(join(repoRoot, "data/atmoshaper/signature-sound-playback-strategies.json")),
    readJson(join(repoRoot, "data/atmoshaper/signature-sound-listening-review.json")),
    readJson(join(fixtureRoot, "signature-listening-review-v1-a22a9d19d8.json")),
    readJson(join(fixtureRoot, "signature-complete-review-v3-a22a9d19d8.json")),
  ])
  const discoveryReview = validateSignatureSoundDiscoveryReview(rawDiscovery, moodistConcepts)
  const listeningReview = validateSignatureSoundListeningReview(rawListening, {
    discoveryReview,
    moodistConcepts,
    exportedReview: exportedListeningReview,
    strategyPolicy,
  })
  const baselines = { discoveryReview, curatedReview: listeningReview }
  const workspace = validateSignatureSoundReviewWorkspace(rawWorkspace, baselines)
  const projection = createSignatureSoundReviewProjection(workspace, baselines)
  const resolutions = []
  const dispositions = []
  for (const group of projection.groups) {
    const notes = [
      ...(group.note.trim() === "" ? [] : [{ scope: "group", sourceId: null, note: group.note, decision: group.decision }]),
      ...group.ingredients.filter(({ note }) => note.trim() !== "").map((ingredient) => ({
        scope: "ingredient",
        sourceId: ingredient.sourceId,
        note: ingredient.note,
        decision: ingredient.decision,
      })),
    ]
    for (const note of notes) {
      const id = `note-${sha256(stableJson({
        scope: note.scope,
        groupId: group.groupId,
        sourceId: note.sourceId,
        originalNote: note.note,
      }))}`
      const resolutionId = `resolution-${id.slice(5)}`
      const removed = note.decision === "remove"
      resolutions.push(removed ? {
        id: resolutionId,
        type: "no-assignment",
        groupId: group.groupId,
        sourceId: note.sourceId,
        reason: "source-removed-from-concept",
      } : {
        id: resolutionId,
        type: "processing-intent",
        groupId: group.groupId,
        sourceId: note.sourceId,
        intentKind: "normalize-relative-level",
        desiredOutcome: "Fixture audible outcome.",
        state: "required",
        choiceSetId: null,
        qa: "audible-qa-required",
      })
      dispositions.push({
        id,
        scope: note.scope,
        groupId: group.groupId,
        sourceId: note.sourceId,
        originalNote: note.note,
        classification: removed ? "removed-source-observation" : "audio-processing",
        resolutionIds: [resolutionId],
        state: "structured",
      })
    }
  }
  return {
    canonicalInputs: {
      moodistConcepts,
      discoveryReview,
      listeningReview,
      strategyPolicy,
      interpretations: {
        version: 1,
        fingerprints: {
          discoveryReviewSha256: discoveryReview.fingerprints.reviewSha256,
          curationSha256: listeningReview.fingerprints.curationSha256,
          workspaceSha256: sha256(stableJson(workspace)),
        },
        resolutions,
        dispositions,
      },
    },
    exportedListeningPath: join(fixtureRoot, "signature-listening-review-v1-a22a9d19d8.json"),
    workspacePath: join(fixtureRoot, "signature-complete-review-v3-a22a9d19d8.json"),
  }
}

async function createTempRepo(t) {
  const root = await mkdtemp(join(tmpdir(), "ml-signature-construction-repo-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

function runOptions(inputs, root, overrides = {}) {
  return {
    args: [inputs.exportedListeningPath, inputs.workspacePath],
    repoRoot: root,
    canonicalInputs: inputs.canonicalInputs,
    stdout: () => {},
    ...overrides,
  }
}

describe("AtmoShaper Signature construction-review CLI", () => {
  it("renders deterministic path-free JSON or Markdown and writes nothing by default", async (t) => {
    const inputs = await createInputs()
    const root = await createTempRepo(t)
    let json = ""
    assert.equal(await runSignatureSoundConstructionReviewCli(runOptions(inputs, root, {
      stdout: (value) => { json += value },
    })), 0)
    assert.equal(JSON.parse(json).summary.noteDispositionCount, 38)
    assert.deepEqual(await readdir(root), [])
    assert.doesNotMatch(json, /[A-Z]:\\|signature-complete-review/i)

    let markdown = ""
    assert.equal(await runSignatureSoundConstructionReviewCli(runOptions(inputs, root, {
      args: [inputs.exportedListeningPath, inputs.workspacePath, "--format", "markdown"],
      stdout: (value) => { markdown += value },
    })), 0)
    assert.match(markdown, /38 note dispositions/)
    assert.deepEqual(await readdir(root), [])
  })

  it("rejects incomplete, swapped, extra, unknown, malformed, or path-leaking arguments", async (t) => {
    const inputs = await createInputs()
    const root = await createTempRepo(t)
    const cases = [
      [],
      [inputs.exportedListeningPath],
      [inputs.workspacePath, inputs.exportedListeningPath],
      [inputs.exportedListeningPath, inputs.workspacePath, "extra.json"],
      [inputs.exportedListeningPath, inputs.workspacePath, "--wat"],
      [inputs.exportedListeningPath, inputs.workspacePath, "--format", "yaml"],
      [inputs.exportedListeningPath, inputs.workspacePath, "--output", resolve(root, outputRelativePath)],
      [inputs.exportedListeningPath, inputs.workspacePath, "--output", "../escape.json"],
      [inputs.exportedListeningPath, inputs.workspacePath, "--output", "data/atmoshaper/other.json"],
    ]
    for (const args of cases) {
      await assert.rejects(runSignatureSoundConstructionReviewCli(runOptions(inputs, root, { args })), (error) => {
        assert.doesNotMatch(error.message, new RegExp(root.replaceAll("\\", "\\\\"), "i"))
        return true
      })
    }
    const invalidPath = join(root, "invalid.json")
    await writeFile(invalidPath, "not json")
    await assert.rejects(runSignatureSoundConstructionReviewCli(runOptions(inputs, root, {
      args: [invalidPath, inputs.workspacePath],
    })), /could not load the exported listening review/i)

    const stalePath = join(root, "stale.json")
    const stale = await readJson(inputs.exportedListeningPath)
    stale.reviewFingerprint = "0".repeat(64)
    await writeFile(stalePath, JSON.stringify(stale))
    await assert.rejects(runSignatureSoundConstructionReviewCli(runOptions(inputs, root, {
      args: [stalePath, inputs.workspacePath, "--output", outputRelativePath],
    })), /fingerprint does not match/i)
    await assert.rejects(readFile(join(root, ...outputRelativePath.split("/"))), /ENOENT/)
  })

  it("publishes only the fixed owner, rereads it, and preserves an existing owner on failure", async (t) => {
    const inputs = await createInputs()
    const root = await createTempRepo(t)
    const destination = join(root, ...outputRelativePath.split("/"))
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, "sentinel")
    let stdout = ""
    assert.equal(await runSignatureSoundConstructionReviewCli(runOptions(inputs, root, {
      args: [inputs.exportedListeningPath, inputs.workspacePath, "--output", outputRelativePath],
      stdout: (value) => { stdout += value },
    })), 0)
    assert.equal(await readFile(destination, "utf8"), stdout)

    await writeFile(destination, "preserve-me")
    const staleInputs = structuredClone(inputs)
    staleInputs.canonicalInputs.interpretations.fingerprints.workspaceSha256 = "0".repeat(64)
    await assert.rejects(runSignatureSoundConstructionReviewCli(runOptions(staleInputs, root, {
      args: [inputs.exportedListeningPath, inputs.workspacePath, "--output", outputRelativePath],
    })), /workspace fingerprint/i)
    assert.equal(await readFile(destination, "utf8"), "preserve-me")

    await assert.rejects(runSignatureSoundConstructionReviewCli(runOptions(inputs, root, {
      args: [inputs.exportedListeningPath, inputs.workspacePath, "--output", outputRelativePath],
      readPublishedFile: async () => "{}",
    })), /could not publish/i)
    assert.equal(await readFile(destination, "utf8"), "preserve-me")
    assert.deepEqual((await readdir(dirname(destination))).sort(), ["signature-sound-construction-review.json"])
  })

  it("rolls back an injected rename failure without transaction residue", async (t) => {
    const inputs = await createInputs()
    const root = await createTempRepo(t)
    const destination = join(root, ...outputRelativePath.split("/"))
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, "original")
    let calls = 0
    await assert.rejects(runSignatureSoundConstructionReviewCli(runOptions(inputs, root, {
      args: [inputs.exportedListeningPath, inputs.workspacePath, "--output", outputRelativePath],
      renameFile: async (source, target) => {
        calls += 1
        if (calls === 2) throw new Error("injected")
        const { rename } = await import("node:fs/promises")
        await rename(source, target)
      },
    })), /could not publish/i)
    assert.equal(await readFile(destination, "utf8"), "original")
    assert.deepEqual((await readdir(dirname(destination))).sort(), ["signature-sound-construction-review.json"])
  })

  it("rejects a fixed destination whose existing parent resolves outside the repository", async (t) => {
    const inputs = await createInputs()
    const root = await createTempRepo(t)
    const outside = await mkdtemp(join(tmpdir(), "ml-signature-construction-outside-"))
    t.after(() => rm(outside, { recursive: true, force: true }))
    await mkdir(join(root, "data"), { recursive: true })
    try {
      await symlink(outside, join(root, "data", "atmoshaper"), process.platform === "win32" ? "junction" : "dir")
    } catch (error) {
      if (["EPERM", "EACCES"].includes(error.code)) return t.skip(`directory links unavailable: ${error.code}`)
      throw error
    }
    await assert.rejects(runSignatureSoundConstructionReviewCli(runOptions(inputs, root, {
      args: [inputs.exportedListeningPath, inputs.workspacePath, "--output", outputRelativePath],
    })), /inside the current repository or worktree/i)
    assert.deepEqual(await readdir(outside), [])
  })

  it("rejects an existing output-file link to an outside file when the host permits it", async (t) => {
    const inputs = await createInputs()
    const root = await createTempRepo(t)
    const outside = await mkdtemp(join(tmpdir(), "ml-signature-construction-file-outside-"))
    t.after(() => rm(outside, { recursive: true, force: true }))
    const sentinel = join(outside, "sentinel.json")
    await writeFile(sentinel, "outside")
    const destination = join(root, ...outputRelativePath.split("/"))
    await mkdir(dirname(destination), { recursive: true })
    try {
      await symlink(sentinel, destination, "file")
    } catch (error) {
      if (["EPERM", "EACCES"].includes(error.code)) return t.skip(`file links unavailable: ${error.code}`)
      throw error
    }
    await assert.rejects(runSignatureSoundConstructionReviewCli(runOptions(inputs, root, {
      args: [inputs.exportedListeningPath, inputs.workspacePath, "--output", outputRelativePath],
    })), /inside the current repository or worktree/i)
    assert.equal(await readFile(sentinel, "utf8"), "outside")
  })

  it("provides the named repository command", async () => {
    const packageJson = await readJson(join(repoRoot, "package.json"))
    assert.equal(
      packageJson.scripts["atmoshaper:sounds:reconcile-review"],
      "node scripts/atmoshaper-signature-sound-construction-review.mjs",
    )
  })
})
