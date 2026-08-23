import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { spawn } from "node:child_process"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import * as scannerModule from "../lib/atmoshaper/signature-sound-scan.js"
import * as cliModule from "../scripts/atmoshaper-signature-sound-audit.mjs"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const cliPath = join(repoRoot, "scripts/atmoshaper-signature-sound-audit.mjs")
const moodistConcepts = JSON.parse(await readFile(
  join(repoRoot, "data/atmoshaper/moodist-concepts.json"),
  "utf8",
))

function requireExport(module, name) {
  assert.equal(typeof module?.[name], "function", `${name} must be implemented`)
  return module[name]
}

async function createFixture(t, entries = {}) {
  const root = await mkdtemp(join(tmpdir(), "ml-signature-audit-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const [relativePath, contents] of Object.entries(entries)) {
    const destination = join(root, ...relativePath.split("/"))
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, contents)
  }
  return root
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex")
}

function pendingMoodistCandidate(overrides = {}) {
  return {
    id: "waves-signature-candidate",
    moodistConceptId: "waves",
    discoveryPath: "Pack/Tone.WAV",
    evidenceTier: "explicit-pack-cc0",
    evidenceRef: "Pack/LICENSE.txt",
    technicalState: "pending",
    listeningState: "pending",
    processingState: "pending",
    rejectionState: "active",
    rejectionReason: null,
    ...overrides,
  }
}

function extraCandidate(overrides = {}) {
  return {
    id: "cave-room-tone-signature-candidate",
    proposedExtraConceptId: "cave-room-tone",
    proposedExtraConceptName: "Cave Room Tone",
    discoveryPath: "Extra/Cave room tone.ogg",
    evidenceTier: "signature-sitewide-cc0",
    evidenceRef: "https://signaturesounds.org/about-",
    technicalState: "pending",
    listeningState: "pending",
    processingState: "pending",
    rejectionState: "active",
    rejectionReason: null,
    ...overrides,
  }
}

function declaration(...candidates) {
  return { version: 1, candidates }
}

async function runNode(args, options = {}) {
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      cwd: options.cwd ?? repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.once("error", rejectPromise)
    child.once("close", (exitCode) => resolvePromise({ exitCode, stdout, stderr }))
  })
}

