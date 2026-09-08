# AtmoShaper Domain Cutover Plan

Source lock: `fa78ca01a42179329cc223df77c76f308e76320b`; plan recorded 2026-09-06. This documents later Phases 7-10. Task 2 changes no host, DNS record, provider, redirect or runtime. The [charter](atmoshaper-migration-charter.md), [external checklist](atmoshaper-external-account-checklist.md) and [rollback plan](atmoshaper-rollback-plan.md) govern execution.

## Final host matrix

These are intended final behaviors from the approved design, not assertions that new domains are owned, configured or serving. The old apex and www are separate browser origins and both require recovery evidence.

| Host | Source evidence / current knowledge | Intended behavior | Gate before behavior changes | Recovery / rollback rule |
| --- | --- | --- | --- | --- |
| `www.atmoshaper.com` | Intended primary; no DNS/provider verification yet | Canonical new product and matching application routes over HTTPS | Parallel project verified; legal/business/auth/mail/payment/media/PWA gates pass; exact production deployment authorized | Revert approved traffic/deployment configuration to prior verified service; preserve all new-origin user data |
| `atmoshaper.com` | Intended apex; unverified | Redirect to canonical www while preserving safe route semantics | Certificate, host ownership, callback exceptions and recovery requirements verified | Revert exact saved DNS/host rule; never forward credential-bearing query data blindly |
| `atmosha.com` | Protective short domain; unverified | Redirect to canonical; not a product-name alternative | Ownership/certificate/provider/redirect approval | Revert exact saved host rule |
| `massagelab.app` | Source docs record production alias; ordinary SEO points to old www | Serve new code where required for this origin's recovery; ordinary pages may redirect only after recovery is available | Host-aware recovery release tested at apex itself, sign-in and installed-old-PWA behavior verified | Keep recovery/export reachable; no blanket redirect or storage deletion |
| `www.massagelab.app` | Source SEO canonical and pinned billing webhook host | Serve new code where needed for recovery and existing provider endpoints; approved ordinary-page redirects later | Old www recovery tested independently; webhook/auth/calendar URLs reconciled | Retain exact callback/webhook/recovery service until separately retired |
| `media.massagelab.app` | Documented public media custom domain and checked-in CORS policy | Continue existing immutable media URLs | Any future media-host change needs dedicated compatibility/provenance/cache review | No object moves, invalidation, hostname retirement or URL rewrite in repository migration |
| Existing Vercel aliases | Source state names `massagelab.vercel.app`, `massagelab-dsbteam.vercel.app`, `massagelab-git-main-dsbteam.vercel.app`; live readback pending | Preserve rollback access and prevent unintended canonical indexing | Verify exact project/alias ownership and old deployment availability | Do not repoint/delete aliases implicitly |
| New isolated Preview/staging hosts | Not created; URLs deliberately unspecified | Non-production verification with noindex, approved callbacks/resources and separated telemetry | Phase 7 explicit creation and integration authorization | Preserve failed evidence; restore only authorized staging configuration |

No extra `www.atmosha.com` behavior is inferred. If that hostname is needed, add its exact ownership/certificate/routing contract under review before configuring it.

## Legacy recovery route contract

No dedicated recovery route exists in the locked source. Phase 8 must choose and implement an exact host-aware recovery entrypoint before cutover. Until then, the following existing routes and their required dependencies must remain reachable on **both** old origins. Listing them does not authorize a new route or redirect today.

