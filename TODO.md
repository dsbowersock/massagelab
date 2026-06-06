# MassageLab TODO

Current project state now lives in [docs/project-state.md](docs/project-state.md), and chronological progress tracking lives in [docs/project-log.md](docs/project-log.md). Keep this file as source evidence and a detailed historical checkbox list, but mirror meaningful status changes in the project state and project log.

## Current Branch

- [x] Add feature-based entitlement helpers with `chimer_custom_colors`.
- [x] Add Stripe customer/subscription/student-access data model.
- [x] Add Stripe Checkout and webhook foundation.
- [x] Gate Chimer custom colors behind membership entitlement.
- [x] Nudge Chimer clock-only mode upward.
- [x] Move internal README material into repo-backed wiki docs.
- [x] Complete dependency alert remediation and document remaining audit output.
- [x] Run full automated verification gate.
- [x] Manually verify Chimer clock-only mode on desktop and phone landscape.
- [x] Manually verify Stripe checkout and webhook flow in Stripe test mode.
- [x] Apply calendar migrations and add service variants/resources for provider-managed appointment and class scheduling.
- [x] Add operator calendar workspace with draggable scheduling, advanced availability, display preferences, multi-service appointment composition, and clinical-rich service template references.

## Alpha Release Readiness

- [x] Walk `docs/alpha-qa.md` with anonymous test data.
- [x] Confirm local-first documentation workflows do not upload clinical content.
- [x] Confirm navigation, PWA metadata, support, roadmap, account, security, and settings routes.
- [x] Confirm billing status display and Chimer color feature gate.

## Next Branch Candidates

- [x] Calendar creation flows plan.
- [x] Online booking settings, waitlist, and provider capacity controls inspired by Square's calendar and booking settings, excluding payments and external sync implementation.
- [ ] External Google/Apple/Outlook calendar sync integration plan.
- [ ] Stripe Connect marketplace payments plan for provider booking payments, deposits, cancellation fees, taxes, packages, refunds, payouts, and platform fees.
- [x] Sitewide visual system and account-page polish pass: update the rest of the site with the account page's visual polish and move shared page/surface/inset styling into one source of truth so route elements stay cohesive unless an intentional exception is documented.
- [ ] Generative music spike.
- [ ] Terms, privacy/legal, About Me, and public trust pages.
- [ ] Anatomy content expansion and review workflow.
- [x] Education/flashcards design using shared anatomy data.
- [x] Setup-first flashcards with sourced prompt modes, anonymous temporary decks, public deck browsing, signed-in saved templates, and progress/achievement tracking.

## Payload CMS Planning

- [ ] Add Payload CMS after a dedicated integration plan, not as an incidental dependency.
- [ ] Blog is the first Payload content type; design collections so documentation, client education, therapist resources, course lessons, anatomy articles, and paid or role-restricted content can be added later.
- [ ] Decide whether Payload uses the existing MassageLab Neon/Postgres database or a separate database. Default recommendation to evaluate first: separate Payload database or schema until table ownership, migrations, and backup boundaries are clear.
- [ ] Confirm required packages before implementation: `payload`, `@payloadcms/next`, a Postgres adapter such as `@payloadcms/db-postgres` or the Vercel-optimized adapter, editor package choices, and any storage plugin needed for uploads.
- [ ] Identify file changes before implementation: Payload config, admin route, generated Payload types, collection definitions, access-control helpers, content query helpers, and public blog routes.
- [ ] Identify env vars before implementation: `PAYLOAD_SECRET`, Payload database URL, public site URL, admin user/bootstrap settings, storage credentials if uploads are enabled, and any preview/draft secrets.
- [ ] Decide auth integration. Default assumption: keep MassageLab app auth as the product auth source and treat Payload admin auth as a separate editorial/admin surface until a shared-auth plan is proven safe.
- [ ] Vercel deployment review: serverless/runtime compatibility, migration workflow, build-time database requirements, permanent file storage for uploads, CDN/image handling, and preview/draft behavior.
- [ ] Risk review: migration conflicts with Prisma, role/paid-content leakage, PHI boundaries, upload storage persistence, content preview security, and operational complexity.
- [ ] Head decision: the existing Next.js App Router site is the public head. Payload supplies admin/content APIs; MassageLab pages render the public blog and future content experiences.

## Anatomy Data Foundation

- [x] Add first reviewed-in-code anatomy foundation seed module with stable IDs/slugs and validation helpers.
- [x] Start with TypeScript-style seed data in code rather than Prisma persistence, because the current anatomy system is library/test driven and the shape should stay easy to review before database lock-in.
- [ ] Review the first seed scope: neck, shoulder girdle, upper back, scapular region, and glenohumeral region.
- [ ] Expand the model only after review to cover lower back, pelvis/hip, knee, ankle/foot, forearm/wrist/hand, and thorax.
- [ ] Choose authoritative citation sources for anatomy relationships and range-of-motion values; replace placeholder `future-clinical-citation-needed` source refs before clinical/public education release.
- [x] Add a mapping layer from the new foundation seed into existing `lib/anatomy.js` and Anatomime after the seed shape is accepted.
- [x] Archive the old Anatomime runtime data after auditing all 333 legacy rows as sourced or mapped into the sourced foundation.
- [ ] Plan Prisma persistence only after the seed model stabilizes and import/update workflows are clear.
- [x] Add focused flashcard deck/session persistence without moving sourced anatomy seed truth out of code.
- [ ] Keep client-friendly terms non-diagnostic: terms should map to possible related regions and structures, while the therapist chooses what is clinically relevant.