describe("Signature sound filesystem scan", () => {
  it("rejects a missing root and a root that is not a directory without leaking either path", async (t) => {
    const scanSignatureSoundRoot = requireExport(scannerModule, "scanSignatureSoundRoot")
    const fixture = await createFixture(t, { "not-a-directory.txt": "nope" })
    const missingRoot = join(fixture, "missing-root")
    const fileRoot = join(fixture, "not-a-directory.txt")

    await assert.rejects(
      scanSignatureSoundRoot(missingRoot),
      (error) => /does not exist/i.test(error.message) && !error.message.includes(missingRoot),
    )
    await assert.rejects(
      scanSignatureSoundRoot(fileRoot),
      (error) => /must be a directory/i.test(error.message) && !error.message.includes(fileRoot),
    )
  })

  it("scans only allowed audio, excludes metadata, normalizes paths, hashes files, and aggregates packs", async (t) => {
    const scanSignatureSoundRoot = requireExport(scannerModule, "scanSignatureSoundRoot")
    const duplicateBytes = Buffer.from("same-audio")
    const root = await createFixture(t, {
      "Z Pack/B.WAV": duplicateBytes,
      "A Pack/nested/a.mp3": duplicateBytes,
      "A Pack/voice.FLAC": "flac-audio",
      "A Pack/loop.OgG": "ogg-audio",
      "A Pack/tape.AIF": "aif-audio",
      "orchestral.aiff": "aiff-audio",
      "Root.M4A": "m4a-audio",
      "tone.AAC": "aac-audio",
      "A Pack/ignored.txt": "not audio",
      "A Pack/._resource-fork.wav": "hidden",
      "A Pack/__MACOSX/hidden.mp3": "hidden",
      "__MACOSX/root-hidden.flac": "hidden",
    })

    const scan = await scanSignatureSoundRoot(root)

    assert.equal(scan.directoryPackCount, 2)
    assert.equal(scan.audioCount, 8)
    assert.equal(scan.totalBytes, [
      duplicateBytes,
      duplicateBytes,
      "flac-audio",
      "ogg-audio",
      "m4a-audio",
      "aac-audio",
      "aif-audio",
      "aiff-audio",
    ].reduce((total, contents) => total + Buffer.byteLength(contents), 0))
    assert.deepEqual(scan.extensionCounts, {
      ".aac": 1,
      ".aif": 1,
      ".aiff": 1,
      ".flac": 1,
      ".m4a": 1,
      ".mp3": 1,
      ".ogg": 1,
      ".wav": 1,
    })
    assert.deepEqual(scan.audioFiles.map(({ relativePath }) => relativePath), [
      "A Pack/loop.OgG",
      "A Pack/nested/a.mp3",
      "A Pack/tape.AIF",
      "A Pack/voice.FLAC",
      "orchestral.aiff",
      "Root.M4A",
      "tone.AAC",
      "Z Pack/B.WAV",
    ])
    assert.equal(scan.audioFiles[0].extension, ".ogg")
    assert.equal(scan.audioFiles[1].sha256, sha256(duplicateBytes))
    assert.deepEqual(scan.duplicateGroups, [{
      sha256: sha256(duplicateBytes),
      relativePaths: ["A Pack/nested/a.mp3", "Z Pack/B.WAV"],
    }])
    assert.doesNotMatch(JSON.stringify(scan), new RegExp(root.replaceAll("\\", "\\\\"), "i"))
  })

  it("returns identical deterministic results regardless of creation order", async (t) => {
    const scanSignatureSoundRoot = requireExport(scannerModule, "scanSignatureSoundRoot")
    const entries = [
      ["B Pack/z.wav", "z"],
      ["A Pack/c.flac", "c"],
      ["A Pack/a.mp3", "a"],
    ]
    const first = await createFixture(t, Object.fromEntries(entries))
    const second = await createFixture(t, Object.fromEntries([...entries].reverse()))

    assert.deepEqual(
      await scanSignatureSoundRoot(first),
      await scanSignatureSoundRoot(second),
    )
  })
})

