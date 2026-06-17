# Legal Trust Pages Design

Date: 2026-06-17

## Context

MassageLab is a private-alpha, account-based application with public tools, education surfaces, membership billing, role verification, calendar and booking workflows, signed-in client-owned wellness self-tracking, and local-first therapist professional-record tools. The project now needs public legal and trust pages before wider sharing.

The legal page work must describe MassageLab as it exists now, not as the future product might exist. Current therapist professional records stay local-first in the browser under the encrypted professional-record vault. Hosted clinical storage, AI transcription, SOAP assistance, research consent, account-wide export, account deletion requests, and provider client-payment collection are separate future work.

For Branch 1, the business identity should be written as:

> Massage Lab, operated by Derrick Bowersock

The documents should use Ohio as the governing-law context where applicable, but dispute language should remain minimal until attorney review. This design is a product and implementation spec, not legal advice. The final documents should be reviewed by a licensed attorney before broad public reliance.

## Goals

- Publish a current-state legal/trust page set that users can read from footer, account, registration, billing, and professional activation surfaces.
- Add versioned legal acceptance logging for the points where users must acknowledge current terms.
- Keep the copy aligned with MassageLab's live privacy architecture: account/contact/booking cloud data, client-owned wellness self-tracking, and local-first therapist professional records.
- Make the membership billing and refund posture clear before Stripe checkout.
- Require professional/practice users to acknowledge the Therapist Agreement before acting in a professional or practice capacity.
- Avoid overclaiming HIPAA compliance, hosted clinical sync, provider payments, AI/transcription, or research use.

## Non-Goals

- Do not add account deletion request workflow in this branch.
- Do not add account-wide export in this branch.
- Do not add an AI/transcription disclaimer page or active AI terms.
- Do not add a research, de-identified data, or research-consent notice.
- Do not add provider/client payment collection terms.
- Do not add hosted PHI sync terms, BAA flows, or HIPAA-compliance claims.
- Do not define client access to therapist-created notes beyond the current local-first boundary.
- Do not add an admin legal-document editor or public version-history UI.
- Do not require every user to accept every professional notice at registration.

## Document Set

Branch 1 should add six legal pages under `/legal/*`.

### Terms Of Service

Route: `/legal/terms`

Purpose:

- Define adult account eligibility.
- Define acceptable use.
- Explain that MassageLab is a software platform, not a medical provider, emergency service, insurer, legal advisor, compliance advisor, or substitute for professional judgment.
- Cover account responsibilities, role/credential representations, public education tools, calendar and booking limitations, membership references, intellectual property, service changes, suspension, termination, disclaimers, and minimal dispute language.

Key posture:

- Accounts are intended for users who are at least 18 years old.
- Therapists and practices remain responsible for professional services, licensure, scope of practice, client consent, documentation, recordkeeping, privacy obligations, and client relationships.
- Dispute language should be minimal and attorney-review-ready. Do not add binding arbitration, class-action waiver, or detailed forum language in Branch 1.

### Privacy Policy

Route: `/legal/privacy`

Purpose:

- Explain data categories MassageLab currently collects or stores for account, authentication, role, profile, membership, billing metadata, booking/calendar, client-owned wellness, support, diagnostics, and app preferences.
- Explain local-first therapist professional records separately from cloud app data.
- Explain vendors and service categories without documenting secrets or row-level data.
- Explain user choices, deletion-request rights, and export availability at a high level without promising Branch 2 account controls yet.

Key posture:

- Professional records such as SOAP, intake, journal, therapist ROM, and related therapist documentation stay in the user's local encrypted browser vault unless future hosted clinical storage passes the documented compliance gates.
- Signed-in `/wellness` records are client-owned self-tracking data, not therapist professional records, diagnosis, emergency monitoring, or automatic therapist-facing data.
- Support messages should avoid client PHI or sensitive clinical detail.
- Stripe handles payment processing. MassageLab should not claim to store full payment card numbers.
- Sentry/error diagnostics are privacy-scrubbed and should not collect clinical content.
- Resend should not be named as an active vendor unless implementation confirms it; current package context confirms Nodemailer, not Resend.

### Membership, Billing, And Refund Terms

Route: `/legal/membership-billing-refunds`

Purpose:

