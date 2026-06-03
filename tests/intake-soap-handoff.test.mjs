import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  createClinicalDocumentFromResponse,
  createDefaultIntakeWorkspace,
  normalizeFormResponse,
} from "../lib/local-intake-builder.js"
import {
  createEmptySoapNoteDraft,
  createSoapDraftFromIntakeDocument,
  hasMeaningfulSoapDraft,
} from "../lib/intake-soap-handoff.js"

function followUpFixture() {
  const workspace = createDefaultIntakeWorkspace("2026-06-03T12:00:00.000Z")
  const template = workspace.templates.find((item) => item.id === "template-follow-up-intake-v1")
  const client = {
    id: "client-1",
    displayName: "Jane Client",
    email: "jane@example.com",
    phone: "555-1212",
  }
  const response = normalizeFormResponse({
    id: "response-1",
    templateId: template.id,
    localClientId: client.id,
    completedAt: "2026-06-03T12:30:00.000Z",
    answers: {
      followUpSessionDate: "2026-06-03",
      changesSinceLastVisit: "Desk work increased this week.",
      currentSymptoms: "Left shoulder tightness.",
      medicationChanges: "",
      allergyChanges: "No new allergies.",
      newSafetyConcerns: "Avoid deep pressure near left shoulder.",
      todaysGoals: "Improve shoulder mobility before travel.",
      pressurePreference: "Medium",
      pressurePreferenceChanges: "Less pressure around neck.",
      feltAfterLastSession: "Soreness lasted one day, then felt better.",
      followUpPainMap: {
        selected: {
          "Left [Shoulder]": "Tender",
          "Middle [Upper-back]": "Aching",
        },
        notes: "Worse after overhead work.",
      },
    },
  }, workspace.templates)
  const document = createClinicalDocumentFromResponse(response, client, template, "2026-06-03T12:35:00.000Z")

  return { client, document, template }
}

describe("intake to SOAP handoff", () => {
  it("creates a therapist-reviewable SOAP draft from a follow-up intake", () => {
    const { client, document, template } = followUpFixture()
    const draft = createSoapDraftFromIntakeDocument({
      document,
      client,
      template,
      existingDraft: null,
      mode: "replace",
      now: "2026-06-03T13:00:00.000Z",
    })

    assert.equal(draft.schemaVersion, 2)
    assert.equal(draft.noteType, "soap")
    assert.equal(draft.clientName, "Jane Client")
    assert.equal(draft.date, "2026-06-03")
    assert.match(draft.generalNotes, /From local follow-up intake response/)
    assert.match(draft.generalNotes, /Current symptoms: Left shoulder tightness\./)
    assert.match(draft.generalNotes, /Today's goals: Improve shoulder mobility before travel\./)
    assert.match(draft.generalNotes, /New safety concerns: Avoid deep pressure near left shoulder\./)
    assert.doesNotMatch(draft.generalNotes, /Medication changes:/)
    assert.match(draft.bodyDiagram.notes, /From local follow-up intake response body map/)
    assert.match(draft.bodyDiagram.notes, /Left \[Shoulder\]: Tender/)
    assert.match(draft.bodyDiagram.notes, /Notes: Worse after overhead work\./)
    assert.deepEqual(draft.bodyDiagram.painMapSelections, [])
  })

  it("preserves existing SOAP draft fields when appending intake context", () => {
    const { client, document, template } = followUpFixture()
    const existingDraft = {
      ...createEmptySoapNoteDraft(),
      clientName: "Existing SOAP Client",
      generalNotes: "Existing subjective note.",
      bodyDiagram: {
        ...createEmptySoapNoteDraft().bodyDiagram,
        notes: "Existing body-map note.",
        painMapSelections: [{
          id: "selection-1",
          regionId: "shoulder",
          side: "left",
          view: "back",
          intensity: 3,
          symptomTypes: ["pain"],
          descriptors: ["aching"],
          notes: "Existing structured selection",
          anatomyTermIds: [],
        }],
      },
    }

    const draft = createSoapDraftFromIntakeDocument({
      document,
      client,
      template,
      existingDraft,
      mode: "append",
      now: "2026-06-03T13:00:00.000Z",
    })

    assert.equal(draft.clientName, "Existing SOAP Client")
    assert.match(draft.generalNotes, /^Existing subjective note\./)
    assert.match(draft.generalNotes, /From local follow-up intake response/)
    assert.match(draft.bodyDiagram.notes, /^Existing body-map note\./)
    assert.equal(draft.bodyDiagram.painMapSelections.length, 1)
  })

  it("replaces an existing SOAP draft only when replace mode is explicit", () => {
    const { client, document, template } = followUpFixture()
    const existingDraft = {
      ...createEmptySoapNoteDraft(),
      clientName: "Existing SOAP Client",
      generalNotes: "Existing subjective note.",
    }

    assert.equal(hasMeaningfulSoapDraft(existingDraft), true)
    assert.equal(hasMeaningfulSoapDraft(createEmptySoapNoteDraft()), false)
    assert.throws(
      () => createSoapDraftFromIntakeDocument({ document, client, template, existingDraft }),
      /Choose append or replace/,
    )

    const draft = createSoapDraftFromIntakeDocument({
      document,
      client,
      template,
      existingDraft,
      mode: "replace",
      now: "2026-06-03T13:00:00.000Z",
    })

    assert.equal(draft.clientName, "Jane Client")
    assert.doesNotMatch(draft.generalNotes, /Existing subjective note/)
    assert.match(draft.generalNotes, /From local follow-up intake response/)
  })

  it("maps a full initial intake into SOAP context without requiring follow-up fields", () => {
    const workspace = createDefaultIntakeWorkspace("2026-06-03T12:00:00.000Z")
    const template = workspace.templates.find((item) => item.id === "template-full-intake-v1")
    const response = normalizeFormResponse({
      id: "response-initial",
      templateId: template.id,
      completedAt: "2026-06-03T12:30:00.000Z",
      answers: {
        firstName: "Jane",
        lastName: "Client",
        dateOfBirth: "1990-01-02",
        shortTermGoals: "Reduce neck tension.",
        pressure: "Firm",
        draping: true,
        informedConsent: true,
        clientSignature: "Jane Client",
        initialPainMap: {
          selected: { "Middle [Neck]": "Tight" },
          notes: "Computer work aggravates symptoms.",
        },
      },
    }, workspace.templates)
    const client = { id: "client-1", displayName: "Jane Client" }
    const document = createClinicalDocumentFromResponse(response, client, template, "2026-06-03T12:35:00.000Z")

    const draft = createSoapDraftFromIntakeDocument({
      document,
      client,
      template,
      existingDraft: null,
      mode: "replace",
      now: "2026-06-03T13:00:00.000Z",
    })

    assert.equal(draft.clientName, "Jane Client")
    assert.equal(draft.dateOfBirth, "1990-01-02")
    assert.match(draft.generalNotes, /From local initial intake response/)
    assert.match(draft.generalNotes, /Short term goals: Reduce neck tension\./)
    assert.match(draft.generalNotes, /Desired Pressure: Firm/)
    assert.match(draft.bodyDiagram.notes, /Middle \[Neck\]: Tight/)
  })
})