describe("Signature sound declaration resolution", () => {
  it("resolves declared paths and explicit local CC0 evidence into pending outcomes", async (t) => {
    const createSignatureSoundAudit = requireExport(scannerModule, "createSignatureSoundAudit")
    const root = await createFixture(t, {
      "Pack/Tone.WAV": "wave-audio",
      "Pack/LICENSE.txt": "CC0 1.0 Universal",
      "Extra/Cave room tone.ogg": "cave-audio",
    })

    const audit = await createSignatureSoundAudit({
      rootPath: root,
      moodistConcepts,
      signatureDeclaration: declaration(pendingMoodistCandidate(), extraCandidate()),
    })

    assert.equal(audit.outcomes.qualifiedMoodistMatches.length, 0)
    assert.equal(audit.outcomes.needsAuditionOrProcessing.length, 1)
    assert.equal(audit.outcomes.recordingOrSourceGaps.length, 80)
    assert.equal(audit.outcomes.signatureOnlyConceptCandidates.length, 1)
    const pendingCandidate = audit.outcomes.needsAuditionOrProcessing[0]
    assert.deepEqual({
      conceptId: pendingCandidate.conceptId,
      conceptName: pendingCandidate.conceptName,
      discoveryPath: pendingCandidate.discoveryPath,
      byteSize: pendingCandidate.byteSize,
      sha256: pendingCandidate.sha256,
      technicalState: pendingCandidate.technicalState,
      listeningState: pendingCandidate.listeningState,
      processingState: pendingCandidate.processingState,
      rejectionState: pendingCandidate.rejectionState,
    }, {
      conceptId: "waves",
      conceptName: "Waves",
      discoveryPath: "Pack/Tone.WAV",
      byteSize: Buffer.byteLength("wave-audio"),
      sha256: sha256("wave-audio"),
      technicalState: "pending",
      listeningState: "pending",
      processingState: "pending",
      rejectionState: "active",
    })
    assert.doesNotMatch(JSON.stringify(audit), new RegExp(root.replaceAll("\\", "\\\\"), "i"))
  })

  it("rejects missing discovery paths and case-insensitive ambiguous collisions", async (t) => {
    const createSignatureSoundAudit = requireExport(scannerModule, "createSignatureSoundAudit")
    const buildSignatureSoundAudit = requireExport(scannerModule, "buildSignatureSoundAudit")
    const scanSignatureSoundRoot = requireExport(scannerModule, "scanSignatureSoundRoot")
    const root = await createFixture(t, {
      "Pack/Tone.WAV": "wave-audio",
      "Pack/LICENSE.txt": "CC0 1.0 Universal",
    })
    await assert.rejects(
      createSignatureSoundAudit({
        rootPath: root,
        moodistConcepts,
        signatureDeclaration: declaration(pendingMoodistCandidate({ discoveryPath: "Pack/missing.wav" })),
      }),
      /declared audio path was not found/i,
    )

    const scan = await scanSignatureSoundRoot(root)
    const source = scan.audioFiles[0]
    const collidingPath = "pack/tone.wav"
    const ambiguousScan = {
      ...scan,
      audioCount: 2,
      totalBytes: source.byteSize * 2,
      extensionCounts: { ".wav": 2 },
      audioFiles: [source, { ...source, relativePath: collidingPath }],
      duplicateGroups: [{
        sha256: source.sha256,
        relativePaths: [collidingPath, source.relativePath].sort(),
      }],
    }
    await assert.rejects(
      buildSignatureSoundAudit({
        scan: ambiguousScan,
        evidenceRoot: root,
        moodistConcepts,
        signatureDeclaration: declaration(pendingMoodistCandidate()),
      }),
      /case-insensitive audio path collision/i,
    )
  })

  it("rejects malformed checksums and aggregate invariant drift", async (t) => {
    const buildSignatureSoundAudit = requireExport(scannerModule, "buildSignatureSoundAudit")
    const scanSignatureSoundRoot = requireExport(scannerModule, "scanSignatureSoundRoot")
    const root = await createFixture(t, {
      "Pack/Tone.WAV": "wave-audio",
      "Pack/LICENSE.txt": "CC0 1.0 Universal",
    })
    const scan = await scanSignatureSoundRoot(root)
    const args = {
      evidenceRoot: root,
      moodistConcepts,
      signatureDeclaration: declaration(pendingMoodistCandidate()),
    }

    await assert.rejects(
      buildSignatureSoundAudit({
        ...args,
        scan: { ...scan, audioFiles: [{ ...scan.audioFiles[0], sha256: "not-a-checksum" }] },
      }),
      /checksum/i,
    )
    await assert.rejects(
      buildSignatureSoundAudit({ ...args, scan: { ...scan, audioCount: 99 } }),
      /audio count invariant/i,
    )
  })

  it("requires safe non-audio evidence for explicit packs and the exact sitewide URL", async (t) => {
    const createSignatureSoundAudit = requireExport(scannerModule, "createSignatureSoundAudit")
    const root = await createFixture(t, {
      "Pack/Tone.WAV": "wave-audio",
      "Extra/Cave room tone.ogg": "cave-audio",
      "Pack/note.txt": "origin needs review",
    })
    const auditArgs = { rootPath: root, moodistConcepts }

    await assert.rejects(
      createSignatureSoundAudit({
        ...auditArgs,
        signatureDeclaration: declaration(pendingMoodistCandidate()),
      }),
      /evidence file was not found/i,
    )
    await assert.rejects(
      createSignatureSoundAudit({
        ...auditArgs,
        signatureDeclaration: declaration(pendingMoodistCandidate({ evidenceRef: "Pack/Tone.WAV" })),
      }),
      /evidence must be a non-audio file/i,
    )
    await assert.rejects(
      createSignatureSoundAudit({
        ...auditArgs,
        signatureDeclaration: declaration(extraCandidate({ evidenceRef: "https://signaturesounds.org/about" })),
      }),
      /exact Signature Sounds sitewide CC0 URL/i,
    )
    await assert.doesNotReject(createSignatureSoundAudit({
      ...auditArgs,
      signatureDeclaration: declaration(pendingMoodistCandidate({
        evidenceTier: "needs-origin-review",
        evidenceRef: "Pack/note.txt",
      })),
    }))
  })
})

