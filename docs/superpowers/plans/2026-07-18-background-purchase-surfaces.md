# Background Purchase Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let verified users understand credits/ownership, redeem a credit, build a persistent multi-background cart, complete purchase consent/Checkout, and review permanent holdings and order states from the production background picker and Account/Billing.

**Architecture:** Consume Track 1A's no-store commerce snapshot/mutation APIs through one client provider mounted at the shared signed-in app shell. Extend the Track 2 full-screen Background panel and the Track 3 selected production carousel/card adapter with mode-aware acquisition state. Keep locked-card decisions, credit confirmation, compact cart, and status recovery as focused accessible surfaces; expose the same cart through a conditional account-commerce shell trigger, while Account/Billing receives the full portfolio and history view.

**Tech Stack:** Next.js App Router, React 19, TypeScript/JavaScript with focused JSDoc, existing Radix-backed controls/dialogs, CSS Modules, Track 2 immersive panel shell, Track 3 production carousel, Node test runner, Playwright.

**Approved design:** `docs/superpowers/specs/2026-07-18-background-commerce-ownership-design.md`

## Global constraints

- Start only after Track 1A is merged and deployed to the target environment, Track 2's immersive Background panel is landed, and Track 3's production background-carousel winner is landed. Create a new branch from refreshed `main`; suggested name: `codex/background-purchase-surfaces`.
- Before editing, reconcile the exact landed Track 2/3 component filenames. Update this plan's path references in the implementation PR description if names differ; do not recreate their controller, panel shell, or cards.
- Preserve the user-owned `TODO.md` edit and exclude it from every commit.
- Never infer ownership from the selected card, local storage, session, feature-key response alone, checkout success query, or optimistic UI. Track 1A's current snapshot is authoritative.
- Keep one shared background picker/carousel for Clock, Chimer, and Music visualizer contexts. Acquisition state is a presentation adapter, not a forked carousel.
- The Music page does not choose a Music-page background. It chooses the separate visualizer background through the shared full-screen Background panel.
- Keep MassageLab purchases visually and semantically separate from provider sales. Never render the site-purchase cart in Calendar's operator toolbar, Calendar drawers/menus, booking/service controls, or another provider-selling surface.
- For a signed-in user, render a conditional `CommerceCartTrigger` in the global account/commerce shell zone only while the authoritative snapshot has cart items or an active Checkout reservation. Hide it on Calendar routes, and hide it after fulfillment or another server snapshot leaves neither cart items nor a reservation.
- The shell trigger uses a generic commerce name and an accessible item-count/status badge so future physical-store lines can extend it. Track 1B still supports digital-background lines only. It opens the shared cart surface and never owns or duplicates cart state.
- Keep the compact cart in the full-screen Background panel and the complete wallet, portfolio, and history surface in Account/Billing.
- Locked-card `Select` opens exactly three actions: `Use free credit`, `Buy for $1`, and `Unlock all`. Do not add shuffle-colors or alternative purchase actions.
- Credit redemption is permanent and non-swappable; require explicit confirmation before mutation.
- Subscribers normally select included premium backgrounds. A separate `Keep permanently` route offers credit or $1 purchase while subscribed.
- Keep inactive/suspended/refunded/retired ownership history visible in Account/Billing but never present it as usable ownership.
- Every async state has accessible loading, success, error, retry, and focus behavior. Respect reduced motion and do not pause background animation merely because the acquisition dialog opens.
- Do not add this work to the public Roadmap.

## Target file map