- Explain Free, Student, Supporter, Therapist, and Practice membership posture in user-facing language.
- Explain that Supporter, Therapist, and Practice are Stripe-backed paid memberships.
- Explain monthly and yearly billing, no free trials, Stripe payment processing, Stripe portal management, cancellation, renewal, failed payments, and feature changes.
- State the refund rule.

Locked refund rule:

- A user may request a full refund if they cancel within 31 calendar days of any membership renewal payment.

Key posture:

- Membership benefits should be described by current capabilities and feature access, not by unavailable future hosted clinical features.
- Provider/client payment collection is future/planned and should be governed by separate terms before launch.

### Therapist Agreement

Route: `/legal/therapist-agreement`

Purpose:

- Supplement the Terms and Privacy Policy for professional and practice users.
- Apply to all professional/practice users, including licensed therapists, practice owners, practice therapists, and practice staff.
- Define responsibility for licensure, credential representations, scope of practice, client consent, privacy compliance, documentation accuracy, client relationships, practice staff access, and use of local-first professional-record tools.

Key posture:

- MassageLab may provide templates, forms, local-first documentation tools, scheduling tools, and education tools, but users remain responsible for professional judgment and legal/professional requirements.
- The agreement should not imply that MassageLab verifies professional competence or guarantees authority to practice.
- The agreement should not add AI/transcription terms in Branch 1 because those features are not active.

### Functional Cookie Notice

Route: `/legal/cookies`

Purpose:

- Explain cookies and similar browser storage in plain language.
- State the functional-only posture.

Locked cookie posture:

- MassageLab uses cookies or similar browser storage only where needed for login, session security, preferences, fraud or abuse prevention, and core app functionality.
- MassageLab does not use advertising cookies, ad targeting, marketing retargeting, or ad personalization.
- If analytics are added later, they should be privacy-preserving and disclosed before use.

### Local-First Health And Wellness Data Notice

Route: `/legal/local-first-health-wellness-data`

Purpose:

- Explain the distinction between account/contact/booking data, client-owned wellness self-tracking, therapist professional records, and future sharing.
- Make the current local-first boundary readable for non-technical users.
- Reinforce that MassageLab is not for emergencies, diagnosis, treatment, medical advice, insurance decisions, or continuous monitoring.

Key posture:

- Therapist professional records remain local-first and user-controlled in the encrypted browser vault.
- Client-owned wellness records are separate self-tracking records.
- Hosted clinical storage and automatic therapist viewing are not active.
- Future hosted clinical storage requires separate legal, security, BAA, audit, access-control, retention, incident-response, and operating-policy review.

## Versioning

Each page should display a visible effective date and use an internal document version for acceptance logging.

Recommended initial document/version pairs:

- `terms` / `2026-06-legal-v1`
- `privacy` / `2026-06-legal-v1`
- `membership-billing-refunds` / `2026-06-legal-v1`
- `therapist-agreement` / `2026-06-legal-v1`
- `cookies` / `2026-06-legal-v1`
- `local-first-health-wellness-data` / `2026-06-legal-v1`

The combined internal acceptance id is `<documentKey>:<documentVersion>`, but the database should store `documentKey` and `documentVersion` separately. The implementation should centralize these values in a legal document registry so UI links, page metadata, and acceptance logging use the same source of truth.

## Acceptance Model

Branch 1 should add a dedicated `LegalAcceptance` Prisma model instead of storing acceptance in preferences, user metadata, or role metadata.

Required fields:

- `id`
- `userId`
- `documentKey`
- `documentVersion`
- `acceptedAt`
- `ipAddress`
- `userAgent`
- `createdAt`
- `updatedAt`

Required constraints and indexes:

- Required relation to `User`. Do not cascade-delete legal acceptance records as part of normal account deletion; Branch 2 must design deletion, retention, redaction, or anonymization handling before any destructive account workflow ships.
- Unique guard on `userId`, `documentKey`, and `documentVersion` so repeated submissions are idempotent.
- Index on `userId` for account lookup.
- Index on `documentKey` and `documentVersion` for audit or support lookup.

The acceptance helper should expose a small server-side function for recording one or more document acceptances. It should be idempotent for already-accepted versions and preserve the first `acceptedAt` timestamp.

## Acceptance Points

### Registration

Registration should require Terms and Privacy acceptance.

Behavior:

