# MassageLab Project Review

Date: 2026-05-17
Production target: https://massagelab.app, which redirects to https://www.massagelab.app
Local target: http://localhost:3010 from `npm run build` then `npm run start -- -p 3010`

## Executive Verdict

MassageLab is in a credible alpha state, but the project has reached the point where a few architectural shortcuts are now creating real drag. The highest-leverage work is not a rewrite. It is a focused cleanup of global data loading, account sync behavior, Sentry privacy/diagnostics, mobile animation cost, and browser regression coverage.

The production public pages are fast in lab traces, with the home route as the only measured page approaching the LCP budget. The signed-in account area is the clear performance risk: every unresolved Sentry issue is non-production except the preview test route, but the development issues show repeated `/account` DB pressure and filtered client errors that are not diagnosable enough.

Clinical/local-first boundaries are mostly well protected. The note, intake, journal, ROM, and SOAP flows store drafts locally and export local files. Hosted PHI sync remains gated behind explicit compliance flags and returns `403` or `501`. The bigger privacy gap is telemetry: Sentry currently filters too much useful error detail while still allowing request/transaction metadata that should be scrubbed harder.

## Remediation Update

Implemented after this audit:

- Anonymous account/profile sync calls are gated on a signed-in user id, removing the public-page `/api/account/profile` and `/api/account/preferences` 401 regression.
- Sentry sanitization now preserves safe runtime diagnostics for built-in JavaScript errors while filtering clinical/freeform messages, request headers, router state, query strings, and span metadata.
- Calendar schema readiness and sidebar calendar context reads now use short TTL caches to reduce repeated `/account` DB pressure.
- Production TOTP secret encryption now fails closed if `TOTP_ENCRYPTION_KEY` is missing.
- Global ambient background animation now stops for reduced-motion users, compact/mobile viewports, and hidden tabs.
- Brand/icon assets now use revalidating cache headers for stable filenames, and repeated sidebar/route logo images are no longer marked as unoptimized high-priority images.
- A conservative service worker adds an offline navigation fallback and static shell asset caching while excluding API, auth, account, billing, and clinical sync requests.
- Post-remediation validation: `npm run prisma:validate`, `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` passed; the test suite now has 159 passing tests.

Remaining architectural follow-up:

- The signed-in `/account` page still renders all tab content and therefore still loads more account data than the active surface needs. The safe next step is a focused account navigation/data split so tab selection becomes a server-routed boundary or each heavy panel loads independently.

## Baseline

| Area | Result |
| --- | --- |
| Framework | Next.js App Router, Next `16.2.6`, React `19.2.5` |
| Runtime | Node `24.x`; sampled Sentry `/account` events report `Node v24.15.0` |
| Data/auth/billing | Prisma `7.8.0`, Neon/Postgres, NextAuth beta, Stripe, Sentry |
| Validation | `npm run prisma:validate`, `lint`, `typecheck`, `test`, and `build` passed |
| Tests | 23 suites, 144 tests, 0 failures |
| Build output | 46 static pages generated, but almost all application routes render dynamically |
| Audit | 3 low, 3 moderate advisories, no high/critical advisories |
| Sentry unresolved | 9 total: 8 development `/account` issues, 1 preview debug-route issue, 0 production issues |

