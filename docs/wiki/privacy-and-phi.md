# Privacy And PHI Posture

MassageLab's alpha is local-first for clinical documentation and health-sensitive data.

The long-term domain model is defined in [Privacy-first data architecture](privacy-first-data-architecture.md). The short version is: account/contact/booking data may use normal cloud app storage, future client-owned wellness data is a separate privacy-controlled consumer-health domain, and therapist professional records stay local-first until hosted PHI storage passes the compliance gates below.

Therapist note-taking tools are visible in the app, but creating or viewing SOAP, intake, journal, ROM, and related professional-record documents requires the `therapist_documentation_tools` entitlement from an active Therapist or Team/Practice membership. This subscription gate does not change the PHI boundary: unlocked professional-record content still stays local-first unless hosted clinical storage passes the compliance gates below.

## Local-First Storage

- SOAP drafts stay in the current browser under `massagelab-soap-draft`.
- Intake form-builder workspaces stay encrypted in the current browser under `massagelab-intake-workspace-v1`. The therapist must unlock the local vault before viewing or creating intake documents. This workspace can contain local form templates, local client profiles, linked local form responses, and pain/discomfort maps.
- Journal drafts stay in the current browser under `massagelab-client-journal-draft`.
- ROM drafts stay in the current browser under `massagelab-rom-session-draft`.

Exports are user-controlled files. Users are responsible for storing, transmitting, and backing them up appropriately. Intake workspaces can export JSON, editable DOC/print-to-PDF document views, and optional password-encrypted `.mlab` bundles for local transfer or backup.

The target professional-record storage model is an offline encrypted vault unlocked by a therapist-entered passphrase for the current browser/app session. Intake now uses this model. SOAP, journal, and ROM browser-local drafts still need a later migration before they have the same vault behavior.

## Intake Form Builder Boundary

- The therapist intake workspace is local-first and must not call account, client, calendar, clinical sync, or other `/api/*` endpoints with health history, signatures, pain maps, or intake answers.
- Built-in intake templates mirror the current Google intake workflow and body-map placeholders, but the app renders MassageLab-native JSON, DOC, and print/PDF outputs instead of exact Google Doc/XLSX files.
- Pre-arrival remote flows are limited to contact/profile and booking status information. Remote client accounts must not show clinical documents until hosted PHI storage passes the compliance gates below.
- Future client-owned wellness data may become cloud-backed under a separate privacy-controlled domain, but therapist remote viewing and professional-record import remain deferred until consent, audit, compliance, and product gates are implemented.
- Intake vault data is encrypted at rest in browser storage and unlocked in memory for the current browser session. Encrypted storage and encrypted exports do not replace device passcodes, OS disk encryption, access policies, or backups.
- Local transfer methods such as Bluetooth, local Wi-Fi, mesh, and browser peer-to-peer transfer are deferred until a dedicated risk model covers authentication, encryption, audit expectations, vendor/BAA requirements, and operating procedures.

## PWA Cache Boundary

The PWA service worker may cache anonymous public shell/tool route documents for home, Chimer, Anatomime, and local-first documentation tools. It must not cache account, auth, billing, calendar, booking, admin, hosted clinical sync, client, or other `/api/*` responses.

SOAP, journal, and ROM content remains in browser local storage only when the user saves local drafts. Intake content remains in the encrypted browser vault after the therapist saves it. The service worker must not create a second PHI cache, queue clinical uploads, or store request bodies.

## Sync Boundary

Account sync must not include SOAP note, intake form, journal, ROM, client, or treatment content.

Calendar sync stores scheduling metadata only. SOAP notes, pain-map selections, transcript content, and research exports remain local-first.

Hosted clinical sync is disabled unless all of these flags are set:

```text
MASSAGELAB_ENABLE_HOSTED_PHI_SYNC=true
MASSAGELAB_HIPAA_BAA_CONFIRMED=true
MASSAGELAB_HIPAA_RISK_REVIEW_CONFIRMED=true
```

Even when those flags are set, the current API returns `501` because hosted clinical storage is not implemented.

## Future Hosted Storage Requirements

Managed HIPAA-compliant storage is a separate future product. It must include legal and compliance review, BAAs, access controls, audit logging, encryption, incident response, PHI-safe logging/email rules, and operating policies before implementation.

Encryption by itself does not remove BAA obligations when a cloud provider maintains ePHI on behalf of a covered entity or business associate. See [Privacy-first data architecture](privacy-first-data-architecture.md) for the source guidance and current vendor notes.
