# Family-and-Friends Readiness Design

Date: 2026-08-28

Status: Approved design

Baseline: `origin/main` at `e90a23eb9835d1c3e6575f056a59167c5ea03b18`

## Purpose

Prepare MassageLab for a small family-and-friends launch in which invited people can create one account, sign in with either email/password or Google, recover access, subscribe with real payments if they choose, receive the correct feature access, and understand whenever the site is working on an action.

Readiness also includes keeping normal server work and third-party usage bounded so a small increase in traffic cannot create disproportionate cost or make the product unreliable. The program preserves existing accounts, subscriptions, purchases, and feature access.

## Outcome and launch posture

The first release audience is three to five trusted people. Each person will be offered a short guided check, followed by ordinary use. The initial release is a soft launch, not a claim that every future growth, clinical, provider, or administrative workflow is finished.

The technical success criteria are:

- a person can register, verify, sign in, sign out, recover access, and use either supported sign-in method without accidentally creating duplicate accounts;
- a person who pays through the supported membership Checkout receives the feature keys included in that purchase, including when Stripe sends duplicate or out-of-order events;
- navigation and meaningful actions visibly acknowledge the click and reach a clear success, error, or still-processing state;
- ordinary page rendering does not make avoidable provider calls or repeat expensive database work;
- release evidence comes from the exact commit being deployed, and production configuration is verified without exposing secrets or creating an unapproved charge; and
- an operator can pause new registrations or new membership Checkouts independently without locking existing users out of their accounts or paid access.

Early engagement is not a technical launch gate. People may not need MassageLab immediately, may use free features without registering, or may wait days before subscribing. The first two to four weeks are an observation period for natural use, not a short conversion test.

## Supported soft-launch scope

The soft launch supports the general-user experiences already intended for public use:

- account registration, email verification, login, logout, password reset, two-factor authentication where enabled, and account settings;
- Google sign-in and deliberate linking or unlinking of Google and password methods;
- Clock and Chimer;
- Music and Atmosphere;
- Education and Wellness experiences that are publicly available;
- free features and existing purchased access; and
- Supporter membership Checkout, persisted subscription access, and the customer billing Portal.

The guided tester checklist will not ask testers to use administration, provider setup, booking payments, hosted clinical synchronization, or any workflow that would involve real client records or protected health information. Publicly reachable routes outside the checklist still receive a serious-error smoke check so an obvious crash or unsafe link is not ignored.

## Product decisions

### One account, multiple sign-in methods

MassageLab has one user account per normalized email address. Email/password and Google are credentials attached to that account, not separate user identities. Either attached method is sufficient for normal login.

The application cannot infer from an email address alone that the person owns the matching Google account. It only treats Google as available after the person completes Google's OAuth proof.

When a Google email matches an existing password account, MassageLab will tell the person that the methods can be connected, but will not silently attach Google and will not create another MassageLab account. The secure connection flow requires:

1. successful proof of the Google account and its verified email;
2. successful sign-in to the existing MassageLab password account;
3. successful two-factor proof when two-factor authentication is enabled; and
4. an explicit confirmation that the two sign-in methods will access the same MassageLab account.

This is intentionally stronger than accepting Google's verified email by itself. It prevents a Google identity from taking over an existing password account merely because the provider reports the same address.

When a Google-first user adds a password, the user must have a recent Google reauthentication. When any user removes a sign-in method, the user must have recent authentication and at least one other usable method must remain. Linking, password addition, unlinking, and recovery send a privacy-safe security notification to the account email.

### Real subscriptions with controlled verification

Family and friends who choose to subscribe will use live Stripe payments. Existing successful live-subscription evidence is accepted as useful evidence and will not be repeated merely for ceremony.

Test mode remains the primary way to exercise failure, retry, duplicate-event, and cancellation scenarios. Production verification is read-only wherever possible. A new live charge, refund, cancellation, synthetic provider event, or provider-setting change requires separate, explicit authorization and an exact stated target.

### Acknowledged interactions