describe("Signature sound deterministic reports", () => {
  it("fingerprints validated inventories deterministically and detects scan or declaration changes", async (t) => {
    const createSignatureSoundAudit = requireExport(scannerModule, "createSignatureSoundAudit")
    const firstRoot = await createFixture(t, { "Pack/Tone.wav": "first-bytes" })
    const byteChangedRoot = await createFixture(t, { "Pack/Tone.wav": "changed-bytes" })
    const pathChangedRoot = await createFixture(t, { "Pack/Renamed.wav": "first-bytes" })

    const first = await createSignatureSoundAudit({
      rootPath: firstRoot,
      moodistConcepts,
      signatureDeclaration: declaration(),
    })
    const repeated = await createSignatureSoundAudit({
      rootPath: firstRoot,
      moodistConcepts,
      signatureDeclaration: declaration(),
    })
    const byteChanged = await createSignatureSoundAudit({
      rootPath: byteChangedRoot,
      moodistConcepts,
      signatureDeclaration: declaration(),
    })
    const pathChanged = await createSignatureSoundAudit({
      rootPath: pathChangedRoot,
      moodistConcepts,
      signatureDeclaration: declaration(),
    })

    assert.ok(first.fingerprints, "audit must expose freshness fingerprints")
    assert.ok(repeated.fingerprints, "repeated audit must expose freshness fingerprints")
    assert.deepEqual(first.fingerprints, repeated.fingerprints)
    assert.deepEqual(Object.keys(first.fingerprints), [
      "scanAudioInventorySha256",
      "moodistInventorySha256",
      "signatureDeclarationSha256",
    ])
    for (const fingerprint of Object.values(first.fingerprints)) {
      assert.match(fingerprint, /^[a-f0-9]{64}$/)
    }
    assert.notEqual(
      first.fingerprints.scanAudioInventorySha256,
      byteChanged.fingerprints.scanAudioInventorySha256,
    )
    assert.notEqual(
      first.fingerprints.scanAudioInventorySha256,
      pathChanged.fingerprints.scanAudioInventorySha256,
    )

    const declaredRoot = await createFixture(t, { "Extra/Cave room tone.ogg": "cave-audio" })
    const originalDeclaration = await createSignatureSoundAudit({
      rootPath: declaredRoot,
      moodistConcepts,
      signatureDeclaration: declaration(extraCandidate()),
    })
    const changedDeclaration = await createSignatureSoundAudit({
      rootPath: declaredRoot,
      moodistConcepts,
      signatureDeclaration: declaration(extraCandidate({ id: "alternate-cave-room-tone-candidate" })),
    })
    assert.notEqual(
      originalDeclaration.fingerprints.signatureDeclarationSha256,
      changedDeclaration.fingerprints.signatureDeclarationSha256,
    )
    assert.equal(
      originalDeclaration.fingerprints.scanAudioInventorySha256,
      changedDeclaration.fingerprints.scanAudioInventorySha256,
    )
    assert.equal(
      originalDeclaration.fingerprints.moodistInventorySha256,
      changedDeclaration.fingerprints.moodistInventorySha256,
    )
  })

  it("renders all four lists, category gaps, candidate evidence, hashes, sizes, and gate states", async (t) => {
    const createSignatureSoundAudit = requireExport(scannerModule, "createSignatureSoundAudit")
    const renderSignatureSoundAuditJson = requireExport(scannerModule, "renderSignatureSoundAuditJson")
    const renderSignatureSoundAuditMarkdown = requireExport(scannerModule, "renderSignatureSoundAuditMarkdown")
    const root = await createFixture(t, {
      "Pack/Tone.WAV": "wave-audio",
      "Pack/LICENSE.txt": "CC0 1.0 Universal",
      "Extra/Cave room tone.ogg": "cave-audio",
    })
    const audit = await createSignatureSoundAudit({
      rootPath: root,
      moodistConcepts,
      signatureDeclaration: declaration(extraCandidate(), pendingMoodistCandidate()),
    })

    const markdown = renderSignatureSoundAuditMarkdown(audit)
    const json = renderSignatureSoundAuditJson(audit)
    for (const heading of [
      "## Qualified Moodist matches",
      "## Needs audition or processing",
      "## Recording or source gaps",
      "## Signature-only concept candidates",
    ]) assert.match(markdown, new RegExp(heading))
    for (const value of [
      "Waves",
      "waves-signature-candidate",
      "Pack/Tone.WAV",
      "explicit-pack-cc0",
      "Pack/LICENSE.txt",
      String(Buffer.byteLength("wave-audio")),
      sha256("wave-audio"),
      "pending / pending / pending / active",
      "### animals",
      "Birds",
      "Cave Room Tone",
    ]) assert.ok(markdown.includes(value), `Markdown must include ${value}`)
    assert.match(markdown, /No candidates qualified\./)
    assert.match(markdown, /Signature Sounds states that its library is CC0/i)
    assert.match(markdown, /https:\/\/signaturesounds\.org\/about-/)
    assert.match(markdown, /project accepts that author statement/i)
    assert.match(markdown, /does not satisfy the separate technical, listening, or processing gates/i)
    assert.ok(audit.fingerprints, "rendered audit must expose freshness fingerprints")
    for (const [label, value] of [
      ["Scan audio inventory SHA-256", audit.fingerprints.scanAudioInventorySha256],
      ["Moodist inventory SHA-256", audit.fingerprints.moodistInventorySha256],
      ["Signature declaration SHA-256", audit.fingerprints.signatureDeclarationSha256],
    ]) {
      assert.ok(markdown.includes(`${label}: \`${value}\``))
    }
    assert.ok(json.endsWith("\n"))
    assert.equal(json, renderSignatureSoundAuditJson(audit))
    assert.deepEqual(JSON.parse(json), audit)
    assert.doesNotMatch(`${markdown}\n${json}`, new RegExp(root.replaceAll("\\", "\\\\"), "i"))
  })
})