Current performance targets used for this review: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1 per [web.dev Core Web Vitals](https://web.dev/articles/vitals). Lighthouse 10 performance weights are FCP 10%, Speed Index 10%, LCP 25%, TBT 30%, and CLS 25% per [Chrome Lighthouse docs](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring).

## Performance Findings

### Lab Trace Results

Chrome DevTools traces were run against production and local production build. These are lab traces, not real-user field data, and authenticated flows were not covered because no non-PHI test account credentials were available.

| Route | Production LCP | Production CLS | Local LCP | Local CLS | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| `/` | 1989 ms | 0.00 | 117 ms | 0.00 | Production LCP has a large load-delay component on the home wordmark/brand path |
| `/chimer` | 555 ms | 0.00 | 131 ms | 0.00 | Good public lab result |
| `/notes` | 754 ms | 0.00 | 146 ms | 0.00 | Good public lab result |
| `/notes/soap` | 649 ms | 0.00 | 137 ms | 0.00 | Good public lab result |
| `/account` | 330 ms | 0.00 | 179 ms | 0.00 | Unauthenticated path only; does not exercise Sentry DB fanout |
| `/calendar` | 215 ms | 0.00 | 167 ms | 0.00 | Unauthenticated path only |
| `/anatomime` | 337 ms | 0.00 | 147 ms | 0.00 | Good public lab result |

Production home Lighthouse showed Accessibility 100, Best Practices 96, SEO 63, and Agentic Browsing 100 on both mobile and desktop navigation audits. The failing items were console 401s and non-crawlability. Non-crawlability is intentional during private alpha because `app/layout.tsx` sets `robots.index = false`; it becomes a launch blocker when public indexing is desired.

### P1: Anonymous Pages Make Authenticated Account Sync Calls

Evidence:

- `components/providers/settings-provider.tsx` calls `syncCloudSettings()` on mount and fetches `/api/account/preferences`.
- `components/providers/therapist-settings-provider.tsx` calls `syncCloudSettings()` on mount and fetches `/api/account/profile`.
- Production and local home both log two 401 resource errors for those endpoints.
- Lighthouse Best Practices is 96 instead of 100 because of console errors.

Risk:

Every anonymous visit creates avoidable account API traffic, console noise, and Sentry/network surface. This is also a likely contributor to the feeling of sluggishness on phones because the app does account work before the user asks for account behavior.

Recommendation:

Pass a server-derived `canSync`/signed-in flag into both providers or use an unauthenticated bootstrap state so anonymous pages never call account sync endpoints. Signed-in users should still get cloud preference sync, but it should be explicit and silent-failing only after auth is known.

Acceptance:

- Anonymous `/` and `/notes` make no `/api/account/profile` or `/api/account/preferences` requests.
- Browser console has zero 401 resource errors on public pages.
- Existing local settings behavior is unchanged.

### P1: `/account` Does Too Much Server/Data Work at Once

Evidence:

- `app/account/page.tsx` fans out `userProfile.findUnique`, `userRole.findMany`, `credentialVerification.findMany`, `userPreference.findUnique`, multiple counts, membership summary, pricing catalog, and account security state inside `Promise.all`.
- `getAccountSecurityState()` then performs another `prisma.user.findUnique`.
- `components/sidebar/sidebar.tsx` calls `isCalendarDatabaseReady()` and membership queries as part of app sidebar data.
- `lib/calendar-readiness.ts` runs a `to_regclass` readiness query against calendar tables.
- Sentry slow DB query issues `MASSAGELAB-4/5/6/7/8/9` all cluster on development `GET /account`.

Risk:

The account page has become a data fanout page. It is acceptable for early alpha, but it will not scale well as membership, security, calendar, and credential verification grow. It also makes Sentry noise hard to triage because unrelated DB checks all appear under one route.

Recommendation:

Split account data by tab/surface, dedupe user/security lookups, and remove schema readiness checks from hot layout/sidebar paths. Calendar readiness should be a cached startup/admin health concern, not a per-route query. Pricing data should be cached or separated from account profile/security rendering.

Acceptance:

- Signed-in `/account` loads above-the-fold account shell with fewer blocking DB calls.
- Calendar readiness query does not run on unrelated page views.
- Sentry slow-query issue count for `/account` stops increasing after the change.

### P2: Home LCP Is Passing but Fragile

Evidence:

- Production `/` LCP was 1989 ms with most time in LCP load delay.
- Local `/` LCP was 117 ms, so the problem is not raw React rendering.
- `app/page.tsx`, `components/layout-wrapper.tsx`, and `components/sidebar/app-sidebar-client.tsx` use brand images with `next/image` `unoptimized` and `priority`.
- Production brand assets returned `cache-control: public, max-age=0, must-revalidate`.

Risk:

Home is under the 2.5s LCP target in this trace, but it is close enough that mobile networks and cold cache can push it over. The current image/cache strategy prevents the brand assets from behaving like immutable app-shell assets.

Recommendation:

Stop using `unoptimized` for brand images unless there is a measured reason, and add long-lived immutable caching for `/brand/*` and `/icons/*` assets. Consider an optimized SVG or preloaded critical wordmark for the home LCP element.

Acceptance:

- Cold mobile trace for `/` stays below 2.5s LCP with throttling.
- Brand assets get stable long-cache headers or are bundled/optimized in a way that removes repeated validation from the critical path.

### P2: Global Animated Background Is a Mobile Cost Center

Evidence:

- `components/layout-wrapper.tsx` renders `MovingBackground` across most routes.
- `components/moving-background.tsx` uses a full-viewport canvas, `requestAnimationFrame`, and `filter: blur(100px)`.

Risk:

Even if lab LCP is good, a constant canvas animation and large blur are the type of work that drains mobile battery, hurts long sessions, and worsens perceived sluggishness. The risk is highest for users who install the PWA and leave it open.

Recommendation:

Respect `prefers-reduced-motion`, pause on hidden tabs, and consider a static or reduced animation mode by default on small screens. Keep richer animation for pages where it materially helps the product experience.

Acceptance:

- No continuous animation work when reduced motion is enabled.
- Mobile profile shows lower main-thread and paint/GPU activity on long idle sessions.

### P2: Root Layout Makes Public Routes Dynamically Expensive

Evidence:

- `app/layout.tsx` calls `getAppSidebarData()` before rendering all routes.
- `getAppSidebarData()` reads auth/session and sidebar calendar context.
- Build output shows almost all application routes as dynamic despite many public/static candidates.

Risk:

This limits static caching, makes every route inherit auth/sidebar concerns, and raises the cost of adding new public pages. It is manageable now but will compound as content, anatomy, marketing, and app-shell routes grow.

Recommendation:

Separate a public static layout from the authenticated app shell, or defer authenticated sidebar data into a narrower island. Do not make every public route pay for account/sidebar/calendar context.

Acceptance:

- Public content routes can build or serve statically where possible.
- Authenticated shell still works for signed-in application routes.

## Sentry And Reliability

### Current Unresolved Issues

All unresolved Sentry issues were reviewed from `derrick-bowersock-lmt/massagelab`.

| Issue | Environment | Route | Assessment |
| --- | --- | --- | --- |
| `MASSAGELAB-1` | preview | `/api/debug/sentry` | Expected debug-route test error. Source route is guarded by `MASSAGELAB_ENABLE_SENTRY_TEST_ROUTE`. Resolve or archive after confirming the route stays disabled. |
| `MASSAGELAB-2` | development | `/account` | `Error: [Filtered]`, 204 events. Too scrubbed to diagnose. |
| `MASSAGELAB-3` | development | `/account` | `ReferenceError: [Filtered]`, 25 events. Too scrubbed to diagnose. |
| `MASSAGELAB-4` | development | `/account` | Slow DB query: calendar table readiness query using `to_regclass`. |
| `MASSAGELAB-5` | development | `/account` | Slow DB query: `PracticeMembership.findFirst`. |
| `MASSAGELAB-6` | development | `/account` | Slow DB query: `UserPreference.findUnique`. |
| `MASSAGELAB-7` | development | `/account` | Slow DB query: `UserProfile.findUnique`. |
| `MASSAGELAB-8` | development | `/account` | Slow DB query: `User.findUnique` in account security state. |
| `MASSAGELAB-9` | development | `/account` | Slow DB query: `StudentAccess.findUnique`. |

No unresolved production issues were found in the Sentry query.

### P1: Sentry Scrubbing Is Both Too Aggressive and Not Strict Enough

Evidence:

- `lib/sentry-privacy.js` scrubs message/logentry/exception values so aggressively that client errors become `[Filtered]`.
- Sentry events still included request/transaction attributes such as Next router state tree data and request targets/query strings in spans/contexts, while stack/message data was not useful.
- `sentry.options.ts` wires `beforeSend`, `beforeSendTransaction`, and `beforeSendSpan`, so this is fixable centrally.

Risk:

The project is paying the privacy/telemetry cost without getting enough diagnostic value. On clinical/local-first routes, transaction metadata can be more revealing than the exception string. On non-clinical routes, fully filtered messages prevent debugging.

Recommendation:

Rework Sentry sanitization around allowlisted diagnostic fields:

- Preserve error type, first-party file names, function names, and safe framework stack shape.
- Strip request bodies, response bodies, cookies, auth/session identifiers, RSC router state, query strings, and clinical route context.
- Disable or heavily sample telemetry on clinical/local-first pages unless a route-specific privacy policy exists.
- Add unit tests around representative Sentry events/spans.

Acceptance:

- Reproduced client/server test errors keep useful first-party stack context without PHI.
- `/account?billing=checkout-error&_rsc=...` style targets are scrubbed.
- Clinical note route events do not contain note/intake/journal/ROM content or identifying localStorage payloads.

## Security And Privacy Review

### What Looks Solid

- Hosted clinical sync is explicitly gated in `app/api/clinical/sync/route.ts` and `lib/phi-sync.ts`, returning `403` until compliance flags are enabled and `501` until storage exists.
- Local clinical flows use localStorage and local file downloads; the notes search found no network upload path in SOAP/intake/journal/ROM pages.
- Stripe webhook handling verifies the `stripe-signature` before processing.
- Password reset uses random tokens, hashes stored tokens, expiration, and user-neutral response text.
- Auth rate limiting exists for registration and password reset request paths.
- Google account linking is intentionally guarded by verified Google profile checks.

### P1/P2 Security Items To Address

| Priority | Finding | Why It Matters | Recommended Action |
| --- | --- | --- | --- |
| P1 | Sentry privacy/diagnostics mismatch | Telemetry can leak metadata while hiding useful errors | Fix scrubber as described above and test it |
| P1 | Account sync calls on anonymous pages | Unnecessary authenticated endpoints, console noise, and tracking surface | Gate provider cloud sync on known signed-in state |
| P2 | TOTP encryption fallback is development-friendly | `lib/auth-security.js` has a development fallback key; production should fail closed | Hard-fail production if 2FA is enabled without `TOTP_ENCRYPTION_KEY` |
| P2 | `allowDangerousEmailAccountLinking` requires ongoing scrutiny | It is mitigated by verified Google profiles, but remains compatibility-sensitive | Keep tests/docs proving verified-profile-only linking |
| P2 | Ohio license lookup stores professional identity data | Not PHI, but sensitive enough for retention and logging rules | Document retention/logging policy and scrub verifier logs |
| P2 | Sentry DSN active in local production build | Useful for testing, but can pollute project issues | Use environment-aware sampling/filtering and separate dev/preview/prod triage views |

## PWA And Mobile Readiness

The app has install metadata: `app/manifest.ts` defines name, short name, start URL, scope, standalone display, theme/background colors, and maskable icons. `app/layout.tsx` includes manifest and Apple web app metadata.

Current PWA state is install-capable but not offline-capable. I did not find a service worker, Workbox setup, offline fallback, or explicit app-cache strategy. That is acceptable for alpha if documented as "installable web app" rather than "offline app." It becomes a product gap if users expect clinical tools to work reliably during poor connectivity.

PWA acceptance before a broader launch:

- Decide whether MassageLab is install-only or offline-capable.
- If offline-capable, add an explicit service worker strategy for static shell assets and local-first tools.
- Never cache authenticated account, billing, clinical sync, or Sentry requests blindly.
- Add mobile viewport regression tests for safe areas, keyboard behavior, long forms, timer controls, and installed-display mode.

## Architecture Map

Recommended module boundaries:

| Domain | Current Anchors | Review Notes |
| --- | --- | --- |
| Clinical local tools | `app/notes/*`, `lib/local-documents.js`, `lib/phi-sync.ts` | Good local-first posture; preserve export schemas and PHI messaging |
| Account/preferences | `app/account/*`, `components/providers/*`, `lib/account-*` | Needs sync gating and tab-level data loading |
| Auth/security | `auth.ts`, `lib/auth-*`, `app/api/account/security/*` | Sensitive and compatibility-heavy; test before refactors |
| Scheduling | `app/calendar/*`, `lib/calendar.js`, `lib/calendar-readiness.ts` | Keep readiness checks out of hot global render paths |
| Billing/membership | `app/api/billing/*`, `lib/stripe-billing.js`, `lib/membership*.js` | Webhook verification is in place; isolate Stripe env/runtime failures |
| Anatomy/game content | `app/anatomime/*`, `app/admin/anatomy/*`, `lib/anatomy*` | Independent enough for separate feature work |
| UI shell/navigation | `app/layout.tsx`, `components/layout-wrapper.tsx`, `components/sidebar/*` | Main source of global coupling and dynamic route behavior |
| Observability | `sentry.*`, `lib/sentry-privacy.js`, `app/global-error.tsx` | Needs better privacy-preserving diagnostic design |

The next architecture work should be branch-sized and reversible. Avoid a broad "clean architecture" rewrite. Start by removing global account work from anonymous pages, then make `/account` load less data above the fold, then split public/static layout from authenticated shell.

## Dependency Risk

`npm audit --json` reported no high or critical advisories. Current low/moderate advisories are:

- `next` moderate via nested `postcss@8.4.31`; npm's suggested fix is not usable because it suggests an invalid semver-major downgrade path.
- `postcss` moderate through Next's nested dependency; top-level `postcss` is already `8.5.14`.
- `nodemailer@7.0.13` low/moderate advisories, both direct and through Auth.js packages. No safe fix was available through the current dependency tree.

Recommendation:

Track these as dependency-watch items, not release blockers. Recheck after Next/Auth.js releases update their nested dependencies. Do not downgrade Next to satisfy npm's automated suggestion.

## Prioritized Remediation Backlog

| Priority | Branch | Work | Acceptance |
| --- | --- | --- | --- |
| P1 | `codex/fix-anonymous-sync-401` | Gate settings/profile provider cloud sync on known signed-in state | No account API 401s or console errors for anonymous public routes |
| P1 | `codex/fix-sentry-scrubbing-observability` | Rework Sentry scrubber to preserve useful stacks while stripping request/clinical metadata | Test events are diagnosable; request targets/query/router state are scrubbed |
| P1 | `codex/optimize-account-data-shell` | Split account data by surface, dedupe user/security lookups, remove calendar readiness from global hot path | `/account` slow-query Sentry issues stop increasing; fewer blocking DB calls |
| P2 | `codex/optimize-brand-assets-cache` | Optimize brand images and cache headers; remove unnecessary `unoptimized`/`priority` usage | Home cold mobile LCP remains below 2.5s |
| P2 | `codex/reduce-mobile-background-cost` | Add reduced-motion, hidden-tab pause, and mobile static/reduced background mode | Mobile idle profile shows lower paint/GPU/main-thread activity |
| P2 | `codex/add-browser-qa-harness` | Add Playwright smoke tests for public mobile routes, console errors, PWA manifest, and local-first no-network checks | CI fails on public route console errors and accidental clinical uploads |
| P2 | `codex/pwa-offline-strategy` | Decide install-only vs offline-capable; implement explicit service worker only if needed | Documented PWA behavior; no unsafe caching of auth/clinical/billing requests |
| P3 | `codex/public-seo-launch-checklist` | Prepare robots/metadata/trust pages for public launch | SEO score no longer blocked by intentional alpha `noindex` when ready |

## Suggested Browser Regression Coverage

Add a small e2e suite before major feature growth:

- Anonymous `/`, `/notes`, `/notes/soap`, `/chimer`, `/calendar`, `/anatomime` at mobile and desktop sizes.
- Assert zero console errors on public pages.
- Assert anonymous pages do not call account sync endpoints.
- Assert notes/intake/journal/ROM save/export paths do not make network requests carrying document content.
- Assert reduced motion disables or reduces animated background work.
- Assert manifest loads and icons resolve.

## Coverage Gaps In This Audit

- No authenticated non-PHI test account was available, so signed-in browser coverage was code/Sentry-based rather than interactive.
- No real-device mobile profiling was performed; Chrome DevTools lab traces are not a substitute for a mid-range phone on cellular.
- No invasive DAST was performed against production.
- Sentry issues were inspected from unresolved views only; resolved/historical trends were not part of this pass.
- Production field Core Web Vitals were not available from RUM/CrUX in this workspace.

## Recommended Next Sequence

1. Fix anonymous provider sync 401s and add regression tests.
2. Fix Sentry privacy scrubbing and add scrubber unit tests.
3. Refactor `/account` data loading and sidebar/calendar readiness checks.
4. Optimize brand asset caching and home LCP discovery.
5. Reduce mobile animation cost.
6. Add Playwright mobile/PWA/local-first smoke coverage.

This order addresses the highest user-visible and operational risks first while preserving the current alpha behavior, public APIs, Prisma schema compatibility, Stripe webhook behavior, PWA manifest/icons, and local-first clinical export schemas.