Every meaningful navigation or asynchronous action will acknowledge the user promptly. Fast operations may complete before a large indicator is noticeable, but the interface will still have a real pending state and will not add artificial delay.

Navigation feedback and local action feedback solve different problems and both are required:

- route changes use a restrained top progress indicator and appropriate Next.js route-loading boundaries; and
- local actions use the control itself or a nearby status region to say what is happening, prevent accidental duplicate submission, and announce changes accessibly.

## Non-goals

This program does not:

- move local-first clinical or PHI-bearing data into hosted storage;
- redesign unrelated product surfaces;
- change membership prices, tax policy, product packaging, or existing entitlements;
- introduce behavioral marketing analytics, session replay, or collection of individual browsing journeys;
- make provider onboarding, booking payments, or administrative operations part of the family-and-friends checklist;
- guarantee a particular signup, usage, or subscription rate; or
- perform an unapproved production payment or provider mutation.

## System model

The account and access flow is:

`sign-in method -> one MassageLab user -> persisted subscription or purchase -> feature keys -> available features`

The interaction contract is:

`user action -> immediate acknowledgement -> bounded pending state -> success, recoverable error, or explicit reconciliation state`

The launch-readiness program is split into six tracks. Tracks 1 through 4 are separate, reviewable implementation branches. Track 5 proves the combined exact commit and production prerequisites. Track 6 is the controlled soft launch.

## Track 1: Identity and account-method safety

### Identity invariant

Email normalization must be consistent anywhere an account is created, looked up, recovered, or linked. The database uniqueness rule remains the final protection against duplicate normalized emails, while application transactions turn collisions into safe, understandable outcomes.

Automatic provider linking that bypasses proof of the existing credential is removed. Provider account identifiers also remain unique so one Google identity cannot attach to multiple MassageLab users.

### New email/password account

The password-registration path will:

1. validate the email, password, consent, and applicable legal-document versions;
2. create or safely continue one pending account for the normalized email;
3. send a time-limited verification message without revealing whether an unrelated account exists;
4. display a useful pending state while the request is processed; and
5. route delivery or expiry failures to resend or recovery rather than leaving the person stranded.

Successful verification activates the account and performs any idempotent new-user provisioning that is required. That provisioning must not remain on every ordinary session refresh.

If the normalized email already belongs to a Google-first account, registration does not create a second user. A message sent to the verified address allows the owner to continue through the safe password-addition or recovery flow. The public response remains sufficiently generic to avoid turning registration into an account-discovery endpoint.

### New Google account

The Google-registration path will:

1. complete provider OAuth and require a verified provider email;
2. record the required legal-document acceptance before completing first-time account use;
3. create one user and attach the Google provider identity transactionally; and
4. recover cleanly if another request created the normalized user first.

If the Google email has no MassageLab account, the flow creates the Google-first account. If it matches an existing account, the matching-account flow begins instead.

### Matching-account link flow

For an existing password account, the Google callback records only a short-lived, private linking intent. Sensitive proof and provider tokens are never put in a URL. The person sees a plain-language notice that the email already has a MassageLab account and that connecting Google will make either sign-in method open that same account.

The person then signs in with the existing password and completes two-factor authentication if enabled. The link is committed only after the server verifies all of the following in one controlled flow:

- the linking intent is unexpired, single-use, and bound to the browser/session that started it;
- the recent password-authenticated user is the user for the normalized email;
- the verified Google email exactly matches that normalized email; and
- the Google provider identifier is not attached elsewhere.

Failure returns to a recoverable account-linking screen. It never falls through to creation of a second user. If the person does not know the password, the existing password-recovery flow is the route forward; Google proof alone does not substitute for the password in this matching-account case.

### Adding and removing methods

A Google-first user may add a password from account security after recent Google reauthentication. A password-first user may start the same explicit Google connection from account security. The UI lists available methods without exposing provider secrets.

Removing Google or disabling password authentication requires recent authentication. The server rejects any change that would leave the account with no usable sign-in method. A security notification describes the change and gives a recovery path if it was unexpected.

### Rate limiting and email safety