- The registration form displays required checkboxes with links to `/legal/terms` and `/legal/privacy`.
- The registration API rejects missing acceptance flags server-side.
- User creation and acceptance rows should be handled in one reliable flow so a registered user is not left without required initial acceptance records.

### Stripe Checkout

Checkout should require Membership/Billing/Refund Terms acceptance.

Behavior:

- The pricing or checkout action displays a required checkbox with a link to `/legal/membership-billing-refunds`.
- The server validates the acceptance flag before creating a Stripe Checkout session.
- The server records acceptance for the current billing terms version before or during checkout creation.
- Failed checkout creation should not create misleading membership records.

### Professional Or Practice Activation

Professional/practice activation should require Therapist Agreement acceptance.

Applies to:

- Licensed therapist requests.
- Practice owner activation.
- Practice therapist access.
- Practice staff access.

Behavior:

- Any relevant form should display a required checkbox with a link to `/legal/therapist-agreement`.
- The server should validate and record acceptance before granting or requesting professional/practice access.
- If there are multiple entry points, use one reusable helper instead of duplicating one-off form logic.

## Navigation And Placement

The legal pages should be discoverable without cluttering primary work navigation.

Recommended placement:

- Footer-level legal links or legal index link.
- Account/support trust links.
- Registration checkbox links.
- Pricing/checkout checkbox link.
- Therapist/practice activation checkbox link.

Avoid adding all six legal pages to the primary sidebar. They are trust/support documents, not everyday work tools.

## Copy Boundaries

Legal copy should describe current MassageLab behavior.

Allowed current-state claims:

- Public alpha account-based platform.
- Adult accounts only.
- Stripe-backed memberships for paid membership levels.
- Functional-only cookies and similar browser storage.
- Privacy-scrubbed diagnostics.
- Client-owned signed-in wellness self-tracking.
- Local-first encrypted professional-record vault for therapist documentation.
- Hosted clinical storage is not active.
- AI/transcription and SOAP assistance are roadmap goals, not active product terms.

Avoid:

- "HIPAA compliant" claims.
- Business Associate Agreement availability claims.
- Hosted professional-record storage claims.
- Active transcription, AI SOAP drafting, or cloud model processing claims.
- Research or de-identified data program claims.
- Provider payment collection or marketplace payout claims.
- Automatic client access to therapist notes.
- Advertising or marketing cookie claims.

## Implementation Shape

This design is for Branch 1 only:

1. Add a legal document registry with document keys, labels, routes, versions, and effective dates.
2. Add six legal pages using the existing public page/surface components.
3. Add footer/account/support links to the legal page set.
4. Add a `LegalAcceptance` model and migration.
5. Add server helpers to record and check current document acceptance.
6. Require Terms and Privacy acceptance during registration.
7. Require Membership/Billing/Refund acceptance before Stripe checkout.
8. Require Therapist Agreement acceptance for professional/practice activation entry points.
9. Add focused tests for legal registry, acceptance idempotency, registration rejection, checkout rejection, and professional/practice acceptance enforcement.

Account deletion request and account-wide export are Branch 2.

## Acceptance Criteria

- `/legal/terms`, `/legal/privacy`, `/legal/membership-billing-refunds`, `/legal/therapist-agreement`, `/legal/cookies`, and `/legal/local-first-health-wellness-data` render with visible effective dates.
- Legal document versions are defined in one shared registry.
- Registration requires and records Terms and Privacy acceptance.
- Stripe checkout requires and records Membership/Billing/Refund acceptance.
- Professional/practice activation requires and records Therapist Agreement acceptance.
- Acceptance records include user id, document key, document version, accepted timestamp, IP address, and user agent.
- Repeated acceptance submission for the same user/document/version stays idempotent.
- Footer/account/support surfaces expose legal links without overcrowding the primary sidebar.
- Legal copy uses `Massage Lab, operated by Derrick Bowersock`.
- Legal copy keeps accounts adult-only.
- Legal copy describes functional-only cookies and no advertising or marketing tracking.
- Legal copy avoids active AI/transcription, research, hosted PHI, HIPAA-compliance, and provider-payment claims.
- Existing local-first professional-record boundaries remain unchanged.

## Validation Plan

- Run `npm run prisma:validate`.
- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm run test`.
- Add focused tests for acceptance helper behavior and server-side guard behavior.
- Add a focused browser smoke test if the implementation changes registration, pricing, or legal-page rendering in a way that existing tests do not cover.
