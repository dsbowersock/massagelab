# MassageLab Alpha QA Checklist

Use this checklist before tagging or deploying a private-alpha build. Keep SOAP notes and intake forms anonymous in test data.

## Automated Gate

- `npm run prisma:validate`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Chimer

- Anonymous user can open `/chimer`, start a timer, pause/resume from the center display, pause/resume with the spacebar, and end the timer.
- Timer continues to show stable time while running, paused, and complete; hour display appears only when needed.
- Fullscreen enter/exit works, and ending a timer exits fullscreen if active.
- Font size controls change the running timer without layout overlap on desktop and mobile widths.
- Current-time display can be swapped into the primary position, with seconds and AM/PM preferences honored.
- Alert types work as expected: chime, flash, chime and flash, and silent.
- Test Alert unlocks audio where the browser allows it; failed audio unlock shows a clear message and does not block flash-only use.
- Preset, custom, and body-area interval modes schedule alerts at the expected cadence.
- Chimer preferences persist in browser local storage and, when signed in, sync only safe preference data.

## Local-First Documentation

- Anonymous user can open `/notes`, `/notes/soap`, and `/notes/intake` without an account.
- SOAP draft save/load stays in browser local storage under `massagelab-soap-draft`.
- Intake draft save/load stays in browser local storage under `massagelab-intake-draft`.
- SOAP JSON export includes `schemaVersion: 1`, `noteType: "soap"`, and `exportedAt`.
- Intake JSON export includes `schemaVersion: 1`, `formType: "intake"`, and `exportedAt`.
- SOAP text export contains the local-first PHI responsibility notice.
- Valid exported SOAP and intake JSON files import successfully and preserve default fields for older exports.
- Wrong document types and malformed JSON files are rejected with user-facing error messages.
- Anonymous SOAP and intake save/import/export flows do not send note or intake content over the network.

## Navigation And Release Hygiene

- Primary navigation exposes only alpha surfaces: Home, Chimer, Notes, Anatomime, Account, and Settings.
- Diagnostic routes such as `/debug-hydration` are absent from the production route manifest.
- Desktop and mobile layouts have no overlapping text or controls at common viewport widths.
- The README alpha scope still matches the shipped routes and privacy posture.