Login and two-factor protections continue to limit repeated credential failures. Registration and password-reset protections count every accepted request that can consume email or database resources, not only failed requests. Responses remain account-enumeration safe.

Protection uses privacy-reduced identifiers and network-level buckets with separate thresholds. Network thresholds must permit a normal household to register several people while still bounding automated abuse. Active blocks expire, and stale attempt records receive bounded cleanup so the table and raw identifiers do not grow forever.

Provider delivery failures, bounces, and complaints are observable through aggregate operational signals. The application does not log message contents, password material, OAuth tokens, full addresses, or raw account-linking proofs.

### Identity acceptance criteria

- Email/password and Google can each independently sign in to an account that has that method attached.
- Password-first plus matching Google ends with one user and two methods only after password and applicable two-factor proof.
- Google-first plus a password ends with one user and two methods only after recent Google proof or a verified recovery flow.
- Simultaneous matching requests cannot create two normalized users or attach one provider identity twice.
- Unlinking cannot lock a user out.
- Register, login, verification, reset, link, unlink, and failure states all leave a clear next action.
- Repeated successful register/reset requests are bounded without blocking a small household under normal use.

## Track 2: Subscription truth and entitlement convergence

### Authority boundaries

Stripe is the payment processor and external subscription authority. MassageLab's persisted membership record is the normal runtime source for feature access. Ordinary feature pages do not call Stripe to decide whether to render an entitlement.

The access flow is:

`Checkout -> Stripe -> signed webhook -> persisted membership snapshot -> feature-key resolver -> access`

Displayed plan names are never used as access checks. Existing feature-key rules, including `premium_backgrounds`, remain canonical.

### Webhook receipt and ordering contract

Every supported membership event is verified against the raw request body and Stripe signature before processing. The system persists a unique receipt keyed by provider event ID, together with only the metadata needed to process and audit it. Raw payment payloads and unnecessary customer data are not retained.

Each membership snapshot remembers the last applied provider event ID and provider event creation time. Processing follows these rules:

1. A completely applied duplicate is acknowledged without applying it again.
2. A newer event may apply the normalized subscription snapshot transactionally.
3. An older event may not overwrite a newer stored snapshot.
4. Events with equal or ambiguous ordering trigger bounded reconciliation against Stripe's current subscription state.
5. A previously received but unfinished event may be retried; uniqueness must not turn an earlier processing failure into a permanent no-op.
6. An unresolved event is not acknowledged as safely complete unless durable retry ownership exists. Without such a worker, the webhook returns a retryable failure.
7. Runtime account-state caches are cleared only after the membership transaction commits.

Reconciliation validates the expected Stripe customer and subscription relationship before applying the authoritative state. Provider calls occur outside database transactions, followed by a short compare-and-commit transaction.

### Checkout and return behavior

Checkout creation remains server-authoritative, price-allowlisted, idempotent, and tax-safe. The submitting control changes immediately to an explicit state such as “Opening secure checkout…” and ignores accidental double activation while the request is pending.

After Stripe returns, the success page does not assume that the redirect itself grants access. It displays a finalizing state and performs bounded polling of MassageLab's persisted membership state. It then shows one of:

- active access and a direct route into the included features;
- a clear payment or subscription problem with the appropriate recovery action; or
- a still-processing state with a safe retry/status action and support guidance.

The page does not blindly recreate Checkout or replay a durable payment action. The customer billing Portal remains available for an existing customer even when new membership Checkout is paused.

### Subscription acceptance criteria

- Duplicate webhook delivery is idempotent.
- A delayed older event cannot downgrade or reactivate a newer stored state.
- Equal-time or otherwise ambiguous events converge through provider reconciliation.
- Payment success, payment failure, cancellation, reactivation, plan change, and Portal return produce the expected persisted state and feature keys.
- Checkout return reflects persisted access rather than trusting URL parameters.
- An existing paid user keeps access during a new-Checkout pause.
- Failure and retry paths do not create duplicate subscriptions or charges.

## Track 3: Navigation and action feedback

### Route-level feedback

