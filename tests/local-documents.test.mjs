import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LocalDocumentError,
  createFilenameSlug,
  createLocalDocumentExport,
  createLocalDocumentFilename,
  mergeLocalDocumentData,
  parseLocalDocumentJson,
} from "../lib/local-documents.js"

const emptySoap = {
  schemaVersion: 1,
  noteType: "soap",
  clientName: "",
  consentAcknowledged: false,
  subjectiveEntries: [],
  assessment: {
    overallAssessment: "",
    findings: "",
    techniques: [],
  },
}

describe("Local document helpers", () => {
  it("sanitizes filenames without leaking raw client names into unsafe paths", () => {
    assert.equal(createFilenameSlug("  Jane / Doe, LMT  "), "jane-doe-lmt")
    assert.equal(
      createLocalDocumentFilename({
        prefix: "massagelab-soap",
        subject: "Jane / Doe",
        extension: "json",
        date: "2026-05-03T12:00:00.000Z",
      }),
      "massagelab-soap-jane-doe-2026-05-03.json",
    )
  })

  it("adds export metadata without mutating the source document", () => {
    const source = { schemaVersion: 1, noteType: "soap", clientName: "Jane Doe" }
    const exported = createLocalDocumentExport(source, "2026-05-03T12:00:00.000Z")

    assert.deepEqual(source, { schemaVersion: 1, noteType: "soap", clientName: "Jane Doe" })
    assert.deepEqual(exported, {
      schemaVersion: 1,
      noteType: "soap",
      clientName: "Jane Doe",
      exportedAt: "2026-05-03T12:00:00.000Z",
    })
  })

  it("merges imported documents into the known local schema defaults", () => {
    const imported = mergeLocalDocumentData(
      emptySoap,
      {
        schemaVersion: 1,
        noteType: "soap",
        clientName: "Jane Doe",
        assessment: {
          findings: "Improved cervical rotation.",
        },
        exportedAt: "2026-05-03T12:00:00.000Z",
      },
      { discriminatorKey: "noteType", discriminatorValue: "soap" },
    )

    assert.deepEqual(imported, {
      ...emptySoap,
      clientName: "Jane Doe",
      assessment: {
        ...emptySoap.assessment,
        findings: "Improved cervical rotation.",
      },
    })
  })

  it("rejects documents with the wrong discriminator", () => {
    assert.throws(
      () => mergeLocalDocumentData(emptySoap, { schemaVersion: 1, noteType: "intake" }, {
        discriminatorKey: "noteType",
        discriminatorValue: "soap",
      }),
      LocalDocumentError,
    )
  })

  it("rejects malformed JSON before import", () => {
    assert.throws(
      () => parseLocalDocumentJson("{bad json", emptySoap, {
        discriminatorKey: "noteType",
        discriminatorValue: "soap",
      }),
      LocalDocumentError,
    )
  })
})
