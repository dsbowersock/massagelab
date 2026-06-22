# Privacy-Safe Sentry Feedback

## Context

MassageLab already captures sanitized Sentry errors and traces. The next observability step is user-initiated problem reporting, but the standard Sentry feedback widget is not a safe default for PHI-capable tools because user messages, screenshots, URLs, or replay context can include clinical or wellness details.

## Goals

- Add a privacy-safe diagnostic report path that sends only operational metadata to Sentry.
- Keep support messages in the existing user-controlled email flow.
- Avoid uploading screenshots, Session Replay, form contents, local vault contents, full URLs, query strings, client wellness entries, SOAP text, intake answers, journal text, ROM notes, or user contact details.
- Make PHI-capable routes report only a coarse route category and privacy level.
- Preserve the current rule that Session Replay, User Feedback, and Logs stay disabled until a route-by-route privacy review is written.

## Scope

- Add a small report helper that classifies current routes into safe product areas and strips sensitive URL details.
- Add an API endpoint that captures a sanitized Sentry message and returns the Sentry event id.
- Add a support-page diagnostic card that lets users send a predefined issue category and optionally copy/use the diagnostic id in the existing email support flow.
- Add tests proving PHI-capable paths and wellness paths do not leak raw route details or freeform content into Sentry metadata.
- Update deployment/privacy documentation and current project docs.

## Non-Goals

- Do not enable Sentry Session Replay, the standard User Feedback widget, screenshots, attachment uploads, Logs, or AI feedback summaries.
- Do not add Prisma storage for feedback.
- Do not email support reports from the server.
- Do not collect freeform diagnostic descriptions through Sentry.

## Validation

- Focused Node tests for route classification, mailto diagnostic references, and Sentry event sanitization.
- `npm run typecheck`
- `npm run lint`
- `git diff --check`