A shared top progress indicator provides immediate visual feedback for client-side route transitions. Appropriate `loading.tsx` boundaries provide route or segment fallback content when server-rendered work takes long enough to be visible.

The route fallback preserves the persistent shell and does not unnecessarily tear down active audio, clocks, timers, or other ongoing client state. Programmatic navigation and normal links must use the same observable transition contract.

Progress completes on route settlement and clears on error, cancellation, or unmount. Reduced-motion preferences are honored. The indicator is restrained enough that fast navigation still feels fast.

### Action-level feedback

A shared pending-state pattern covers server actions, forms, and client requests. At minimum it provides:

- an action-specific pending label;
- a visible busy treatment without removing the control's meaning;
- duplicate-submission protection while the same action is pending;
- `aria-busy` and an appropriate status announcement;
- a success or error outcome; and
- guaranteed cleanup in `finally` or the framework-equivalent settlement path.

Critical first adopters are registration, login, Google connection, two-factor verification, password-reset request and completion, email verification/resend, Checkout creation, billing Portal creation, account-security changes, and other account saves.

If a reversible read or navigation takes unusually long, the UI may offer a safe retry. If a durable action has an unknown result, the UI says that the result is being checked and reconciles status before offering another submission.

### Feedback acceptance criteria

- A throttled route transition immediately shows progress and a meaningful fallback without disrupting persistent media or timers.
- Each critical action acknowledges activation, blocks accidental duplicates, and reaches success or recoverable error.
- A thrown request cannot leave login, reset, Checkout, or Portal controls permanently busy.
- Keyboard and screen-reader users receive the same status information.
- Mobile portrait, mobile landscape, enlarged text, and reduced-motion modes retain visible, operable controls.

## Track 4: Server path and cost controls

### Measure before changing

The implementation records a privacy-safe baseline for the launch-critical routes before optimizing them. Evidence distinguishes warm and cold behavior and counts meaningful database or provider work rather than collecting individual user journeys.

The baseline covers public entry, registration, login/session refresh, account, a representative free feature, a representative entitled feature, Checkout creation, Checkout return, and the billing Portal. Measurements must be repeatable locally or in a controlled preview without production user data.

### Session and database path

Verified-user background-credit provisioning moves out of ordinary authentication refresh. It runs at the verified-account lifecycle point and remains idempotent, with a bounded repair/backfill route for existing accounts that need it.

Request handling loads session state once where practical and passes the result down instead of repeating authentication and entitlement queries. Specialized account or feature data is deferred until the route needs it. Runtime database access continues to use the pooled Neon connection; migrations and administrative operations use their documented direct path.

Database indexes and query changes are justified by measured launch-path evidence. No cache may make authentication, payment, or entitlement correctness depend on stale data.

### Provider and media path

Normal page render does not call Stripe, email delivery, or another paid provider merely to discover ordinary user state. Provider mutations originate from explicit user actions or verified webhooks.

Immutable public media receives long-lived cache headers and stable content-addressed or versioned URLs where supported. User-specific account and entitlement responses use private or no-store behavior appropriate to their sensitivity. Caching must not cross users.

### Operational bounds and pause switches

Registration and new Supporter Checkout have independent server-enforced pause switches. Their paused screens explain the temporary limitation and preserve login, password recovery, account access, existing entitlements, and the billing Portal.

Operational preparation includes bounded alerting or dashboard checks for:

- Neon connection pressure, compute/storage limits, and unusual query volume;
- Vercel function or bandwidth spend, error rates, and WAF observations;
- email delivery volume, bounces, and complaints;
- Stripe webhook failure and Checkout failure;
- R2 request, egress, and storage changes; and
- Sentry quota, error volume, and privacy-safe event content.

WAF rules begin in log or observation mode unless an already-proven emergency rule is needed. Spend alerts and provider limits inform a human decision; they do not silently lock paid users out.

### Cost and performance acceptance criteria

- Ordinary session refresh no longer performs background-credit provisioning work.
- Launch-critical render paths have recorded before-and-after timings and database-work evidence.
- Provider calls are absent from ordinary feature rendering.
- Registration and Checkout can be paused independently and tested without affecting existing login or access.
- Alerts are actionable and do not expose email addresses, account IDs, payment details, OAuth material, or PHI.

