# MassageLab Alpha QA Checklist

Use this checklist before tagging or deploying a private-alpha build. Keep SOAP notes, intake forms, journals, and ROM sessions anonymous in test data.

## Automated Gate

- `npm run prisma:validate`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Chimer

- Anonymous user can open `/chimer`, start a timer, pause/resume from the center display, pause/resume with the spacebar, and end the timer.
- Anonymous user can open Chimer clock mode, use it as a standalone full-screen clock, and close it without starting a timer.
- Running timer and clock controls fade after inactivity, fully hide, and reappear on mouse, touch, keyboard, or focus interaction.
- Users with reduced-motion preferences do not see prolonged control transitions.
- Timer continues to show stable time while running, paused, and complete; hour display appears only when needed.
- Fullscreen enter/exit works, and ending a timer exits fullscreen if active.
- Font size controls change the running timer without layout overlap on desktop and mobile widths.
- Current-time display can be swapped into the primary position, with seconds and AM/PM preferences honored.
- Alert types work as expected: chime, flash, chime and flash, and silent.
- Test Alert unlocks audio where the browser allows it; failed audio unlock shows a clear message and does not block flash-only use.
- Preset, custom, and body-area interval modes schedule alerts at the expected cadence.
- Chimer preferences persist in browser local storage and, when signed in, sync only safe preference data.

## Local-First Documentation

- Anonymous user can open `/notes`, `/notes/soap`, `/notes/intake`, `/notes/journal`, and `/notes/rom` without an account.
- SOAP draft save/load stays in browser local storage under `massagelab-soap-draft`.
- Intake draft save/load stays in browser local storage under `massagelab-intake-draft`.
- Journal draft save/load stays in browser local storage under `massagelab-client-journal-draft`.
- ROM draft save/load stays in browser local storage under `massagelab-rom-session-draft`.
- SOAP JSON export includes `schemaVersion: 2`, `noteType: "soap"`, `exportedAt`, structured pain-map selections, and transcript review segments.
- Legacy SOAP `schemaVersion: 1` exports import successfully and receive current default fields.
- Intake JSON export includes `schemaVersion: 1`, `formType: "intake"`, and `exportedAt`.
- Journal JSON export includes `schemaVersion: 1`, `documentType: "client-journal"`, and `exportedAt`.
- ROM JSON export includes `schemaVersion: 1`, `documentType: "rom-session"`, and `exportedAt`.
- SOAP text export contains the local-first PHI responsibility notice.
- SOAP research JSON export removes direct identifiers and free-text fields before creating the local anonymized file.
- SOAP, intake, journal, and ROM DOC exports open as editable documents.
- SOAP, intake, journal, and ROM Save PDF buttons open browser print views without uploading data.
- Valid exported SOAP, intake, journal, and ROM JSON files import successfully and preserve default fields for older exports.
- Wrong document types and malformed JSON files are rejected with user-facing error messages.
- Anonymous SOAP, intake, journal, and ROM save/import/export flows do not send clinical content over the network.
- Transcript text can be pasted or imported, segmented, reviewed, and inserted only after the therapist explicitly selects segments.
- Body-map selections capture region, side, view, intensity, symptom types, descriptors, notes, and anatomy term candidates.

## Roles And Clinical Sync Gates

- New accounts receive a verified `USER` role.
- Admin emails receive both `USER` and `ADMIN` roles.
- `/account` can create pending student and massage license verification requests without uploading enrollment or license documents.
- Ohio license requests show the configured Ohio eLicense public lookup source; unsupported states stay pending/manual review.
- `/api/clinical/sync` returns `403` unless all hosted PHI sync compliance flags are enabled.
- `/api/clients/invitations` returns `403` while hosted clinical sync is disabled.
- Account preference sync strips SOAP, intake, journal, ROM, client, and treatment content.

## Calendar

- Signed-in user can create a practice calendar and receives OWNER practice membership without changing global account role.
- `/calendar/availability` can add therapist working hours and blocked times.
- `/book/[practiceSlug]` requires sign-in before appointment request submission.
- Booking slots honor service duration, therapist availability, blocked time, and active appointment conflicts.
- Requested and confirmed appointments block overlapping bookings; cancelled, completed, and no-show appointments do not.
- Calendar pages do not upload or display SOAP note, transcript, or pain-map content.

## Navigation And Release Hygiene

- Primary navigation exposes only alpha surfaces: Home, Chimer, Notes, Calendar, Anatomime, Account, Support, and Settings.
- `/support` loads from both the sidebar and Notes support card.
- Diagnostic routes such as `/debug-hydration` are absent from the production route manifest.
- Desktop and mobile layouts have no overlapping text or controls at common viewport widths.
- The README alpha scope still matches the shipped routes and privacy posture.
