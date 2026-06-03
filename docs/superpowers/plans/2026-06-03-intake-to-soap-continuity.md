# Intake To SOAP Continuity

## Goal

Build the next local-first documentation branch around a clear intake-to-SOAP flow: therapists can collect either a full initial intake or a shorter follow-up intake on the same device, review the result, and intentionally roll the useful details into a SOAP draft without uploading PHI.

## Recommended Branch

`codex/intake-to-soap-continuity`

## Product Direction

MassageLab should treat initial intake and follow-up intake as separate workflows, not one reused form.

- Initial intake is for a new local client or first appointment. It can ask for the broader client profile, contact basics, emergency contact, health history, medications, allergies, contraindications, surgeries, pregnancy notes where relevant, lifestyle/context, massage goals, treatment preferences, consent/acknowledgement, signature, and a full pain/discomfort map.
- Follow-up intake starts from an existing local client in the therapist's local workspace. The therapist should be able to click/select that client and start a follow-up intake without asking the client to re-enter stable basic information.
- Follow-up intake should focus on what changed since the last visit: new or changed medical conditions, medications, allergies, contraindications, surgeries, pregnancy status where relevant, current symptoms, current pain/discomfort map, how they felt after the last session, today's goals, preferred focus areas, pressure preference changes, and any new safety concerns.
- Both initial and follow-up intake responses should become linked local clinical documents inside the encrypted professional-record vault.
- Either response type should be reviewable before SOAP seeding. The therapist controls what gets copied forward; MassageLab should not silently overwrite an existing SOAP draft.

## SOAP Handoff

The branch should add a local-only action from a selected intake document, such as `Start SOAP note` or `Use in SOAP`.

- Store the SOAP seed inside the unlocked `massagelab-professional-record-vault-v1` payload. Do not pass client names, symptoms, pain maps, or intake answers through URLs, query params, server actions, Prisma, account preferences, or API routes.
- Map local client identity into the SOAP identifying fields only when the therapist confirms the handoff.
- Map goals, symptoms, medical changes, safety concerns, and treatment preferences into therapist-reviewable Subjective or note-context fields.
- Map pain/discomfort answers into SOAP body-diagram notes or structured selections only when the current SOAP shape can represent them clearly.
- Preserve therapist authorship: generated SOAP content should be visibly marked as coming from a local intake response and remain editable before saving.
- If a SOAP draft already exists, require an explicit append/replace decision rather than silently replacing it.

## Scope Boundaries

In scope:

- Distinct built-in templates for initial intake and follow-up intake.
- Existing-local-client follow-up flow from the local client/document dashboard.
- Linked local clinical documents for both intake types.
- Intake response preview before SOAP seeding.
- SOAP draft seeding inside the encrypted local vault.
- Tests for template distinction, response normalization, local-client follow-up behavior, SOAP mapping, and source guardrails.

Out of scope:

- Hosted clinical storage or sync.
- Client portal pre-arrival intake.
- Appointment/calendar-driven form delivery.
- Legal signature policy beyond local acknowledgement capture.
- Database tables or Prisma-backed client medical records.
- Remote therapist access to client wellness records.

## Acceptance Notes

- A therapist can create/select a local client and start a follow-up intake without retyping basic client information.
- Initial intake remains the fuller first-visit form.
- Follow-up intake asks only appointment-relevant updates and safety changes by default.
- Both intake types can roll into a SOAP draft through a therapist-reviewed local action.
- No clinical content leaves the browser-local encrypted professional-record vault.
- Validation should include focused unit/source tests plus the usual lint, typecheck, test, and build gates before closing the branch.