## Track 5: Exact-commit release proof

### Local and CI gates

The candidate commit must pass the repository's documented release gate from a clean worktree. At minimum, the recorded evidence includes:

- `npm run prisma:validate`;
- `npm run prisma:generate` when the schema or generated client requires it;
- `npm run typecheck`;
- `npm run lint`;
- the complete automated test suite;
- the production build;
- `git diff --check`; and
- focused browser lanes for identity, entitlement, and pending-state behavior, including throttled network coverage.

Browser evidence covers current desktop and phone-sized layouts, keyboard use, visible focus, enlarged text, landscape constraints, and reduced motion where the changed surface is affected.

### Production-readiness checks

Before sharing, the operator records read-only evidence for:

- the deployed commit matching the approved candidate;
- production migrations being current;
- Google OAuth callback/origin configuration;
- email sender/domain and delivery health;
- Stripe live-mode product/price/webhook configuration;
- database pooling and capacity posture;
- Sentry or equivalent error visibility;
- spend and capacity alerts; and
- the registration and Checkout pause controls.

Configuration checks record presence, environment, and safe status—not secret values, tokens, connection strings, provider payloads, or database rows. Any required production mutation is separated, named exactly, and presented for approval before execution.

### Documentation and runbook

Current state, project log, release checklist, and relevant wiki operations pages are reconciled with the exact candidate. Historical TODO or audit claims are not treated as current proof unless verified and mirrored into canonical documentation.

The operator runbook covers at least:

- a person cannot register;
- a verification or reset message does not arrive;
- a person cannot sign in with either method;
- a matching Google account cannot be connected;
- a person paid but a feature remains locked;
- subscription state appears stale or contradictory;
- new registrations need to be paused; and
- new membership Checkouts need to be paused.

Each runbook path starts with read-only diagnosis and preserves account privacy. It identifies the point at which a production provider action or payment change requires explicit authorization.

## Track 6: Soft-launch operation

### Guided first check

Each of the first three to five testers is offered a 10-to-15-minute check using only their own test account and non-sensitive content. Across the small group, the matrix covers:

- at least one new email/password registration and verification;
- at least one new Google registration;
- a matching-email connection flow if a willing tester has that situation;
- sign-out and return login through each supported method;
- one password-reset path;
- representative free and entitled features;
- navigation and action pending feedback on a slower connection; and
- one willing real Supporter subscription or confirmation of the already-proven live path, without pressuring anyone to pay.

No tester is asked to create a redundant charge solely for test coverage. A voluntary live subscription is observed through the normal user experience and privacy-safe operational state.

### Safety window and broader sharing

Testers are asked not to forward the site during the first 48 to 72 hours. During that window, the operator watches for identity failures, email delivery problems, paid-but-locked access, webhook errors, severe page failures, and unexpected provider spend.

If the technical gates remain healthy, the forwarding restriction is lifted and testers may share the site. Signup remains open; there is no invite-code or waitlist requirement. Independent pause switches provide the emergency boundary if abuse, cost, or correctness changes materially.

### Natural-use observation

For the next two to four weeks, observation focuses on support incidents, error trends, delivery health, payment/access convergence, and cost per level of traffic. Aggregate counts may be used, but individual browsing journeys and PHI are not collected.

Low usage, delayed return, free-only use, or low subscription conversion does not by itself fail the launch. Technical failure means that people cannot safely access the advertised experience, payments and entitlements disagree, important actions give no recoverable outcome, privacy boundaries fail, or costs become uncontrolled.

### Pause conditions

New registrations are paused if account duplication, unsafe linking, sustained delivery abuse, or a security concern makes new account creation unreliable. New Checkouts are paused if payment state cannot reliably converge to feature access, duplicate-charge risk appears, or Stripe processing errors cannot be diagnosed safely.