- Create `lib/background-commerce-client.js` and `tests/background-commerce-client.test.mjs`.
- Create `components/backgrounds/BackgroundCommerceProvider.tsx`, `components/backgrounds/BackgroundAcquisitionDialog.tsx`, `components/backgrounds/BackgroundCreditConfirmationDialog.tsx`, and `components/backgrounds/BackgroundCommerceCart.tsx`.
- Create `components/commerce/CommerceCartTrigger.tsx`.
- Create `components/account/BackgroundCommercePanel.tsx`.
- Modify the landed Track 3 production files `components/backgrounds/background-carousel.tsx`, `components/backgrounds/background-carousel-card.tsx`, and their `components/backgrounds/BackgroundSelector.tsx` integration boundary.
- Modify the landed Track 2 `app/chimer/immersive-panel-shell.tsx` and the shared Clock/Chimer/Music visualizer entry points that render it.
- Modify `components/layout-wrapper.tsx`, `components/calendar/calendar-operator-top-bar.tsx`, and `components/shell/mobile-main-bar.tsx` for the shared provider and conditional account-commerce trigger. The trigger must remain outside Calendar's toolbar slot and be absent on Calendar routes.
- Modify `lib/account-surface-data.js`, `lib/account-surface-data.d.ts`, and `app/account/page.tsx`.
- Modify `lib/support-contact.js` and `tests/support-contact.test.mjs` only for a privacy-safe order reference/topic.
- Create `tests/background-commerce-surfaces.test.mjs` and `tests/browser/background-commerce.spec.ts`; update applicable Track 2/3 and account browser tests.
- Modify `docs/wiki/billing-memberships.md`, `docs/project-state.md`, and `docs/project-log.md` after validation.

---

## Task 1: Define the client snapshot, reducer, and recovery contract

**Files:**

- Create: `lib/background-commerce-client.js`
- Create: `tests/background-commerce-client.test.mjs`

- [ ] **Step 1: Write failing normalization tests**

Cover empty/invalid payloads, nonnegative credit counts, unique owned IDs, known public ownership statuses, integer money, USD formatting, stable cart order, safe notices, recent-order limits, and removal of unknown/private fields.

Use this pure public surface:

```js
export const EMPTY_BACKGROUND_COMMERCE_STATE = Object.freeze({
  status: "idle",
  snapshot: null,
  pendingAction: null,
  error: null,
});

export function normalizeBackgroundCommerceSnapshot(value) {}
export function backgroundCommerceReducer(state, action) {}
export function formatCommerceAmount(amount, currency = "usd") {}
export function backgroundCardCommerceState({ background, access, snapshot }) {}
```

