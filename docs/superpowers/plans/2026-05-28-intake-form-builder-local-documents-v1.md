# Intake Form Builder And Local Documents V1

## Goal

Build the intake module as a local-first form/document workspace rather than a fixed intake page.

## Implementation Scope

- Replace `/notes/intake` with a therapist workspace for local clients, local clinical documents, template editing, tablet fill mode, and contact-only client account preview.
- Add reusable local intake helpers for form definitions, response normalization, required-field checks, built-in full-intake and pain/discomfort-map templates, pain-map placeholder mapping, export text, and encrypted `.mlab` bundles.
- Keep clinical intake responses, signatures, health history, and pain maps out of Prisma, hosted clinical sync, account preferences, and client APIs.
- Generate user-controlled JSON, editable DOC, print/PDF views, and optional password-encrypted workspace bundles.

## Verification

- Unit tests cover template validation, response normalization, local client/document linking, pain-map mapping, export text, workspace import normalization, and encrypted bundle round trips.
- Source guard tests ensure the intake route exposes the expected local-first workspace surfaces and does not call clinical/account/client sync paths.
- Browser QA fills the intake form locally, exports document JSON, exports an encrypted bundle, clears for the next client, and checks for clinical upload leaks.