The whole public launch is paused for a credible privacy or security incident, widespread login failure, destructive data behavior, or loss of confidence in existing paid access. A pause preserves evidence, existing account recovery, and existing entitlements wherever it is safe to do so.

## Error handling and recovery contract

Errors are classified by what the user can safely do next:

- **Correctable input:** keep non-sensitive form state, identify the field, and allow correction.
- **Authentication proof required:** explain which method must be used without revealing whether another person's account exists.
- **Temporary provider or network problem:** retain safe context, clear pending UI, and offer a bounded retry.
- **Durable action with uncertain outcome:** check server state before allowing the action again.
- **Configuration or operational problem:** show a neutral user message, emit privacy-safe diagnostic context, and route the operator to the runbook.
- **Security-sensitive mismatch:** stop the flow, attach nothing, create nothing, and notify the established account through a safe channel when appropriate.

User-facing messages avoid internal codes, provider payloads, and blame. Operational diagnostics use correlation identifiers and coarse error categories without placing secrets or personal data in URLs or logs.

## Data and privacy boundaries

- Clinical notes, intake forms, journals, ROM sessions, and other PHI-bearing workflows remain local-first under the existing compliance gate.
- OAuth tokens, password material, two-factor secrets, provider signatures, raw email addresses used as limiter keys, and raw Stripe event payloads are not written to routine logs.
- Account-linking intent is encrypted or represented by an opaque, short-lived, single-use server-side record.
- Telemetry is aggregate and operational. It does not become behavioral profiling or session replay.
- Release evidence never includes credentials, connection strings, secret values, provider payloads, production database rows, or identifiable tester activity.

## Validation matrix

The implementation plan must map automated and manual evidence to these boundaries:

| Area | Normal path | Failure and concurrency path | Production-safe evidence |
| --- | --- | --- | --- |
| Email/password | register, verify, login, logout | duplicate request, expired link, reset failure, two-factor failure | sender/domain and delivery health |
| Google | first registration, repeat login | matching password account, provider collision, cancelled OAuth | callback/origin configuration |
| Method management | add and remove method | stale reauth, last-method removal, parallel linking | security notification delivery |
| Membership | Checkout, webhook, feature access, Portal | duplicate/delayed event, failure, cancel/reactivate, ambiguous ordering | live configuration and existing successful path |
| Pending feedback | route and critical action acknowledgement | thrown request, slow response, uncertain durable result | deployed browser smoke without destructive action |
| Server/cost | warm/cold route baseline | connection pressure, provider outage, pause switches | dashboards, quotas, alerts, pooling posture |
| Accessibility | keyboard, screen reader status, focus | enlarged text, landscape, reduced motion | focused deployed smoke |

## Branch and rollout order

The intended implementation order is:

1. **Identity branch:** remove unsafe automatic linking, implement explicit method-management flows, close rate-limit retention and success-count gaps, and add focused identity tests.
2. **Subscription branch:** add webhook receipt/order safety, Checkout-return convergence, and focused entitlement tests.
3. **Feedback branch:** add shared route and action pending states, then adopt them on launch-critical surfaces.
4. **Server/cost branch:** measure and simplify hot paths, move provisioning out of session refresh, add pause controls, and document operational bounds.
5. **Integration and release proof:** combine only reviewed branches, run the complete exact-commit gate, reconcile canonical documentation, and complete read-only production checks.
6. **Soft launch:** guided checks, the 48-to-72-hour safety window, broader sharing if healthy, and two-to-four weeks of natural-use observation.

Each branch must preserve unrelated behavior and existing entitlements. A later track may not silently weaken an earlier security, privacy, or access invariant. The implementation plan will name exact files, migrations, tests, commands, review boundaries, and rollback points only after this written design is reviewed and approved.

## Approval and implementation boundary

This document records the approved product and system design. It does not authorize a deployment, merge, new live payment, refund, cancellation, synthetic Stripe event, OAuth/provider-setting change, database mutation, or production secret change.

After written-spec approval, the next artifact is a detailed implementation plan under `docs/superpowers/plans/`. Application code work begins only from that plan and remains split into reviewable branch-sized changes.
