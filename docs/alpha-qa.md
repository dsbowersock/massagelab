# MassageLab Alpha QA Checklist

Use this checklist before tagging or deploying a private-alpha build. Keep SOAP notes, intake forms, journals, and ROM sessions anonymous in test data.

## Automated Gate

- Run the gate with Node.js `24.x`.
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

- Anonymous user can open `/notes` and see available therapist documentation tools, while `/notes/soap`, `/notes/intake`, `/notes/journal`, and `/notes/rom` show the membership-required gate without an active Therapist or Team/Practice membership.
- With `therapist_documentation_tools`, SOAP, intake, journal, and ROM require the shared encrypted professional-record vault before viewing or saving clinical content.
- The shared vault is stored under `massagelab-professional-record-vault-v1`; legacy plaintext keys are one-time migration inputs only.
- Valid legacy plaintext drafts under `massagelab-soap-draft`, `massagelab-intake-workspace-v1`, `massagelab-client-journal-draft`, and `massagelab-rom-session-draft` migrate into the encrypted vault on first setup, then imported plaintext keys are removed.
- Malformed legacy drafts and older encrypted intake vaults are preserved non-destructively with user-facing warnings.
- Encrypted `.mlab` full-vault export/import works with the correct password and rejects wrong passwords or malformed bundles.
- Plaintext JSON/TXT/research export and plaintext JSON import controls are not present on SOAP, intake, journal, or ROM routes.
- SOAP, intake, journal, and ROM DOC exports open only after an explicit plaintext-output warning.
- SOAP, intake, journal, and ROM Save PDF buttons open browser print views only after an explicit plaintext-output warning.
- SOAP, intake, journal, and ROM save/export/import flows do not send clinical content over the network.
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

- Primary navigation exposes only alpha surfaces: Home, Chimer, Notes, Calendar, and Anatomime.
- Expanded primary navigation groups alpha surfaces as Home, Tools, Documentation, and Games.
- Education and News remain hidden placeholders until they have visible alpha routes.
- Secondary sidebar navigation shows User Support and Roadmap, matching the compact shadcn secondary-nav pattern.
- Account, Security, Settings, and sign-in/sign-out actions stay in the account menu.
- The sidebar supports expanded, icon-collapsed, mobile sheet, left, and right states with visible keyboard focus.
- Clicking outside an expanded desktop sidebar collapses it without changing the active route or losing page state.
- Collapsed rail controls can reopen the sidebar, and the MassageLab wordmark appears when the sidebar is expanded.
- Sidebar group labels collapse and expand Tools, Documentation, Games, and Calendar sections.
- Collapsed sidebar section headers show recognizable icons for grouped navigation.
- The sidebar trigger bar supports top and bottom placement without moving the sidebar itself, and the trigger aligns to the selected left/right sidebar side.
- The sidebar mini calendar stays inside the expanded sidebar and does not appear in icon-collapsed mode.
- `/support` loads a contact/help page, and its form creates a valid `mailto:` URL for `contactmassagelab@gmail.com`.
- `/roadmap` loads the roadmap/support-roadmap content from the sidebar, Home roadmap link, Notes roadmap card, and Account clinical-sync card.
- Chimer running and alerting states hide the sidebar and top trigger bar.
- Diagnostic routes such as `/debug-hydration` are absent from the production route manifest.
- Desktop and mobile layouts have no overlapping text or controls at common viewport widths.
- On phone-sized viewports, the mobile sidebar sheet opens and closes without covering the active page once dismissed.
- The PWA manifest loads, includes standalone display metadata and 192/512 icons, and Chrome reports the app as installable when served over HTTPS.
- The service worker registers in production over HTTPS or local loopback hosts and uses the documented public-tool offline allowlist.
- After an online visit, `/chimer`, `/anatomime`, `/notes`, `/notes/soap`, `/notes/intake`, `/notes/journal`, and `/notes/rom` can reload offline from anonymous cached route documents and static shell assets.
- `/calendar`, `/account`, auth, billing, booking, admin, settings, pricing, hosted clinical sync, client, and `/api/*` surfaces are not cached as offline app routes; offline navigation falls back to `/offline.html`.
- `/notes/rom` requests motion/orientation access only after tapping Enable Sensor, handles denied or unsupported sensors with a message, and still supports manual measurement entry.
- The README alpha scope still matches the shipped routes and privacy posture.
