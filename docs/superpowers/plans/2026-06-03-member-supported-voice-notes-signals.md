# Member-Supported Voice Notes Roadmap Signals

## Summary

Record voice transcription and therapist-reviewed SOAP assistance as future documentation goals, then add friendly membership-supported roadmap signals to the notes and pricing surfaces without shipping audio capture, transcription, LLM processing, hosted PHI storage, or clinical sync.

## Key Changes

- Keep the current implementation local-first: SOAP, intake, journal, ROM, transcripts, and other clinical content remain in the encrypted browser professional-record vault.
- Present voice notes, intake conversation transcription, SOAP assistance, and managed sync as goals that require more legal, security, compliance, vendor, and implementation work before they can become product features.
- Make membership CTAs low-pressure and transparent: memberships help fund careful work; they do not unlock hosted transcription or HIPAA-ready sync today.
- Update pricing roadmap notes so Supporter funds development/compliance groundwork, Therapist funds therapist documentation experiments, and Team/Practice funds future managed sync, BAAs, audit controls, and practice infrastructure.

## Acceptance Criteria

- `/notes` shows roadmap indicators for SOAP voice notes and intake conversation transcription goals.
- `/notes` planned documentation tools read as future roadmap tools, not broken or hidden features.
- Pricing copy distinguishes current membership benefits from future compliance-heavy documentation goals.
- No new API, Prisma, audio capture, transcription, LLM, or hosted PHI behavior is added.
- Docs preserve the rule that server/cloud transcription is a future compliance decision, not a simple feature toggle.

## Test Plan

- Extend local note source guards for the new roadmap indicators, membership CTA language, and absence of audio/transcription implementation hooks.
- Extend membership pricing tests to assert roadmap notes include support for compliance groundwork, local transcription experiments, SOAP drafting support, BAAs, audit controls, and practice-ready documentation infrastructure.
- Run targeted tests first, then `npm run test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

## Assumptions

- Raw audio should not be persisted by default in future transcription work.
- Local/on-device transcription remains the preferred direction when feasible.
- Server transcription or cloud SOAP assistance requires legal/compliance/vendor readiness, including BAAs where required.
- Future transcription must remain consent-first and therapist-reviewed.
