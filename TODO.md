# MassageLab TODO

Active planning and progress tracking now lives in [docs/project-log.md](docs/project-log.md). Keep this file as source evidence and a detailed checkbox list, but mirror meaningful status changes in the project log.

## Current Branch

- [x] Add feature-based entitlement helpers with `chimer_custom_colors`.
- [x] Add Stripe customer/subscription/student-access data model.
- [x] Add Stripe Checkout and webhook foundation.
- [x] Gate Chimer custom colors behind membership entitlement.
- [x] Nudge Chimer clock-only mode upward.
- [x] Move internal README material into repo-backed wiki docs.
- [x] Complete dependency alert remediation and document remaining audit output.
- [x] Run full automated verification gate.
- [ ] Manually verify Chimer clock-only mode on desktop and phone landscape.
- [ ] Manually verify Stripe checkout and webhook flow in Stripe test mode.

## Alpha Release Readiness

- [ ] Walk `docs/alpha-qa.md` with anonymous test data.
- [ ] Confirm local-first documentation workflows do not upload clinical content.
- [ ] Confirm navigation, PWA metadata, support, roadmap, account, security, and settings routes.
- [ ] Confirm billing status display and Chimer color feature gate.

## Next Branch Candidates

- [ ] Calendar creation flows plan.
- [ ] Generative music spike.
- [ ] Terms, privacy/legal, About Me, and public trust pages.
- [ ] Anatomy content expansion and review workflow.
- [ ] Education/flashcards design using shared anatomy data.

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
- [ ] Add a mapping layer from the new foundation seed into existing `lib/anatomy.js` and Anatomime after the seed shape is accepted.
- [ ] Plan Prisma persistence only after the seed model stabilizes and import/update workflows are clear.
- [ ] Keep client-friendly terms non-diagnostic: terms should map to possible related regions and structures, while the therapist chooses what is clinically relevant.