| Recovery need | Existing route / owner | Later contract |
| --- | --- | --- |
| Transition explanation and support | `/`, `/support`, `/help`; `lib/support-contact.js` | Explain new identity, preserve old support contact, link matching new routes, warn that browser records and installations stay on their original origin. |
| Unlock/export professional records | `/notes`, `/notes/soap`, `/notes/intake`, `/notes/journal`, `/notes/rom`; vault provider | Preserve entitlement/auth access where required; unlock locally; offer valid encrypted export without automatic upload or cross-origin messaging. |
| Sign-in and recovery | `/login`, `/forgot-password`, `/reset-password`, `/verify-email`, `/api/auth/*`, account security routes | Sign in again on new origin; preserve old recovery long enough to unlock/export; do not carry cookies, OAuth codes, binding tokens or reset secrets into a redirect. |
| Existing provider callbacks | `/api/auth/callback/google`, `/api/calendar/google/callback`, `/api/billing/webhook` | Saved providers continue reaching the exact approved endpoint; no generic HTML/canonical redirect on callback or webhook traffic. |
| Old installed PWA | `/manifest.webmanifest`, `/sw.js`, `/offline.html`, `/icons/*`, current SW cached route set | Launch/update online and offline; reach recovery; explain replacement/reinstallation; do not unregister or clear old browser data automatically. |
| Account/payment recovery | `/account`, `/pricing`, existing checkout-return behavior | Explain existing subscription continuity and uncertain attempts; do not trigger new Checkout/Portal/payment merely by visiting or redirecting. |

The future route allowlist must preserve safe path mapping and explicitly handle query/fragment data. Callback tokens, room/device credentials, reset tokens and payment attempt identity must not be copied into public navigation or logs. Hash-only client state is not automatically recoverable by the server.

## Prerequisites and order

1. Finish source baseline, fresh-root destination and unchanged-runtime parity. Preserve exact old Git/deployment rollback references.
2. Obtain approved product/logo/legal-business decisions. Product copy changes do not modify accepted legal text, versions, operator or copyright.
3. Verify domain ownership, current DNS/nameservers/TTL, certificates, Vercel project/alias ownership and the exact old deployment. Record a redacted before/after host-rule set before any authorized edit.
4. Stage the new Vercel project with approved non-production Neon, Stripe test mode, approved OAuth callbacks, non-sending/test mail, media reads, separate Sentry and the [Ably staging gate](atmoshaper-external-account-checklist.md#ably-staging-gate). Explicitly verify either a separately authorized isolated Ably environment or deliberate provider-disabled polling fallback without publishing messages or exposing credentials; fallback alone cannot establish enabled-realtime parity. Never connect live providers because a repository exists.
5. Reconcile one exact auth host across Auth.js, saved Google origins/callbacks, trusted form origin policy and redirect behavior. Source `lib/trusted-form-origin.js` recognizes only the old apex/www special alias; new hosts require a focused later change and rejection tests.
6. Prepare Calendar callback and summary compatibility, SMTP sender/SPF/DKIM/DMARC/support continuity, Stripe business/Checkout/Portal/catalog/webhook return contracts, media CORS/range/cache, and search indexing. Obtain separate authorization for each provider write.
7. Implement and rehearse old-origin local data/PWA recovery with synthetic local records; preserve all legacy import formats. Verify both origins, old installed app, offline-to-online updates, sign-in and user-controlled encrypted transfer.
8. Rehearse traffic reversal, then separately authorize exact production deployment and DNS/host changes. Test known public routes and provider readbacks without creating unauthorized mail/payments/events.
9. Keep the recovery period open. Broader redirects and retirement are separate decisions.

## Recovery-period decision

**No end date or automatic expiry is approved.** The default is to keep recovery on both legacy origins available until Derrick approves a specific recovery period and its completion evidence. Phase 8 must propose a duration, communication/support plan and minimal aggregate success evidence; do not invent a calendar date or use cookies/PHI to track migration.

Broad redirects require confirmation that both origin-specific recovery routes still work, encrypted exports and all valid imports have been tested, old installed PWAs can reach recovery, accounts/support/provider callbacks remain safe, rollback remains viable, and no unresolved domain-bound credential dependency exists. A waiting period alone is not completion proof.

## Rollback and stop conditions

Before cutover save exact authorized deployment and host/DNS configuration references with secrets omitted. Reverse only reviewed traffic/routing changes to the prior verified deployment when necessary. Do not roll back databases destructively, rewrite old Git, delete new-origin records, clear old-origin storage, replay payment requests or remove still-used provider endpoints.

Stop the dependent phase if a provider cannot support parallel origins, auth canonical host is unknown, a passkey/domain-bound credential is found, an installed PWA loses recovery, a legacy vault/import becomes unreadable, legal/product identity cannot be separated, or rollback is not reproducible. Source search found no owned passkey/WebAuthn implementation, but installed dependency/provider verification remains required before treating that as a cutover guarantee.
