# Privacy And PHI Posture

MassageLab's alpha is local-first for clinical documentation. Signed-in client wellness self-tracking is a separate consumer-health data domain, not therapist professional-record storage.

The long-term domain model is defined in [Privacy-first data architecture](privacy-first-data-architecture.md). The short version is: account/contact/booking data may use normal cloud app storage, signed-in `/wellness` entries use separate privacy-controlled client-owned self-tracking storage, and therapist professional records stay local-first until hosted PHI storage passes the compliance gates below.

Therapist note-taking tools are visible in the app, but creating or viewing SOAP, intake, journal, ROM, and related professional-record documents requires the `therapist_documentation_tools` entitlement from an active Therapist or Team/Practice membership. This subscription gate does not change the PHI boundary: unlocked professional-record content still stays local-first unless hosted clinical storage passes the compliance gates below.

## Local-First Storage

SOAP, intake, journal, and ROM records stay in the current browser under one encrypted professional-record vault: `massagelab-professional-record-vault-v1`. The therapist must unlock the vault with a local passphrase before viewing or saving professional-record content. The passphrase stays in React memory for the current app session and is not sent to MassageLab.

The vault payload contains:

- SOAP draft data
- intake form-builder workspace data, including local templates, local client profiles, linked local form responses, and pain/discomfort maps
- journal draft data
- ROM session draft data

Legacy plaintext keys are migration inputs only: `massagelab-soap-draft`, `massagelab-intake-workspace-v1`, `massagelab-client-journal-draft`, and `massagelab-rom-session-draft`. On first vault setup, valid plaintext drafts are encrypted into the shared vault and the imported plaintext keys are removed only after the encrypted write succeeds. Malformed legacy drafts and older encrypted intake vaults are preserved non-destructively.

Encrypted `.mlab` full-vault bundles are the normal user-controlled transfer and backup format. DOC and print/PDF outputs remain available only after an explicit plaintext-output warning. Plaintext clinical JSON imports and plaintext JSON/TXT/research exports are not part of the current route UI.

## Intake Form Builder Boundary

- The therapist intake workspace is local-first and must not call account, client, calendar, clinical sync, or other `/api/*` endpoints with health history, signatures, pain maps, or intake answers.
- Built-in intake templates mirror the current Google intake workflow and body-map placeholders, but the app renders MassageLab-native JSON, DOC, and print/PDF outputs instead of exact Google Doc/XLSX files.
- Pre-arrival remote flows are limited to contact/profile and booking status information. Remote client accounts must not show clinical documents until hosted PHI storage passes the compliance gates below.
- Client-owned wellness data is cloud-backed only under the separate `/wellness` self-tracking domain. Therapist remote viewing and professional-record import remain deferred until consent, audit, compliance, and product gates are implemented.
- Professional-record vault data is encrypted at rest in browser storage and unlocked in memory for the current browser session. Encrypted storage and encrypted exports do not replace device passcodes, OS disk encryption, access policies, or backups.
- Local transfer methods such as Bluetooth, local Wi-Fi, mesh, and browser peer-to-peer transfer are deferred until a dedicated risk model covers authentication, encryption, audit expectations, vendor/BAA requirements, and operating procedures.

## Client Wellness Boundary

`/wellness` lets anonymous users practice quick logs and ROM measurement in memory only. Signed-in users can save client-owned self-tracking entries, export their entries, and soft-delete their entries. These records are not therapist professional records, diagnosis, emergency monitoring, or a live therapist dashboard.

Client wellness entries must stay out of account preferences, calendar payloads, notification payloads, Sentry metadata, analytics, email/SMS bodies, and the therapist professional-record vault. A future therapist sharing bridge requires explicit consent scope, revocation, audit language, and a deliberate professional-record reference step before any shared wellness data is used in treatment planning or notes.

## PWA Cache Boundary

The PWA service worker may cache anonymous public shell/tool route documents for home, Chimer, Anatomime, and local-first documentation tools. It must not cache account, auth, billing, calendar, booking, admin, hosted clinical sync, client, or other `/api/*` responses.

SOAP, intake, journal, and ROM content remains in the encrypted browser vault after the therapist saves it. The service worker must not create a second PHI cache, queue clinical uploads, or store request bodies.

## Sync Boundary

Account preference sync must not include SOAP note, intake form, journal, ROM, client, treatment, or client wellness entry content.

Calendar sync stores scheduling metadata only. SOAP notes, pain-map selections, transcript content, client wellness details, and research exports remain outside calendar payloads.

Hosted clinical sync is disabled unless all of these flags are set:

```text
MASSAGELAB_ENABLE_HOSTED_PHI_SYNC=true
MASSAGELAB_HIPAA_BAA_CONFIRMED=true
MASSAGELAB_HIPAA_RISK_REVIEW_CONFIRMED=true
```

Even when those flags are set, the current API returns `501` because hosted clinical storage is not implemented.

## Future Voice Transcription And SOAP Assist

Voice transcription, intake conversation transcription, and therapist-reviewed SOAP assistance are roadmap goals, not active hosted features. The preferred product direction is local/on-device processing with no raw audio persistence by default. Any server transcription, cloud model processing, or managed transcript sync must pass legal and compliance review first, including consent language, security review, vendor review, BAAs where required, audit controls, retention rules, breach response, and PHI-safe support/logging procedures.

Membership copy may say that paid support helps fund this work, but it must not imply that membership currently unlocks hosted transcription, cloud SOAP drafting, HIPAA-ready sync, or any other server-side PHI workflow.

## Future Hosted Storage Requirements

Managed HIPAA-compliant storage is a separate future product. It must include legal and compliance review, BAAs, access controls, audit logging, encryption, incident response, PHI-safe logging/email rules, and operating policies before implementation.

Encryption by itself does not remove BAA obligations when a cloud provider maintains ePHI on behalf of a covered entity or business associate. See [Privacy-first data architecture](privacy-first-data-architecture.md) for the source guidance and current vendor notes.