describe("Signature sound audit CLI", () => {
  it("defaults to Markdown stdout and creates no files without explicit destinations", async (t) => {
    const runSignatureSoundAuditCli = requireExport(cliModule, "runSignatureSoundAuditCli")
    const fixture = await createFixture(t, { "Pack/Tone.WAV": "wave-audio" })
    const isolatedRepo = await createFixture(t)
    const stdout = []

    const exitCode = await runSignatureSoundAuditCli({
      args: [fixture],
      repoRoot: isolatedRepo,
      moodistConcepts,
      signatureDeclaration: declaration(),
      stdout: (value) => stdout.push(value),
    })

    assert.equal(exitCode, 0)
    assert.match(stdout.join(""), /# AtmoShaper Signature Sound Catalog Audit/)
    assert.doesNotMatch(stdout.join(""), new RegExp(fixture.replaceAll("\\", "\\\\"), "i"))
    assert.deepEqual(await readdir(isolatedRepo), [])
  })

  it("writes only explicit in-repo reports and rejects destinations outside the repo", async (t) => {
    const runSignatureSoundAuditCli = requireExport(cliModule, "runSignatureSoundAuditCli")
    const fixture = await createFixture(t, { "Pack/Tone.WAV": "wave-audio" })
    const isolatedRepo = await createFixture(t)
    const outside = await createFixture(t)
    const markdownDestination = "reports/catalog.md"
    const jsonDestination = join(isolatedRepo, "reports", "catalog.json")
    const options = {
      repoRoot: isolatedRepo,
      moodistConcepts,
      signatureDeclaration: declaration(),
      stdout: () => {},
    }

    assert.equal(await runSignatureSoundAuditCli({
      ...options,
      args: [
        fixture,
        "--format", "json",
        "--report-markdown", markdownDestination,
        "--report-json", jsonDestination,
      ],
    }), 0)
    const markdown = await readFile(join(isolatedRepo, markdownDestination), "utf8")
    const json = await readFile(jsonDestination, "utf8")
    assert.match(markdown, /Qualified Moodist matches/)
    assert.doesNotThrow(() => JSON.parse(json))
    assert.doesNotMatch(`${markdown}\n${json}`, new RegExp(fixture.replaceAll("\\", "\\\\"), "i"))

    const outsideDestination = join(outside, "unsafe.json")
    await assert.rejects(
      runSignatureSoundAuditCli({
        ...options,
        args: [fixture, "--report-json", outsideDestination],
      }),
      /inside the current repository/i,
    )
    await assert.rejects(readFile(outsideDestination, "utf8"), /ENOENT/)
  })

  it("rejects case-only Windows aliases before writing either report", async (t) => {
    if (process.platform !== "win32") {
      t.skip("case-only path aliasing is a Windows filesystem boundary")
      return
    }
    const runSignatureSoundAuditCli = requireExport(cliModule, "runSignatureSoundAuditCli")
    const fixture = await createFixture(t, { "Pack/Tone.WAV": "wave-audio" })
    const isolatedRepo = await createFixture(t, { "Reports/Catalog.out": "original" })

    await assert.rejects(
      runSignatureSoundAuditCli({
        args: [
          fixture,
          "--report-markdown", "Reports/Catalog.out",
          "--report-json", "Reports/catalog.out",
        ],
        repoRoot: isolatedRepo,
        moodistConcepts,
        signatureDeclaration: declaration(),
        stdout: () => {},
      }),
      /same physical report destination/i,
    )
    assert.equal(await readFile(join(isolatedRepo, "Reports", "Catalog.out"), "utf8"), "original")
  })

  it("rejects in-repo directory-link aliases to the same unresolved report", async (t) => {
    const runSignatureSoundAuditCli = requireExport(cliModule, "runSignatureSoundAuditCli")
    const fixture = await createFixture(t, { "Pack/Tone.WAV": "wave-audio" })
    const isolatedRepo = await createFixture(t)
    const reportsDirectory = join(isolatedRepo, "reports")
    const reportsAlias = join(isolatedRepo, "reports-alias")
    await mkdir(reportsDirectory)
    try {
      await symlink(reportsDirectory, reportsAlias, process.platform === "win32" ? "junction" : "dir")
    } catch (error) {
      if (["EACCES", "EPERM", "ENOTSUP", "UNKNOWN"].includes(error?.code)) {
        t.skip(`directory links are unavailable on this host: ${error.code}`)
        return
      }
      throw error
    }

    await assert.rejects(
      runSignatureSoundAuditCli({
        args: [
          fixture,
          "--report-markdown", join(reportsDirectory, "catalog.out"),
          "--report-json", join(reportsAlias, "catalog.out"),
        ],
        repoRoot: isolatedRepo,
        moodistConcepts,
        signatureDeclaration: declaration(),
        stdout: () => {},
      }),
      /same physical report destination/i,
    )
    assert.deepEqual(await readdir(reportsDirectory), [])
  })

  it("rejects hardlink aliases to the same existing report file", async (t) => {
    const runSignatureSoundAuditCli = requireExport(cliModule, "runSignatureSoundAuditCli")
    const fixture = await createFixture(t, { "Pack/Tone.WAV": "wave-audio" })
    const isolatedRepo = await createFixture(t, { "reports/first.out": "original" })
    const first = join(isolatedRepo, "reports", "first.out")
    const second = join(isolatedRepo, "reports", "second.out")
    try {
      await link(first, second)
    } catch (error) {
      if (["EACCES", "EPERM", "ENOTSUP", "UNKNOWN"].includes(error?.code)) {
        t.skip(`hardlinks are unavailable on this host: ${error.code}`)
        return
      }
      throw error
    }

    await assert.rejects(
      runSignatureSoundAuditCli({
        args: [fixture, "--report-markdown", first, "--report-json", second],
        repoRoot: isolatedRepo,
        moodistConcepts,
        signatureDeclaration: declaration(),
        stdout: () => {},
      }),
      /same physical report destination/i,
    )
    assert.equal(await readFile(first, "utf8"), "original")
    assert.equal(await readFile(second, "utf8"), "original")
  })

  it("preflights an invalid second output without changing the first or leaving transaction residue", async (t) => {
    const runSignatureSoundAuditCli = requireExport(cliModule, "runSignatureSoundAuditCli")
    const fixture = await createFixture(t, { "Pack/Tone.WAV": "wave-audio" })
    const isolatedRepo = await createFixture(t, {
      "reports/catalog.md": "original markdown",
      "reports/not-a-file/sentinel.txt": "keep",
    })
    const reportsDirectory = join(isolatedRepo, "reports")

    await assert.rejects(
      runSignatureSoundAuditCli({
        args: [
          fixture,
          "--report-markdown", join(reportsDirectory, "catalog.md"),
          "--report-json", join(reportsDirectory, "not-a-file"),
        ],
        repoRoot: isolatedRepo,
        moodistConcepts,
        signatureDeclaration: declaration(),
        stdout: () => {},
      }),
      /report destination must be a file/i,
    )
    assert.equal(await readFile(join(reportsDirectory, "catalog.md"), "utf8"), "original markdown")
    assert.deepEqual((await readdir(reportsDirectory)).sort(), ["catalog.md", "not-a-file"])
  })

  it("rolls back the first publication when the second publication rename fails", async (t) => {
    const runSignatureSoundAuditCli = requireExport(cliModule, "runSignatureSoundAuditCli")
    const fixture = await createFixture(t, { "Pack/Tone.WAV": "wave-audio" })
    const isolatedRepo = await createFixture(t, {
      "reports/catalog.md": "original markdown",
      "reports/catalog.json": "original json",
    })
    const reportsDirectory = join(isolatedRepo, "reports")
    let renameCalls = 0

    await assert.rejects(
      runSignatureSoundAuditCli({
        args: [
          fixture,
          "--report-markdown", join(reportsDirectory, "catalog.md"),
          "--report-json", join(reportsDirectory, "catalog.json"),
        ],
        repoRoot: isolatedRepo,
        moodistConcepts,
        signatureDeclaration: declaration(),
        stdout: () => {},
        reportFileRename: async (source, destination) => {
          renameCalls += 1
          if (renameCalls === 4) throw new Error("fixture publication failure")
          await rename(source, destination)
        },
      }),
      /could not write the explicitly requested audit report/i,
    )
    assert.equal(await readFile(join(reportsDirectory, "catalog.md"), "utf8"), "original markdown")
    assert.equal(await readFile(join(reportsDirectory, "catalog.json"), "utf8"), "original json")
    assert.deepEqual((await readdir(reportsDirectory)).sort(), ["catalog.json", "catalog.md"])
  })

  it("replaces a single existing output without leaving temporary or backup files", async (t) => {
    const runSignatureSoundAuditCli = requireExport(cliModule, "runSignatureSoundAuditCli")
    const fixture = await createFixture(t, { "Pack/Tone.WAV": "wave-audio" })
    const isolatedRepo = await createFixture(t, { "reports/catalog.md": "old partial-prone content" })
    const reportsDirectory = join(isolatedRepo, "reports")
    const destination = join(reportsDirectory, "catalog.md")

    assert.equal(await runSignatureSoundAuditCli({
      args: [fixture, "--report-markdown", destination],
      repoRoot: isolatedRepo,
      moodistConcepts,
      signatureDeclaration: declaration(),
      stdout: () => {},
    }), 0)
    assert.match(await readFile(destination, "utf8"), /# AtmoShaper Signature Sound Catalog Audit/)
    assert.deepEqual(await readdir(reportsDirectory), ["catalog.md"])
  })

  it("rejects report destinations whose in-repo directory link canonically escapes the repo", async (t) => {
    const runSignatureSoundAuditCli = requireExport(cliModule, "runSignatureSoundAuditCli")
    const fixture = await createFixture(t, { "Pack/Tone.WAV": "wave-audio" })
    const isolatedRepo = await createFixture(t)
    const outside = await createFixture(t)
    const linkedDirectory = join(isolatedRepo, "linked-outside")
    try {
      await symlink(outside, linkedDirectory, process.platform === "win32" ? "junction" : "dir")
    } catch (error) {
      if (["EACCES", "EPERM", "ENOTSUP", "UNKNOWN"].includes(error?.code)) {
        t.skip(`directory links are unavailable on this host: ${error.code}`)
        return
      }
      throw error
    }

    for (const [option, filename] of [
      ["--report-json", "unsafe.json"],
      ["--report-markdown", "unsafe.md"],
    ]) {
      await assert.rejects(
        runSignatureSoundAuditCli({
          args: [fixture, option, join(linkedDirectory, filename)],
          repoRoot: isolatedRepo,
          moodistConcepts,
          signatureDeclaration: declaration(),
          stdout: () => {},
        }),
        /inside the current repository/i,
      )
      await assert.rejects(readFile(join(outside, filename), "utf8"), /ENOENT/)
    }
  })

  it("rejects an existing report-file symlink that targets a file outside the repo", async (t) => {
    const runSignatureSoundAuditCli = requireExport(cliModule, "runSignatureSoundAuditCli")
    const fixture = await createFixture(t, { "Pack/Tone.WAV": "wave-audio" })
    const isolatedRepo = await createFixture(t)
    const outside = await createFixture(t, { "sentinel.json": "do not overwrite" })
    const reportsDirectory = join(isolatedRepo, "reports")
    const linkedReport = join(reportsDirectory, "catalog.json")
    await mkdir(reportsDirectory)
    try {
      await symlink(join(outside, "sentinel.json"), linkedReport, "file")
    } catch (error) {
      if (["EACCES", "EPERM", "ENOTSUP", "UNKNOWN"].includes(error?.code)) {
        t.skip(`file symlinks are unavailable on this host: ${error.code}`)
        return
      }
      throw error
    }

    await assert.rejects(
      runSignatureSoundAuditCli({
        args: [fixture, "--report-json", linkedReport],
        repoRoot: isolatedRepo,
        moodistConcepts,
        signatureDeclaration: declaration(),
        stdout: () => {},
      }),
      /inside the current repository/i,
    )
    assert.equal(await readFile(join(outside, "sentinel.json"), "utf8"), "do not overwrite")
  })

  it("exits nonzero for an unsafe destination through the executable entrypoint", async (t) => {
    const fixture = await createFixture(t, { "Pack/Tone.WAV": "wave-audio" })
    const outside = await createFixture(t)
    const outsideDestination = join(outside, "unsafe.json")

    const result = await runNode([
      cliPath,
      fixture,
      "--report-json",
      outsideDestination,
    ])

    assert.notEqual(result.exitCode, 0)
    assert.match(result.stderr, /inside the current repository/i)
    assert.equal(result.stdout, "")
    await assert.rejects(readFile(outsideDestination, "utf8"), /ENOENT/)
  })
})
