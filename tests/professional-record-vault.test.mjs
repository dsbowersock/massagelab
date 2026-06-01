import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS,
  PROFESSIONAL_RECORD_VAULT_FORMAT,
  PROFESSIONAL_RECORD_VAULT_STORAGE_KEY,
  collectLegacyProfessionalRecordMigration,
  createEmptyProfessionalRecordVaultPayload,
  createEncryptedProfessionalRecordBundle,
  createEncryptedProfessionalRecordVault,
  decryptEncryptedProfessionalRecordBundle,
  decryptEncryptedProfessionalRecordVault,
  isEncryptedProfessionalRecordVault,
  mergeProfessionalRecordVaultPayloadChanges,
  setProfessionalRecordVaultDraft,
  setProfessionalRecordVaultIntakeWorkspace,
} from "../lib/professional-record-vault.js"

const passphrase = "correct horse battery staple"

describe("professional record vault", () => {
  it("defines the global local vault storage contract", () => {
    assert.equal(PROFESSIONAL_RECORD_VAULT_STORAGE_KEY, "massagelab-professional-record-vault-v1")
    assert.equal(PROFESSIONAL_RECORD_VAULT_FORMAT, "massagelab-professional-record-vault")
  })

  it("encrypts and unlocks one professional-record payload without plaintext in the envelope", async () => {
    const payload = setProfessionalRecordVaultDraft(
      createEmptyProfessionalRecordVaultPayload("2026-05-29T12:00:00.000Z"),
      "soap",
      {
        schemaVersion: 2,
        noteType: "soap",
        clientName: "Sensitive Client",
        generalNotes: "ML_VAULT_SENTINEL shoulder pain",
      },
      "2026-05-29T12:05:00.000Z",
    )

    const vault = await createEncryptedProfessionalRecordVault(payload, passphrase, {
      createdAt: "2026-05-29T12:00:00.000Z",
      updatedAt: "2026-05-29T12:05:00.000Z",
    })
    const serialized = JSON.stringify(vault)
    const decrypted = await decryptEncryptedProfessionalRecordVault(vault, passphrase)

    assert.equal(isEncryptedProfessionalRecordVault(vault), true)
    assert.equal(vault.format, PROFESSIONAL_RECORD_VAULT_FORMAT)
    assert.equal(vault.algorithm, "AES-GCM")
    assert.equal(vault.kdf, "PBKDF2-SHA-256")
    assert.equal(vault.iterations, 150000)
    assert.equal(serialized.includes("Sensitive Client"), false)
    assert.equal(serialized.includes("ML_VAULT_SENTINEL"), false)
    assert.equal(decrypted.records.soap.draft.clientName, "Sensitive Client")

    await assert.rejects(
      () => decryptEncryptedProfessionalRecordVault(vault, "wrong horse battery staple"),
      /Could not unlock professional-record vault/,
    )
  })

  it("exports and imports encrypted full-vault bundles", async () => {
    const payload = setProfessionalRecordVaultDraft(
      createEmptyProfessionalRecordVaultPayload("2026-05-29T12:00:00.000Z"),
      "journal",
      {
        schemaVersion: 1,
        documentType: "client-journal",
        clientName: "Bundle Client",
        entries: [],
      },
    )

    const bundle = await createEncryptedProfessionalRecordBundle(payload, passphrase)
    const decrypted = await decryptEncryptedProfessionalRecordBundle(bundle, passphrase)

    assert.equal(bundle.format, "massagelab-professional-record-vault-bundle")
    assert.equal(JSON.stringify(bundle).includes("Bundle Client"), false)
    assert.equal(decrypted.records.journal.draft.clientName, "Bundle Client")
    await assert.rejects(() => decryptEncryptedProfessionalRecordBundle({ format: "other" }, passphrase), /Expected a MassageLab/)
  })

  it("collects legacy plaintext drafts for one-time encrypted migration", () => {
    const storage = new Map([
      [LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS.soap, JSON.stringify({ schemaVersion: 2, noteType: "soap", clientName: "Legacy SOAP" })],
      [LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS.journal, JSON.stringify({ schemaVersion: 1, documentType: "client-journal", clientName: "Legacy Journal", entries: [] })],
      [LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS.rom, JSON.stringify({ schemaVersion: 1, documentType: "rom-session", clientName: "Legacy ROM", entries: [] })],
      [LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS.intake, JSON.stringify({
        schemaVersion: 1,
        templates: [],
        clients: [{ id: "client-1", displayName: "Legacy Intake" }],
        documents: [],
      })],
    ])

    const migration = collectLegacyProfessionalRecordMigration((key) => storage.get(key) ?? null, "2026-05-29T12:00:00.000Z")

    assert.equal(migration.legacyPlaintextFound, true)
    assert.deepEqual(migration.plaintextKeysToRemove.toSorted(), Object.values(LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS).toSorted())
    assert.equal(migration.payload.records.soap.draft.clientName, "Legacy SOAP")
    assert.equal(migration.payload.records.journal.draft.clientName, "Legacy Journal")
    assert.equal(migration.payload.records.rom.draft.clientName, "Legacy ROM")
    assert.equal(migration.payload.records.intake.workspace.clients[0].displayName, "Legacy Intake")
  })

  it("preserves malformed legacy data and older encrypted intake vaults non-destructively", () => {
    const storage = new Map([
      [LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS.soap, "{bad json"],
      [LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS.journal, JSON.stringify({ documentType: "wrong" })],
      [LEGACY_PROFESSIONAL_RECORD_STORAGE_KEYS.intake, JSON.stringify({
        schemaVersion: 1,
        format: "massagelab-local-intake-vault",
        algorithm: "AES-GCM",
        kdf: "PBKDF2-SHA-256",
        salt: "abc",
        iv: "def",
        ciphertext: "ghi",
      })],
    ])

    const migration = collectLegacyProfessionalRecordMigration((key) => storage.get(key) ?? null)

    assert.equal(migration.legacyPlaintextFound, false)
    assert.equal(migration.encryptedIntakeVaultFound, true)
    assert.deepEqual(migration.plaintextKeysToRemove, [])
    assert.ok(migration.warnings.some((warning) => warning.includes("not valid JSON")))
    assert.ok(migration.warnings.some((warning) => warning.includes("older encrypted intake vault")))
    assert.equal(migration.payload.records.soap.draft, null)
  })

  it("normalizes intake workspaces through the shared vault payload", () => {
    const payload = setProfessionalRecordVaultIntakeWorkspace(
      createEmptyProfessionalRecordVaultPayload("2026-05-29T12:00:00.000Z"),
      {
        schemaVersion: 1,
        templates: [],
        clients: [{ id: "client-1", displayName: "Shared Intake Client" }],
        documents: [],
      },
      "2026-05-29T12:05:00.000Z",
    )

    assert.equal(payload.records.intake.workspace.clients[0].displayName, "Shared Intake Client")
    assert.ok(payload.records.intake.workspace.templates.length > 0)
  })

  it("merges stale tab saves into the latest stored vault payload", () => {
    const base = createEmptyProfessionalRecordVaultPayload("2026-05-29T12:00:00.000Z")
    const currentStored = setProfessionalRecordVaultDraft(base, "soap", {
      schemaVersion: 2,
      noteType: "soap",
      clientName: "Saved in another tab",
    })
    const staleTabNext = setProfessionalRecordVaultDraft(base, "journal", {
      schemaVersion: 1,
      documentType: "client-journal",
      clientName: "Saved in this tab",
      entries: [],
    })

    const merged = mergeProfessionalRecordVaultPayloadChanges(base, staleTabNext, currentStored)

    assert.equal(merged.records.soap.draft.clientName, "Saved in another tab")
    assert.equal(merged.records.journal.draft.clientName, "Saved in this tab")
  })
})
