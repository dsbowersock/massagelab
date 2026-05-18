# Privacy And PHI Posture

MassageLab's alpha is local-first for clinical documentation and health-sensitive data.

## Local-First Storage

- SOAP drafts stay in the current browser under `massagelab-soap-draft`.
- Intake drafts stay in the current browser under `massagelab-intake-draft`.
- Journal drafts stay in the current browser under `massagelab-client-journal-draft`.
- ROM drafts stay in the current browser under `massagelab-rom-session-draft`.

Exports are user-controlled files. Users are responsible for storing, transmitting, and backing them up appropriately.

## PWA Cache Boundary

The PWA service worker may cache anonymous public shell/tool route documents for home, Chimer, Anatomime, and local-first documentation tools. It must not cache account, auth, billing, calendar, booking, admin, hosted clinical sync, client, or other `/api/*` responses.

SOAP, intake, journal, and ROM content remains in browser local storage only when the user saves local drafts. The service worker must not create a second PHI cache, queue clinical uploads, or store request bodies.

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