Run: `node --test tests/background-commerce-client.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Define deterministic card states**

Return one of:

- `free`;
- `owned-credit`;
- `owned-purchase`;
- `included-subscription`;
- `locked-credit-available`;
- `locked-no-credit`;
- `unavailable`.

Also return `canSelect`, `showKeepPermanently`, `isInCart`, and `isReserved`. Subscription access does not imply ownership; non-active ownership statuses do not set `canSelect`.

- [ ] **Step 3: Implement reducer transitions**

Support fetch begin/success/failure, mutation begin/success/failure, checkout redirect begin/failure, and stale-response rejection by request ID. Mutation success replaces the full server snapshot; it never locally increments credits or invents ownership. Preserve the last good snapshot during a retryable failure.

- [ ] **Step 4: Pass focused tests and commit**

Run: `node --test tests/background-commerce-client.test.mjs`

Expected: PASS.

```powershell
git add lib/background-commerce-client.js tests/background-commerce-client.test.mjs
git commit -m "feat: define background commerce client state"
```

---

## Task 2: Add one shared commerce provider for every picker context

**Files:**

- Create: `components/backgrounds/BackgroundCommerceProvider.tsx`
- Create: `tests/background-commerce-provider.test.mjs`

- [ ] **Step 1: Write failing provider contract tests**

Source-inspect or render with the repo's existing harness to cover one initial no-store state fetch, request cancellation on unmount, focus/reconnect refresh, mutation serialization, full-snapshot replacement, 401/403 handling, and no commerce request for signed-out preview-only contexts until a locked action asks the user to sign in.

Expose:

```ts
type BackgroundCommerceContextValue = {
  state: BackgroundCommerceClientState;
  refresh(): Promise<void>;
  addToCart(backgroundId: string): Promise<void>;
  removeFromCart(backgroundId: string): Promise<void>;
  redeemCredit(backgroundId: string, idempotencyKey: string): Promise<void>;
  startCheckout(consent: PurchaseConsentInput): Promise<void>;
};
```

- [ ] **Step 2: Implement fetch and mutation boundaries**

Use same-origin credentials and `cache: "no-store"`. Parse stable public error codes only. Generate a new idempotency key when the user begins a redemption confirmation and retain it through network retries; a new user intent gets a new key. Checkout success sets `window.location.assign(url)` only after the server returns a valid same-provider HTTPS URL.

- [ ] **Step 3: Place the provider above shared immersive contexts**

Mount once in `components/layout-wrapper.tsx`, the smallest landed boundary shared by the signed-in shell, Clock/Visual/Background panels, and Music visualizer minimize/restore. Do not mount a provider per card or duplicate polling for Clock, Chimer, and Music visualizer. Signed-out shells retain the provider boundary without issuing commerce requests until an acquisition action asks the user to sign in.

- [ ] **Step 4: Pass focused tests and commit**

Run: `node --test tests/background-commerce-provider.test.mjs`

Expected: PASS.

```powershell
git add components/backgrounds/BackgroundCommerceProvider.tsx components/layout-wrapper.tsx tests/background-commerce-provider.test.mjs
git commit -m "feat: share background commerce client state"
```

---

## Task 3: Add production-faithful ownership and locked-card states

**Files:**

- Modify: `components/backgrounds/background-carousel.tsx`
- Modify: `components/backgrounds/background-carousel-card.tsx`
- Modify: `components/backgrounds/BackgroundSelector.tsx`
- Create: `tests/background-commerce-surfaces.test.mjs`
- Modify: applicable Track 3 carousel tests

- [ ] **Step 1: Write failing card-state tests**

Use real registry cards. Assert visible labels/badges for credit count, owned source, included subscription, in-cart, reserved checkout, refund pending, dispute suspended, and unavailable/retired. An owned active card selects normally. A locked card's `Select` opens acquisition instead of changing the background. A subscriber sees `Keep permanently` without interfering with normal selection.

- [ ] **Step 2: Extend the shared presentation adapter**

Feed normalized commerce state to the Track 3 card adapter. Keep controller semantics—focus, keyboard movement, selection, virtualization, and reduced motion—unchanged. Add only card metadata/actions and ensure background and Music-visualizer contexts render identical commerce state for the same account.

- [ ] **Step 3: Make credit and ownership visible inside the picker**

The full-screen panel header shows `2 credits`, `1 credit`, or `0 credits`; owned cards have an accessible `Owned` label plus source detail available to assistive technology. Do not show a fake count while loading; use a stable skeleton/status label.

- [ ] **Step 4: Pass focused tests and commit**

Run: `node --test tests/background-commerce-surfaces.test.mjs`

Expected: PASS.

```powershell
git add components/backgrounds/BackgroundSelector.tsx tests/background-commerce-surfaces.test.mjs
git commit -m "feat: show background ownership in picker"
```

Before committing, stage the exact landed Track 3 card/carousel files identified during prerequisites one path at a time. Do not stage by broad directory glob.

---

## Task 4: Build acquisition, permanent-credit confirmation, and compact-cart dialogs

**Files:**

- Create: `components/backgrounds/BackgroundAcquisitionDialog.tsx`
- Create: `components/backgrounds/BackgroundCreditConfirmationDialog.tsx`
- Create: `components/backgrounds/BackgroundCommerceCart.tsx`
- Create: `components/commerce/CommerceCartTrigger.tsx`
- Modify: `components/layout-wrapper.tsx`
- Modify: `components/calendar/calendar-operator-top-bar.tsx`
- Modify: `components/shell/mobile-main-bar.tsx`
- Modify: landed Track 2 `app/chimer/immersive-panel-shell.tsx`
- Modify: `tests/background-commerce-surfaces.test.mjs`
- Modify: applicable Track 2 immersive-panel tests

- [ ] **Step 1: Write failing locked-card dialog tests**

Assert the popup is titled with the selected background and offers exactly:

1. `Use free credit`;
2. `Buy for $1`;
3. `Unlock all`.

`Use free credit` stays visible but disabled at zero with explanatory text. `Buy for $1` adds the item to the account cart and returns focus to the initiating card. `Unlock all` uses the existing membership upgrade route and preserves a safe return path to the originating Clock/Chimer/Music visualizer context.

- [ ] **Step 2: Write failing subscriber acquisition tests**

Normal `Select` immediately uses the included background. `Keep permanently` opens a focused choice between available credit and `$1` purchase. Do not present `Unlock all` to an already subscribed user. If ownership appears during the dialog, refresh and close with a success status instead of duplicating acquisition.

- [ ] **Step 3: Implement the explicit credit confirmation**

Use direct language: the named background becomes permanently owned, one credit is spent, and the choice cannot be swapped. Require an unchecked confirmation control before enabling `Use credit`. Show the resulting server balance and select/reveal the owned background immediately on success. Retry the same idempotency key after a network failure.

- [ ] **Step 4: Implement the compact persistent cart**

Place it in the full-screen Background panel, collapsed to an item count/subtotal when space is tight. Expanded content shows thumbnail/name, `$1.00` line amount, remove control, automatic-removal notices, reservation expiry/status, subtotal, estimated tax wording, and `Review checkout`. A reserved cart disables edits and offers return/cancel actions. Subscribers retain cart items and see `Permanent access after membership ends`.

- [ ] **Step 5: Add the conditional account-commerce shell trigger**

Show the generic cart trigger only for a signed-in user whose server snapshot has cart items or an active reservation. Give it an accessible item-count/status badge and open the same `BackgroundCommerceCart` surface used by the picker. It must not appear on `/calendar` or nested Calendar routes, inside `CalendarOperatorToolbarProvider` content, Calendar drawers, quick-create actions, or booking/service controls. Desktop and mobile placements follow the configured top/bottom app bar without displacing the existing tool-priority rules. Do not render a zero-count placeholder while the snapshot is loading.

- [ ] **Step 6: Preserve Track 2 panel behavior**

Only the full-screen Background panel may hide the clock. Dialogs are nested modal surfaces with focus trapping; closing them returns to the initiating card without closing the Background panel. The underlying panel remains manually closable and does not regain the old auto-close timer.

- [ ] **Step 7: Pass focused tests and commit**

Run: `node --test tests/background-commerce-surfaces.test.mjs`

Expected: PASS.

```powershell
git add components/backgrounds/BackgroundAcquisitionDialog.tsx components/backgrounds/BackgroundCreditConfirmationDialog.tsx components/backgrounds/BackgroundCommerceCart.tsx components/commerce/CommerceCartTrigger.tsx components/layout-wrapper.tsx components/calendar/calendar-operator-top-bar.tsx components/shell/mobile-main-bar.tsx app/chimer/immersive-panel-shell.tsx tests/background-commerce-surfaces.test.mjs
git commit -m "feat: add background acquisition and cart dialogs"
```

---

## Task 5: Add checkout review, consent, return, and recovery states

**Files:**

- Create: `components/backgrounds/BackgroundCheckoutReview.tsx`
- Modify: `components/backgrounds/BackgroundCommerceCart.tsx`
- Modify: shared Clock/Chimer/Music visualizer route-state files from Track 2
- Create: `tests/background-checkout-surfaces.test.mjs`

- [ ] **Step 1: Write failing checkout-review tests**

Cover itemized backgrounds, `$1.00` each, subtotal, tax-exclusive wording, applicable tax added at Checkout, U.S.-only availability, final-sale exceptions link, one combined unchecked consent control, disabled submit until it is checked, duplicate submission lock, and processor error recovery without losing the account cart.

The single control combines acceptance of the current Digital Purchases & Refund Policy/final-sale terms with the express request for immediate digital delivery and acknowledgment that fulfillment begins immediately.

- [ ] **Step 2: Implement review as a focused dialog/sheet**

Render current document links/versions supplied by the legal-document module's public client constants. Send document IDs plus the combined-consent boolean; the server remains authoritative. Do not pre-check the control based on prior orders or account acceptance. Show a plain-language note that lawful exceptions, duplicate charges, unauthorized purchases, non-delivery, and unresolved material defects still follow the policy/support flow.

- [ ] **Step 3: Preserve origin through Checkout**

Submit a normalized return context (`clock`, `chimer`, or `music-visualizer`) that Track 1A maps to a safe internal URL. The cancel return reopens the Background panel and cart. The success return displays `Confirming purchase…` and polls/refreshes the snapshot until webhook-backed ownership appears; it never grants from `session_id`.

- [ ] **Step 4: Handle delayed and exceptional states**

If fulfillment is still pending, keep the selected visual state unchanged and provide `Check again` plus a support link. `REVIEW_REQUIRED`, refund pending, dispute suspended, and retired states use distinct non-alarming copy and never imply the account itself is disabled. Do not expose Stripe IDs in the URL or UI.

- [ ] **Step 5: Pass focused tests and commit**

Run: `node --test tests/background-checkout-surfaces.test.mjs`

Expected: PASS.

```powershell
git add components/backgrounds/BackgroundCheckoutReview.tsx components/backgrounds/BackgroundCommerceCart.tsx app/chimer/immersive-panel-shell.tsx app/chimer/page.tsx app/chimer/running-timer.tsx components/providers/music-provider.tsx lib/music-visualizer.js tests/background-checkout-surfaces.test.mjs
git commit -m "feat: add background checkout review and recovery"
```

---

## Task 6: Add Account/Billing wallet, portfolio, orders, and support entry

**Files:**

- Create: `components/account/BackgroundCommercePanel.tsx`
- Modify: `lib/account-surface-data.js`
- Modify: `lib/account-surface-data.d.ts`
- Modify: `app/account/page.tsx`
- Modify: `lib/support-contact.js`
- Modify: `tests/support-contact.test.mjs`
- Create: `tests/account-background-commerce.test.mjs`

- [ ] **Step 1: Write failing account-surface tests**

Cover current credit count, active owned portfolio grouped by source, inactive historical holdings, current cart shortcut, recent orders with item/amount/status, partial refunds, dispute states, retirement replacement credit, subscriber inclusion summary, loading/error/empty states, and cache invalidation after commerce changes.

- [ ] **Step 2: Extend the membership/account loader safely**

Load the Track 1A safe snapshot server-side for the signed-in verified user and add it to the existing `membership` Account surface contract. Keep its short cache only if every grant/cart/order/reversal path clears it; otherwise mark commerce data uncached and retain caching for membership pricing separately.

- [ ] **Step 3: Build the Account/Billing portfolio grid**

Use real background thumbnails/cards in a responsive portfolio grid. Each card shows active/inactive status, acquisition source, acquisition date, and a route back to the picker. The wallet explains two initial verified-account credits and permanent/non-swappable redemption. Do not offer swapping, deletion, or client-side restoration.

- [ ] **Step 4: Add orders and exception states**

Show internal order reference, date, item names, subtotal/tax/total, and public status. A partial refund identifies affected item names. A suspended/revoked/retired item remains in history. Do not show Stripe customer/session/payment/charge/refund/dispute IDs.

- [ ] **Step 5: Reuse the support flow with a safe reference**

Add a `Purchase or background access` topic that opens `/support` or the existing mailto flow with an internal order reference and problem area only. Do not place item history, payment IDs, user email, diagnostics, or exception details in query parameters. Keep the existing privacy-safe report body behavior.

- [ ] **Step 6: Pass focused tests and commit**

Run: `node --test tests/account-background-commerce.test.mjs tests/support-contact.test.mjs`

Expected: PASS.

```powershell
git add components/account/BackgroundCommercePanel.tsx lib/account-surface-data.js lib/account-surface-data.d.ts app/account/page.tsx lib/support-contact.js tests/support-contact.test.mjs tests/account-background-commerce.test.mjs
git commit -m "feat: show background ownership in account billing"
```

---

## Task 7: Complete cross-context accessibility, browser, and release validation

**Files:**

- Create: `tests/browser/background-commerce.spec.ts`
- Modify: applicable Clock/Chimer/Music visualizer browser tests
- Modify: `docs/wiki/billing-memberships.md`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

- [ ] **Step 1: Add deterministic commerce test fixtures**

Use the existing browser-test fixture strategy to create verified accounts in these states without calling live Stripe: two credits/no ownership, zero credits, credit-owned, purchase-owned, active subscriber/unowned, cart with several items, reserved checkout, partial refund, open dispute, retired ownership/replacement credit, and unverified account. Fixtures write through Track 1A services, not raw UI-local state.

- [ ] **Step 2: Test Clock and active Chimer flows**

For both `/clock` and active Chimer:

- open the full-screen Background panel;
- verify credit count and owned states;
- select free/owned/included backgrounds;
- open the exact three-action locked popup;
- confirm a credit redemption and immediate selection;
- add several items, refresh, and observe the account cart;
- close/reopen the panel and return focus correctly;
- verify Clock/Visual panels and digits remain unaffected after closing commerce dialogs.

- [ ] **Step 3: Test Music visualizer flows**

Select a station, use the persistent player-bar Background control, open the visualizer background picker, acquire/select a visualizer background, minimize it back to the player bar, and restore it. Verify no setting is presented as a Music-page background and that the same account credit/cart/ownership state appears as Clock/Chimer.

- [ ] **Step 4: Test Checkout returns without granting client authority**

Mock Checkout creation and webhook-delayed completion. On success return, verify the UI stays pending until the server fixture fulfills ownership. On cancel, verify the cart remains and the originating Background panel reopens. On retry/replay, verify no duplicate ownership or credit change. Test a safe support path for unresolved state.

- [ ] **Step 5: Run keyboard, screen-reader, contrast, and responsive checks**

At desktop and narrow-phone widths verify:

- card, dialog, confirmation, cart, and checkout focus order;
- focus trapping and return-to-trigger behavior;
- outside click closes the acquisition dialog but not the full-screen panel unless Track 2 explicitly defines that panel behavior;
- Escape closes only the topmost surface;
- disabled zero-credit action has discoverable explanation;
- status changes use an appropriate live region without repeated announcements;
- badges and active states do not depend on color alone;
- tool controls retain priority when branding collapses;
- the conditional site-purchase cart follows the configured app-bar position, is absent on Calendar routes/provider-selling controls, and exposes its count/status without color alone;
- reduced motion preserves clarity and resource use remains comparable to the selected Track 3 carousel baseline.

- [ ] **Step 6: Run complete validation**

Run:

```powershell
npm run lint
npm run test
npm run typecheck
npm run build
npm run test:browser -- tests/browser/background-commerce.spec.ts
git diff --check
```

Expected: all PASS.

- [ ] **Step 7: Update canonical documentation**

Record the shipped purchase surfaces, Account/Billing portfolio/history, shared visualizer behavior, support entry, known U.S.-only checkout posture, and Track 1 completion. Do not add this work to `docs/roadmap.md` or the public Roadmap page.

- [ ] **Step 8: Final scope and authority audit**

Confirm:

- no client state grants ownership;
- locked Select exposes exactly the three approved actions;
- zero-credit remains visible and disabled;
- subscriber normal selection and `Keep permanently` are distinct;
- credit redemption requires explicit permanent/non-swappable confirmation;
- cart persists after refresh/sign-out/device change through the account API;
- success return waits for webhook-backed state;
- Music only selects a visualizer background;
- the conditional global cart appears only for signed-in cart/reservation state, opens the shared cart, and stays absent from Calendar/provider-selling surfaces;
- Account/Billing shows wallet, portfolio, orders, reversals, and useful support entry;
- no sensitive processor data reaches markup, URLs, analytics, or logs;
- `TODO.md` is unchanged and unstaged.

- [ ] **Step 9: Commit final tests and documentation**

```powershell
git add tests/browser/background-commerce.spec.ts docs/wiki/billing-memberships.md docs/project-state.md docs/project-log.md
git commit -m "test: validate background purchase surfaces"
```

## Track 1B completion criteria

- Real production background cards show accurate locked, included, owned, cart, reservation, and reversal state in every immersive context.
- Verified users can explicitly redeem a credit or build a multi-item $1 cart without accidental selection/acquisition.
- Subscribers can use included backgrounds and optionally keep selected backgrounds permanently.
- Checkout consent and return states are clear, accessible, and never substitute for webhook fulfillment.
- Account/Billing exposes credits, owned portfolio, cart shortcut, orders, refunds/disputes/retirement, and support.
- A conditional account-commerce cart indicator makes pending site purchases discoverable outside the picker without conflating them with Calendar/provider sales, and its generic shell contract can accept future physical-store lines.
- Clock, Chimer, and Music visualizer share one mode-aware picker/controller.
- Browser, accessibility, responsive, resource, lint, test, typecheck, build, and diff validation pass.
- The public Roadmap and user-owned `TODO.md` remain untouched.
