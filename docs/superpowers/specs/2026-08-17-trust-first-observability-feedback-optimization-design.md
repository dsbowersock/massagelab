# Trust-First Observability, Feedback, and Optimization Design

Date: 2026-08-17

Status: Approved design

Baseline: refreshed `origin/main` at `bdbb681286df7af8c2ef72976e7a89935d1cba0d`

Worktree: `.worktrees/trust-first-observability-design` on `codex/trust-first-observability-design`

## Purpose

Create a durable way to improve MassageLab using information people deliberately provide, anonymous operational evidence about whether the software works well, and reproducible engineering measurements. The program must not become passive product-behavior analytics or a broad rewrite.

The selected sequence is trust-foundation first:

1. harden Sentry as anonymous operational monitoring;
2. establish synthetic performance and engineering baselines;
3. pilot aggregate-only voluntary feedback for Chimer backgrounds;
4. rank and execute incremental Chimer modularization with before-and-after evidence; and
5. repeat a documented optimization loop.

## Alternatives considered

### Feedback first

Launching the Chimer feedback pilot before Sentry hardening would produce visible user input sooner, but it would leave known telemetry-boundary gaps and missing engineering baselines unresolved. It was not selected.

### Refactoring first

Decomposing Chimer immediately could reduce local complexity, but it would provide weaker evidence for choosing module seams and proving engineering improvements. It was not selected.

### Passive product analytics

Pseudonymous pageviews, background impressions, event funnels, and similar product analytics were considered and explicitly rejected. They conflict with the intended trust relationship and must not be treated as a deferred default if voluntary feedback volume is low.

## Current evidence

MassageLab already has useful foundations:

- `sentry.options.ts` sets `sendDefaultPii: false` and routes errors, transactions, spans, and breadcrumbs through central sanitizers.
- `lib/sentry-privacy.js` strips request bodies, headers, cookies, queries, fragments, router state, and many sensitive keys.
- `tests/sentry-privacy.test.mjs` exercises representative privacy boundaries.
- `/api/support/problem-report` is the approved user-initiated diagnostic path; freeform support remains in the user's email client.
- Session Replay, standard Sentry User Feedback, screenshots, attachments, and Logs are already prohibited until a separate privacy review.
- The legal cookie notice describes functional-only cookies and says future analytics must be privacy-preserving and disclosed before use.
- The June measurement-first refactor plan remains useful historical source evidence, but its baseline and priorities predate the present Chimer hotspot. This program must remeasure current `origin/main` rather than assume that plan's numbers or task order are current.

The current implementation also has concrete gaps:

- `scrubUser()` currently retains `user.id` when one is present.
- The breadcrumb sanitizer drops console breadcrumbs but does not categorically reject automatic UI, keyboard, location, or fetch breadcrumbs.
- Sentry's browser SDK can automatically record clicks, key presses, XHR/fetch requests, console calls, and location changes; `beforeBreadcrumb` can discard them. See [Sentry's breadcrumb documentation](https://docs.sentry.io/platforms/javascript/guides/svelte/enriching-events/breadcrumbs/).
- SDK-side filtering is not the only boundary. Sentry also exposes server-side data scrubbing and IP-address storage controls, so the project configuration must be audited as a second layer. See [Sentry's organization privacy settings API](https://docs.sentry.io/api/organizations/update-an-organization/).

Chimer is a justified first modularization pilot rather than an arbitrary cleanup target:

| File | Lines on baseline | Changes since 2026-06-01 |
| --- | ---: | ---: |
| `app/chimer/running-timer.tsx` | 14,302 | 86 |
| `app/chimer/set-timer.tsx` | 11,591 | 49 |
| `app/chimer/page.tsx` | 2,288 | 62 |
| `lib/chimer-timer.js` | 4,417 | 44 |
| `components/backgrounds/backgroundPaletteRegistry.ts` | 1,190 | 43 |
| `components/backgrounds/BackgroundHost.tsx` | 595 | 42 |
| `components/backgrounds/backgroundRegistry.ts` | 2,271 | 32 |
| `components/backgrounds/effects/css-backgrounds.tsx` | 4,080 | 27 |

File size alone does not prove a good extraction boundary or a performance problem. Change frequency, dependency shape, conflict history, testability, bundle ownership, and measured tool/runtime cost must determine the order.

## Goals

1. Preserve user trust by making voluntary feedback the only product-opinion signal in this program.
2. Keep Sentry useful for errors, regressions, coarse route/API performance, Web Vitals, release diagnosis, and component failures without creating user histories.
3. Establish stable synthetic and engineering baselines before making optimization claims.
4. Pilot useful structured Chimer background feedback without storing individual submissions.
5. Give administrators aggregate totals and trends, never a person- or session-level feed.
6. Rank Chimer refactors using current evidence and execute them in responsibility-sized branches.
7. Measure claimed improvements and record neutral or negative outcomes honestly.
8. Make the privacy boundary executable through tests and visible through documentation.

## Non-goals

- Passive product-usage analytics, pageview analytics, funnels, retention, attribution, or cohort tracking.
- Visitor, account, device, browser-instance, or session profiles.
- Background impressions, selection counts, dwell time, clickstreams, heatmaps, or automatic surveys.
- Analytics cookies, a new analytics-consent popup, browser fingerprinting, or duplicate-vote identity.
- Session Replay, screenshots, attachments, standard Sentry User Feedback, or freeform Sentry feedback.
- Reusing account, preference, wellness, journal, clinical, booking, support, or professional-record data as behavior analytics.
- Treating Sentry metrics, traces, or diagnostic IDs as a product analytics database.
- A Chimer rewrite, broad formatting pass, or speculative sitewide optimization campaign.
- Claiming that splitting files automatically improves whole-repository lint, build, bundle, or runtime performance.
- Exporting individual feedback or adding an individual submission feed.

## Permanent privacy contract

The program follows these durable rules:

- Product opinions are collected only after a person explicitly opens and submits the feedback control.
- No automatic feedback prompt may appear after a timer, background selection, error, duration, route visit, or other behavior.
- No passive product-behavior event is introduced as a substitute for missing feedback volume.
- Structured feedback is aggregated at write time. An individual submission row never exists.
- No user, visitor, session, IP, device, full URL, freeform text, or response-combination identity is stored with feedback.
- Sentry receives anonymous operational diagnostics only and is not queried to infer popularity or behavior.
- Clinical notes, intake forms, journals, ROM sessions, wellness entries, professional records, and account preferences remain outside feedback and observability metadata.
- No analytics cookie or analytics-consent UI is introduced by this program. Any future proposal that needs passive analytics, identifiers, replay, or materially broader collection requires a separate design, privacy decision, and disclosure review.

## Chosen program architecture

The umbrella program contains four separately planned and reviewable workstreams:

```text
privacy contract
|-- anonymous Sentry hardening
|-- synthetic and engineering baselines
|-- aggregate-only Chimer background feedback
`-- evidence-ranked Chimer modularization
    `-- recurring evidence -> hypothesis -> change -> validation loop
```

Each workstream can ship and roll back independently. A child implementation plan must name the exact repository and provider surfaces it owns. No child plan may silently broaden another workstream's data contract.

## Workstream 1: anonymous operational Sentry

### Intended questions

Sentry may answer:

- Which sanitized errors occur?
- Which release introduced or regressed an error?
- Which coarse route template or API operation is slow?
- Are anonymous Web Vitals or allowlisted spans worsening?
- Did a named technical component or renderer fail?
- What diagnostic event ID can a user deliberately include in a support request?

Sentry must not answer:

- Which backgrounds are popular?
- What a particular person, account, browser, or session did?
- How long someone used Chimer or whether they returned?
- Which controls someone clicked or values they entered?
- Which behavior preceded conversion, retention, or abandonment?

### SDK and project boundary

The Sentry child design and plan must:

1. Remove persistent account and user IDs from outgoing events. `scrubUser()` must not preserve `user.id`.
2. Disable automatic session tracking unless a later, narrowly documented reliability need passes this privacy contract.
3. Default-drop automatic UI click, keypress/input, console, location/navigation, and network breadcrumbs. If a breadcrumb is valuable, add a manual allowlisted operational category containing only a bounded code.
4. Keep `sendDefaultPii: false` and treat it as one layer rather than proof of the whole boundary.
5. Strip request bodies, response bodies, headers, cookies, query strings, fragments, full URLs, router state, local paths, database values, cache keys, auth context, and IP fields.
6. Reduce transactions and spans to coarse route templates, allowlisted operation names, status, duration, release, and environment.
7. Keep only broad browser family and device category where they materially help compatibility diagnosis. Do not retain a fingerprintable combination of hardware attributes.
8. Permit a stable technical component or renderer identifier only on an actual exception or bounded operational failure, never on ordinary selection or viewing.
9. Keep release, environment, sanitized stack traces, anonymous Web Vitals, and narrowly allowlisted performance spans.
10. Preserve the existing voluntary diagnostic event ID and privacy-safe problem-report path.
11. Audit Sentry project and organization settings for server-side data scrubbing, sensitive fields, IP storage prevention, retention, sharing, and attachment/replay/log status.
12. Keep Sentry Application Metrics and Explore out of product-behavior reporting even if the provider can count or group such data.

### Executable privacy contract

Focused tests must construct representative client, server, edge, transaction, span, breadcrumb, and problem-report fixtures and prove that:

- forbidden user and request fields are absent rather than merely renamed;
- automatic behavioral breadcrumb categories return `null`;
- coarse operational fields survive;
- renderer identity appears only on an actual operational failure fixture;
- feedback endpoint payloads cannot reach Sentry;
- clinical, wellness, professional-record, account-preference, and freeform sentinels never survive; and
- source guards keep Replay, standard User Feedback, screenshots, attachments, and Logs disabled.

The provider-settings audit must be recorded without copying DSNs, tokens, event payloads, account identifiers, or sensitive project data into the repository.

## Workstream 2: synthetic and engineering measurement

### Measurement classes

The baseline suite will measure:

- public-page and Chimer startup on representative desktop and mobile environments;
- background preview, selection, renderer startup, switching, and cleanup in controlled browser runs;
- lab Web Vitals and route/API response time for controlled journeys;
- JavaScript bundle and route-size changes;
- whole-project and targeted lint duration;
- typecheck, build, unit-test, browser-test, and CI critical-path duration;
- test retries, flakes, and diagnostic artifact production;
- file size, responsibility count, dependency fan-out, cycles, change frequency, and merge-conflict hotspots; and
- client/server boundary and lazy-loading ownership for heavy Chimer modules.

These measurements contain no user records. Synthetic journeys use controlled fixtures and accounts where required; credentials and generated evidence stay out of committed documentation.

### Baseline protocol

- Record the exact commit, environment, command, tool versions, cache state, and relevant device/browser profile.
- Use at least three comparable runs and report medians for noisy duration measurements.
- Separate cold and warm cache evidence.
- Preserve raw machine-readable results as bounded CI artifacts when practical; commit only safe summaries and reproducible commands.
- Treat one-off hosted-runner or local-machine variance as diagnostic evidence, not a product conclusion.
- Establish reporting-only budgets first. Promote a budget to a required check only after it demonstrates stable signal and a documented failure response.
- Do not compare unrelated environments as if they were one time series.

### Claims contract

Every optimization hypothesis must name its expected outcome, such as reduced merge overlap, smaller reasoning scope, faster targeted lint, lower module coupling, better test isolation, smaller client bundles, or reduced runtime work.

The result record must say `improved`, `neutral`, `regressed`, or `inconclusive`. Smaller files are an implementation fact, not an accepted outcome by themselves. In particular, a whole-repository `eslint .` improvement must be measured; it must not be inferred from file extraction.

## Workstream 3: aggregate-only Chimer background feedback

### User experience

Chimer exposes a quiet `Share feedback` action near the current background controls. It must not open automatically, interrupt a timer, pulse for attention, or reappear based on behavior.

When opened, the control:

1. names the currently selected background;
2. explains that the response is voluntary and aggregate-only;
3. presents grouped predefined responses in an accessible layout;
4. permits one to three selections;
5. contains no freeform field; and
6. submits only after an explicit action.

After the transaction commits, the interface confirms that the response was counted and that no personal or session history was saved. Users who want to explain more are directed to the existing user-controlled support channel.

Signed-in and anonymous visitors receive the same feedback experience. Existing authentication may continue to secure the surrounding application, but the submission path must not read, copy, tag, or store the account identity as feedback data.

### Stable response taxonomy

Display wording may improve over time, but the internal response code is stable. Copy changes require a taxonomy version or documented equivalence so trends are not silently redefined.

| Group | Stable code | Initial display copy |
| --- | --- | --- |
| What works | `FEELS_CALMING` | Feels calming |
| What works | `LOOKS_BEAUTIFUL` | Looks beautiful |
| What works | `WOULD_USE_AGAIN` | Would use this again |
| What works | `EASY_TO_CUSTOMIZE` | Easy to customize |
| What works | `WORKS_BEHIND_TIMER` | Works well behind the timer |
| Appearance and motion | `TOO_VISUALLY_BUSY` | Too visually busy |
| Appearance and motion | `HARD_TO_READ_OVER` | Hard to read over |
| Appearance and motion | `MOTION_UNCOMFORTABLE` | Motion feels distracting or uncomfortable |
| Appearance and motion | `PREVIEW_MISMATCH` | Looks different from the preview |
| Appearance and motion | `SCREEN_FIT_PROBLEM` | Does not fit my screen well |
| Controls | `CANNOT_CONTROL_AS_WANTED` | I can't control the background how I want |
| Controls | `CONTROLS_HARD_TO_FIND` | The controls are difficult to find |
| Controls | `CONTROLS_HARD_TO_UNDERSTAND` | The controls are difficult to understand |
| Controls | `CHANGES_UNEXPECTED` | My changes do not behave as expected |
| Controls | `RESET_DIFFICULT` | I can't easily restore the default |
| Colors | `COLORS_CHANGE_UNEXPECTEDLY` | The colors don't change how I expect |
| Colors | `CANNOT_CREATE_DESIRED_COLORS` | I can't create the colors I want |
| Colors | `COLOR_OR_CONTRAST_WRONG` | The colors or contrast feel wrong |
| Colors | `COLOR_CHANGES_HARD_TO_SEE` | My color changes are hard to see |
| Performance | `SLOW_TO_LOAD` | Slow to load |
| Performance | `ANIMATION_CHOPPY` | Animation is choppy |
| Performance | `CONTROLS_RESPOND_SLOWLY` | Controls respond slowly |
| Performance | `BACKGROUND_STOPPED_WORKING` | The background stopped working |

The interface must avoid presenting the full taxonomy as one unstructured wall. Group labels, keyboard navigation, focus management, visible selection state, and screen-reader names are acceptance requirements.

### Aggregate data model

The conceptual aggregate key is:

```text
(week_start, background_id, response_code, release_bucket) -> count
```

- `week_start` is a server-derived calendar-week bucket, not a submission timestamp.
- `background_id` is the existing stable background identifier shown to the user before submission.
- `response_code` is one allowlisted stable taxonomy code.
- `release_bucket` is a coarse bounded release family, not a commit SHA or client identifier.
- `count` is the only accumulated value.

The aggregate model must not include `userId`, `accountId`, `visitorId`, `sessionId`, IP, user agent, device, viewport, full URL, referrer, freeform text, created-at submission time, updated-at submission time, or a submission/combination identifier.

For a multi-selection submission, one database transaction atomically increments one aggregate row per selected response. The rows do not retain which responses arrived together. No individual feedback row, event stream, audit row, or raw submission archive exists before or after aggregation.

### Submission contract

The server accepts only:

- one currently enabled, known background ID;
- one to three distinct known response codes; and
- the request context necessary for ordinary origin and CSRF protection.

The server derives the week and coarse release. It rejects unknown, retired, duplicate, or excessive response values before a write. It does not attempt to identify duplicate voters. Duplicate or mischievous votes are an accepted limitation because identity-based prevention would violate the design.

Application code adds no request-body or submission logging. If the endpoint fails, Sentry may receive a coarse route template and bounded failure code, never the feedback payload. The public client offers an explicit retry but does not silently queue a response in local storage or resend it later.

Standard hosting security and denial-of-service controls remain a separate infrastructure concern. The application must not introduce an IP ledger, browser fingerprint, or persistent requester key for abuse prevention.

### Admin reporting

The existing Admin area gains an aggregate-only report with:

- totals by background and response;
- weekly trends;
- date-range, background, response, and coarse-release filters;
- a small-sample indicator and suppression of narrow breakdowns below an initial threshold of five responses; and
- clear labels that percentages describe feedback received, not all users or all background views.

There is no individual feed, user drill-down, session drill-down, raw-submission view, or initial export. Admin authorization must be freshly verified through the existing Admin boundary rather than trusting a stale client or session claim.

### Retention

Weekly aggregates are retained for 24 months. A tested, idempotent maintenance path deletes older rows using `week_start`; it does not create a permanent rollup or archive. Retired-background labels remain resolvable for retained aggregates, but the public endpoint rejects new feedback for an unknown or retired background.

### Pilot evaluation

Chimer backgrounds are the only initial product-feedback scope. Review the pilot after roughly eight weeks.

The review may examine counts and shares within received feedback, recurring positive or problem codes, background-specific patterns above the small-sample threshold, and resulting product hypotheses. It may not calculate an impression, visitor, response-rate, conversion, retention, or population denominator that was never collected.

Low volume is a valid outcome and does not justify passive tracking. Expansion to another product area requires evidence that the pilot produced useful decisions plus a new taxonomy and privacy review for that area.

## Workstream 4: evidence-ranked Chimer modularization

### Hotspot scorecard

Before extraction, rank candidates using:

- file size and structural complexity;
- change and merge-conflict frequency;
- import/export fan-out and dependency cycles;
- number of responsibilities;
- test isolation difficulty;
- client bundle and lazy-loading ownership;
- targeted lint/typecheck/build cost; and
- frequency of planned product work touching the surface.

The scorecard is a decision aid, not an automatic refactoring order. A high score still requires a coherent seam and adequate characterization tests.

### Candidate seams

Dependency mapping will test, rather than assume, these candidate boundaries:

1. timer and clock state transitions;
2. background selection and access decisions;
3. background-control definitions and view models;
4. color and visual draft/apply/discard behavior;
5. persistence and account-synchronization adapters;
6. renderer lifecycle and operational diagnostics;
7. immersive presentation; and
8. focused UI panels and controls.

Pure domain logic and stable adapters are preferred first extractions because they can establish module contracts without simultaneously rearranging stateful presentation. Stateful orchestration moves only after its dependencies are explicit and tested.

### Branch contract

Each refactor branch must:

- extract one coherent responsibility;
- preserve public behavior, accessibility, stored preference keys, sanitization, entitlements, and account-sync compatibility;
- avoid unrelated formatting and product changes;
- expose a small intentional module API with focused JSDoc for non-obvious contracts;
- add characterization and focused unit tests before moving behavior;
- reject or resolve dependency cycles and accidental server/client boundary expansion;
- run relevant browser coverage across desktop and mobile;
- compare the named before-and-after measurements; and
- record improved, neutral, regressed, or inconclusive outcomes.

No child branch may use this umbrella design as authorization to refactor every hotspot it encounters.

## Ongoing optimization loop

Future optimization work follows:

```text
evidence -> hypothesis -> baseline -> small change -> validation -> recorded result
```

Runtime performance, developer workflow, reliability, accessibility, and product usability remain separate outcome classes. A change may help one while being neutral or costly in another. The result record must make that tradeoff visible.

Ideas enter an evidence-ranked backlog. The backlog does not grant authority for a general cleanup, dependency migration, data-model redesign, or user-observation system.

## Delivery sequence and gates

### Phase 1: privacy and operational foundation

- Write the focused Sentry hardening child design and implementation plan.
- Add executable privacy-contract coverage before loosening or preserving any diagnostic field.
- Audit SDK plus provider settings.
- Update deployment, privacy, and Sentry operational documentation.
- Prove sanitized errors and performance signals remain useful.

Gate: forbidden identity and behavioral fields are absent in fixtures and provider configuration evidence, while a safe production-like diagnostic remains usable.

### Phase 2: measurement baseline

- Define controlled journeys and engineering commands.
- Record current runtime, bundle, lint, typecheck, build, test, CI, and architecture baselines.
- Create the current Chimer hotspot scorecard.
- Keep budgets reporting-only until stable.

Gate: measurements are reproducible, environment-labeled, and stable enough to evaluate a small change.

### Phase 3: Chimer feedback pilot

- Write the feedback child design and implementation plan.
- Add the aggregate schema and migration.
- Add the protected atomic submission path.
- Add the voluntary, accessible Chimer control.
- Add the authorized aggregate Admin report.
- Add the 24-month retention path.
- Update public privacy/cookie documentation before enabling the pilot.

Gate: source and integration tests prove aggregate-at-write behavior and absence of forbidden fields; manual desktop/mobile accessibility review passes; the feature can be disabled without losing Chimer functionality.

### Phase 4: first Chimer extraction

- Rank seams from current evidence.
- Select one responsibility-sized candidate.
- Write its focused child design and plan.
- Capture characterization tests and measurements.
- Extract, validate, and record the result.

Gate: behavior and storage compatibility remain intact, browser coverage passes, and the claimed outcome is measured rather than inferred.

### Phase 5: repeat deliberately

Use pilot feedback for product hypotheses, Sentry for reliability hypotheses, synthetic measurements for performance hypotheses, and the hotspot scorecard for architecture hypotheses. Do not combine these into a user profile or a single ambiguous optimization score.

## Documentation boundaries

Implementation must keep these sources aligned:

- `docs/project-state.md` for current program phase and proven state;
- `docs/project-log.md` for chronological decisions and measured outcomes;
- `docs/wiki/deployment.md` for Sentry provider and runtime settings;
- `docs/wiki/privacy-and-phi.md` for telemetry exclusions and local-first boundaries;
- the public legal privacy and cookie documents for the actual enabled feedback/diagnostic behavior;
- an Admin/operator wiki page for aggregate-report interpretation and retention; and
- child specs and implementation plans under `docs/superpowers/`.

Documentation must not claim that anonymous operational telemetry is nonexistent. It must explain what Sentry receives, what structured feedback stores, what neither system stores, and how users can provide intentional support feedback.

## Validation strategy

### Privacy and data-contract validation

- Unit fixtures for every Sentry event class and forbidden field family.
- Source guards for prohibited Sentry products and behavioral breadcrumb categories.
- Aggregate-model tests proving no individual identity or timestamp columns exist.
- Endpoint tests for allowlists, maximum selections, unknown/retired backgrounds, atomic increments, failure rollback, CSRF/origin protection, and payload-free error reporting.
- Retention tests at, before, and after the 24-month boundary.
- Admin authorization and small-sample behavior tests.

### Product and accessibility validation

- Keyboard and screen-reader traversal of the grouped taxonomy.
- Visible focus, selection, error, retry, and success states.
- Desktop and mobile Chimer coverage without automatic prompts.
- Confirmation that timer, immersive, background-control, preference, and entitlement behavior remains unchanged.

### Measurement and refactor validation

- Reproducible baseline commands and environment labels.
- At least three comparable timing samples with medians.
- Bundle and route-size comparison.
- Targeted and whole-repository lint/typecheck/build/test comparison where relevant.
- Dependency-cycle and client/server boundary checks.
- Focused characterization plus ordinary unit and browser coverage.
- `git diff --check` and the repository's complete branch-appropriate validation gate.

### Provider and rollout validation

- Sentry project-setting review without committed secrets or event contents.
- Safe test event proving retained diagnostics and removed forbidden data.
- Production-like feedback submission proving only aggregate counters change.
- Admin readback proving no individual submission surface exists.
- Retention dry run and bounded live maintenance verification when separately authorized.

## Failure handling and rollback

- Sentry hardening may be rolled back independently only to the last privacy-safe configuration; rollback must not re-enable identifiers or behavioral breadcrumbs.
- Synthetic measurement jobs begin as non-blocking and can be disabled if unstable without changing product behavior.
- Feedback UI and ingestion require a controlled enablement boundary. Disabling the pilot removes the public action and rejects new writes while retained aggregates age out normally.
- A failed multi-response submission rolls back every counter increment and offers an explicit retry.
- The feedback migration rollback must preserve database integrity and must not convert aggregate rows into individual records.
- Each Chimer extraction is one reversible branch. Rollback restores the preceding module boundary and stored behavior without undoing unrelated work.

## Acceptance criteria

The umbrella design is fulfilled when:

- Sentry is demonstrably anonymous and operational, with no persistent account/user ID, automatic behavioral breadcrumb history, feedback payload, or prohibited clinical/wellness data;
- sanitized errors, releases, coarse route/API performance, Web Vitals, and narrowly allowlisted spans remain useful;
- Sentry project settings add server-side scrubbing and IP-storage protection as a second layer;
- stable synthetic and engineering baselines exist with reproducible commands and median evidence;
- Chimer offers only user-initiated, grouped, predefined background feedback with one to three selections;
- each selection is aggregated immediately into weekly counters with no individual submission or response-combination history;
- the aggregate model contains only week, background ID, response code, coarse release, and count;
- the Admin report exposes totals and trends without user/session drill-down and labels denominator limits truthfully;
- weekly aggregates are deleted after 24 months without a permanent rollup;
- the pilot is reviewed without introducing passive impressions or visitor counts;
- Chimer refactor candidates are ranked from current evidence and executed one coherent responsibility at a time;
- every optimization claim has a baseline, validation, and recorded outcome;
- no analytics cookie, analytics popup, replay, heatmap, funnel, visitor profile, or broad rewrite is introduced; and
- future expansion requires a new scoped design rather than treating this umbrella as standing authorization.
