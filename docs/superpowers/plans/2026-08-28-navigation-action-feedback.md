# Navigation and Action Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every launch-critical route change and account/billing action immediate, accessible, recoverable feedback without remounting persistent music, shell providers, or timer state within its existing same-route/root-owned lifecycle.

**Architecture:** Use the root App Router `loading.tsx` boundary for a fixed progress bar and delayed canonical loader, Next's `useLinkStatus` inside owned links for the pre-fallback gap, and a narrow `usePendingNavigation` hook for ordinary programmatic pushes. Standardize client-request buttons with one shared async control. The shared submission component supports two explicit lifecycles: framework-owned `useFormStatus` for existing Server Actions and synchronous form-owned state for native billing POST/303 redirects, preserving both authorities while preventing duplicate submissions.

**Tech Stack:** Next.js 16.2 App Router (`loading.tsx`, `Link.onNavigate`, `useLinkStatus`), React 19.2, the existing canonical Loader/WebGL fallback, Tailwind CSS, Node.js 24 tests, and Playwright 1.60.

**Spec:** `docs/superpowers/specs/2026-08-28-family-friends-readiness-design.md`

## Global Constraints

- Execute after the reviewed identity and subscription heads so the final auth, method-management, Checkout, Portal, and membership-return interfaces are stable.
- Do not add a global router-event provider, document click listener, history monkey patch, pathname key, or artificial delay.
- Keep `MusicProvider`, `SidebarProvider`, `LayoutWrapper`, active audio, and other root client state mounted across navigation feedback. Preserve timer state within its existing same-route or root-owned lifecycle; a route-local Chimer timer may unmount after deliberate navigation away.
- Keep `app/loading.tsx` inside the existing root layout boundary; it must not add or wrap providers.
- Preserve modified clicks, new tabs, external links, Back/Forward navigation, Chimer's visual-draft navigation guard, and Chimer's custom timer navigation.
- Every pending state uses useful visible copy, duplicate-submit protection, `aria-busy`, one appropriate status announcement, and guaranteed error/settlement cleanup.
- Durable/redirect actions do not retry blindly. Membership return status continues reconciling persisted state rather than recreating Checkout.
- All loading overlays are pointer-events-none and must not cover or capture player/app-bar controls.
- The canonical Loader's WebGL context is delayed on route changes for 180 ms; the progress bar itself appears immediately.
- Reduced-motion mode keeps feedback visible while pausing decorative motion.
- Preserve native billing `method="POST"`, form actions, hidden fields, server-side Stripe creation, and HTTP redirects.
- Do not change auth/linking security, payment authority, prices, tax, entitlements, or provider settings in this branch.
- Use strict TDD, focused JSDoc, and one independently reviewable commit per task.

## Planned file structure

| File | Responsibility |
| --- | --- |
| `components/shell/route-loading-feedback.tsx` | Fixed immediate progress bar plus delayed canonical route loader/status. |
| `app/loading.tsx` | Root child-route fallback that preserves the persistent shell. |
| `components/shell/link-pending-indicator.tsx` | `useLinkStatus` descendant for owned Next Links. |
| `components/shell/use-pending-navigation.ts` | React-transition owner for ordinary programmatic push/replace with explicit local pending state. |
| `components/shell/app-tool-link.tsx` | Shows pending state without changing attention-ring geometry. |
| `components/sidebar/app-sidebar-client.tsx` | Uses `onNavigate` and link descendants instead of manual `router.push`. |
| `components/calendar/calendar-operator-top-bar.tsx` | Uses the pending-navigation hook for date-query pushes. |
| `app/notes/intake/client-page.tsx` | Uses the pending-navigation hook for the completed-intake route change. |
| `components/forms/async-action-button.tsx` | Shared pending button for client fetch/Auth.js actions. |
| `components/forms/pending-submission-form.tsx` | Framework-owned Server Action status plus synchronous form-owned native POST/303 status. |
| `app/account/actions.ts` and `app/account/page.tsx` | Profile/credential Server Actions expose pending plus explicit success/failure notices. |
| `app/login/login-form.tsx` | Email/Google pending ownership and network/Auth.js recovery. |
| `app/register/register-form.tsx` | Email/Google pending ownership and recovery. |
| `app/forgot-password/page.tsx` | Bounded reset-request pending/error cleanup. |
| `app/reset-password/reset-password-form.tsx` | Bounded reset-confirm pending/error cleanup. |
| `app/account/link-google/link-google-form.tsx` | Shared pending control for secure matching-account confirmation. |
| `app/account/security/sign-in-methods-panel.tsx` | Shared pending control for add/change/remove credentials. |
| `app/account/security/security-panel.tsx` | Shared pending control for TOTP and backup-code actions. |
| `components/membership/pricing-cards.tsx` | Native Checkout and Portal forms use redirect-pending owner. |
| `app/pricing/page.tsx` | One-time-support native form uses redirect-pending owner. |
| `tests/interaction-feedback.test.mjs` | Source/component contracts for boundaries, hooks, copy, cleanup, and native form preservation. |
| `tests/browser/interaction-feedback.spec.ts` | Throttled route/auth/billing feedback, persistence, accessibility, and viewport proof. |
| `tests/helpers/membership-pricing-cards.mjs` | Pass-through mocks for new client form wrappers. |
| `tests/browser/ci-lanes.mjs` | Assigns interaction spec exactly once per desktop/mobile project. |
| `tests/browser/ci-lanes.test.mjs` and `tests/browser-qa-harness.test.mjs` | Guard 28 project/spec pairs after identity, membership, and interaction specs. |

---

### Task 1: Add persistent-shell navigation feedback

**Files:**
- Create: `components/shell/route-loading-feedback.tsx`
- Create: `components/shell/link-pending-indicator.tsx`
- Create: `components/shell/use-pending-navigation.ts`
- Create: `app/loading.tsx`
- Create: `tests/interaction-feedback.test.mjs`
- Create: `tests/browser/interaction-feedback.spec.ts`
- Modify: `components/shell/app-tool-link.tsx`
- Modify: `components/sidebar/app-sidebar-client.tsx`
- Modify: `components/calendar/calendar-operator-top-bar.tsx`
- Modify: `app/notes/intake/client-page.tsx`
- Modify: `tests/browser/ci-lanes.mjs`
- Modify: `tests/browser/ci-lanes.test.mjs`
- Modify: `tests/browser-qa-harness.test.mjs`

**Interfaces:**
- Produces: `RouteLoadingFeedback({ label = "Loading page", loaderDelayMs = 180 })`.
- Produces: `LinkPendingIndicator()` as an always-decorative Link descendant using `useLinkStatus`.
- Produces: `usePendingNavigation(): { isPending: boolean, push(href): void, replace(href): void }` using React `startTransition` around Next router calls.
- Attribute: fixed bar has `data-route-progress="pending"` and `pointer-events-none`.
- Attribute: owned pending links have `data-navigation-pending="true"`.

- [ ] **Step 1: Write failing source/component contracts**

In `tests/interaction-feedback.test.mjs`, assert each new path exists before reading so RED is an intentional assertion instead of an uncaught file error. Then read/render the new owners and assert:

```js
assert.match(rootLoading, /<RouteLoadingFeedback/)
assert.match(routeFeedback, /loaderDelayMs = 180/)
assert.match(routeFeedback, /data-route-progress="pending"/)
assert.match(routeFeedback, /pointer-events-none/)
assert.match(routeFeedback, /aria-busy/)
assert.match(linkIndicator, /useLinkStatus/)
assert.match(linkIndicator, /aria-hidden="true"/)
assert.match(pendingNavigation, /startTransition/)
assert.doesNotMatch(sidebar, /router\.push\(href\)/)
assert.match(sidebar, /onNavigate=/)
assert.match(calendarTopBar, /usePendingNavigation/)
assert.match(intakePage, /usePendingNavigation/)
```

Also assert `app/loading.tsx` imports no Provider and neither root layout nor LayoutWrapper is keyed by pathname/search parameters.

- [ ] **Step 2: Write the throttled route RED browser case**

In `tests/browser/interaction-feedback.spec.ts`, delay the destination RSC/document response while allowing/aborting prefetch probes. Start the deterministic `MassageLab Proof Drone` music fixture used in `tests/browser/public-routes.spec.ts`, click an owned tool link, and assert:

- link-local pending state appears;
- fixed route progress appears and captures no pointer events;
- after about 180 ms, exactly one accessible “Loading page” status appears;
- destination eventually renders and feedback disappears; and
- music player DOM identity and playing station remain unchanged throughout.

Add two exact continuity cases. First, keep the music assertion above across a real `/music` -> `/clock?source=music` Link transition. Second, reuse the deterministic `startActiveChimer` steps and DOM-identity pattern from `tests/browser/background-palette.spec.ts`: start a one-minute Chimer, store the `running-timer-clock` node, open the existing Visual draft controls and change color mapping, then assert the exact timer node remains and its displayed time advances. A deliberate navigation away from `/chimer` may unmount this route-local timer; the regression boundary is that the new route feedback is never keyed into or allowed to recreate it. Source assertions preserve Chimer's existing guarded push/replace implementation unchanged.

- [ ] **Step 3: Run focused tests and verify RED**

```bash
node --test tests/interaction-feedback.test.mjs
npm run build:browser-qa
npm run test:browser -- tests/browser/interaction-feedback.spec.ts --project=desktop-chromium
```

Expected: source test fails for missing files; browser case fails because no route/loading indicator exists.

- [ ] **Step 4: Implement route feedback**

Export:

```tsx
export type RouteLoadingFeedbackProps = {
  label?: string
  loaderDelayMs?: number
}

export function RouteLoadingFeedback({
  label = "Loading page",
  loaderDelayMs = 180,
}: RouteLoadingFeedbackProps): React.ReactElement
```

Render the 2–3 px fixed top bar immediately with a z-index above app bars, `pointer-events-none`, and `motion-reduce:animate-none`. Start a cleanup-safe timer and mount the canonical `Loader` only after 180 ms. The container owns `aria-busy="true"`; when visible, the canonical Loader owns the single `role="status"` and accessible label. Clear the timer on unmount.

`app/loading.tsx` returns only `<RouteLoadingFeedback />`.

- [ ] **Step 5: Add link-local status without geometry changes**

`LinkPendingIndicator` must be rendered inside `<Link>` so `useLinkStatus()` receives that link's state. When pending, render a 14–18 px Loader/glyph with `aria-hidden="true"` inside the existing icon footprint, keep the accessible name on the link, and set the data attribute. Do not pass Loader's default label/role; the route fallback remains the single announced status.

Refactor `AppToolLink` to:

```tsx
<Link {...linkProps}>
  <AppToolLinkContent {...contentProps} />
</Link>
```

The descendant content owns `useLinkStatus`. Do not change the `MetalAttentionRing` wrapper or measured dimensions.

- [ ] **Step 6: Cover ordinary programmatic navigation**

Create `usePendingNavigation` with `useRouter`, `useTransition`, and memoized `push`/`replace` functions that call the matching router method inside `startTransition`. The caller owns its operation-specific disabled/status treatment. Adopt it in the calendar date-query navigation and the completed-intake navigation; each origin shows `aria-busy` and prevents a second activation until settlement. Login keeps its action-owned pending state from Task 2. Background Checkout return keeps its existing bounded reconciliation state. Chimer's guarded navigation and Chimer page close handler remain unchanged and are asserted by source test because replacing them would bypass draft/timer intent handling.

- [ ] **Step 7: Replace sidebar manual navigation**

Remove `useRouter` and custom modified-click checks used only to call `router.push`. Use normal `<Link>` behavior with `onNavigate={closeMobileSidebar}` and render the pending indicator as a descendant. External/non-Link actions stay unchanged. This lets Next preserve modifier-click, new-tab, external, and Back/Forward semantics.

- [ ] **Step 8: Register the spec, run focused tests, and commit**

Add `interaction-feedback.spec.ts` to `ORDINARY_BROWSER_QA_SPEC_FILES` now so this first commit remains green under the complete Node suite. Assign desktop to lane 1 and mobile to lane 2, update harness assertions to 14 ordinary specs/28 exact project-spec pairs, and preserve four nonempty exact-once lanes.

```bash
node --test tests/interaction-feedback.test.mjs tests/sitewide-loader.test.mjs tests/browser/ci-lanes.test.mjs tests/browser-qa-harness.test.mjs
npm run build:browser-qa
npm run test:browser -- tests/browser/interaction-feedback.spec.ts --project=desktop-chromium
npm run typecheck
npm run lint
git diff --check
git add components/shell/route-loading-feedback.tsx components/shell/link-pending-indicator.tsx components/shell/use-pending-navigation.ts app/loading.tsx components/shell/app-tool-link.tsx components/sidebar/app-sidebar-client.tsx components/calendar/calendar-operator-top-bar.tsx app/notes/intake/client-page.tsx tests/interaction-feedback.test.mjs tests/browser/interaction-feedback.spec.ts tests/browser/ci-lanes.mjs tests/browser/ci-lanes.test.mjs tests/browser-qa-harness.test.mjs
git commit -m "feat: add persistent-shell navigation feedback"
```

Expected: PASS and music remains mounted.

---

### Task 2: Standardize recoverable account-action feedback

**Files:**
- Create: `components/forms/async-action-button.tsx`
- Create: `components/forms/pending-submission-form.tsx`
- Create: `lib/account-action-outcome.ts`
- Create: `tests/account-action-outcome.test.mjs`
- Modify: `tests/interaction-feedback.test.mjs`
- Modify: `tests/browser/interaction-feedback.spec.ts`
- Modify: `app/login/login-form.tsx`
- Modify: `app/register/register-form.tsx`
- Modify: `app/forgot-password/page.tsx`
- Modify: `app/reset-password/reset-password-form.tsx`
- Modify: `app/account/link-google/link-google-form.tsx`
- Modify: `app/account/security/sign-in-methods-panel.tsx`
- Modify: `app/account/security/security-panel.tsx`
- Modify: `app/account/actions.ts`
- Modify: `app/account/page.tsx`
- Modify: `tests/auth-registration.test.mjs`
- Modify: `tests/account-page-tabs.test.mjs`

**Interfaces:**
- Produces `AsyncActionButtonProps` from Button props plus `pending`, `idleLabel`, `pendingLabel`, and optional icon.
- Produces `PendingSubmissionForm` and `PendingSubmitButton`; the form accepts the existing string or Server Action `action` unchanged. Function actions use React's framework-owned `useFormStatus` lifecycle, while native string POST/303 forms use a synchronous first-submit claim.
- Produces `settleAccountAction({ run, successPath, failurePath })`, which converts an operational action success/failure into one safe redirect path without catching Next redirect control flow.
- Public auth forms use `activeSubmission: "email" | "google" | null` where both methods appear.
- Account security uses one `pendingAction` enum/string so incompatible actions cannot run concurrently.

- [ ] **Step 1: Write failing shared-button and source tests**

Assert this exact API:

```ts
export type AsyncActionButtonProps =
  Omit<React.ComponentProps<typeof Button>, "children" | "aria-busy"> & {
    pending: boolean
    idleLabel: string
    pendingLabel: string
    icon?: React.ReactNode
  }
```

Render idle/pending states and prove pending means disabled, `aria-busy=true` on the control/status owner, stable visible label footprint, decorative 18 px canonical Loader, and no second onClick submission. Test `PendingSubmissionForm` in both modes: a function action keeps its original action identity and descendant `PendingSubmitButton` follows `useFormStatus`, including automatic clearing when the action resolves or rejects; a string POST action uses `flushSync` on the first valid submit, prevents a repeat submit, and preserves the original action/method/hidden fields. Invalid native forms never claim pending. Source-contract assertions require `try/catch/finally` or an explicit navigation-success exception in each affected client form.

Create `tests/account-action-outcome.test.mjs` with injected success and thrown-operation cases for `settleAccountAction`. Assert it returns only the allowlisted success/failure path and never leaks the thrown message. Source-test `app/account/actions.ts` so profile and credential operational work use the helper and the final `redirect(destination)` remains outside the helper/catch boundary.

- [ ] **Step 2: Add delayed and thrown-request browser cases**

Delay registration, reset request, reset confirmation, Google-intent start, link confirmation, one security-method request, and the account profile Server Action. Assert immediate operation-specific copy, disabled controls, one status announcement, and exactly one request after repeat activation. Abort representative forgot/reset/security client requests and assert busy clears, the control re-enables, and a generic `role="alert"` appears. Profile-save browser coverage uses delayed success and returns to the Profile tab with an explicit success notice; the deterministic thrown-operation/failure redirect is owned by `tests/account-action-outcome.test.mjs`, so no test-only production header or database failure seam is added.

For email login, source-test that successful Auth.js sign-in remains pending through `router.push()` and `router.refresh()`; pending clears only on error or a non-navigation result.

- [ ] **Step 3: Run focused tests and verify RED**

```bash
node --test tests/interaction-feedback.test.mjs tests/auth-registration.test.mjs tests/account-action-outcome.test.mjs
npm run build:browser-qa
npm run test:browser -- tests/browser/interaction-feedback.spec.ts --project=desktop-chromium
```

Expected: FAIL for the missing shared button and stuck/error paths.

- [ ] **Step 4: Implement the shared async button**

`AsyncActionButton` renders the existing Button, applies `disabled={pending || disabled}`, sets `aria-busy={pending}`, keeps a stable inline-flex footprint, and swaps visible idle/pending copy. The nested Loader is decorative because the visible text owns the accessible name.

Implement `PendingSubmissionForm` as a client component with two explicit lifecycles. When `action` is a function, pass that function through unchanged and let descendant `PendingSubmitButton` read `useFormStatus`; React owns settlement, so pending clears when the action resolves or rejects. In this mode the descendant control/status owner—not the parent form—sets `aria-busy` and renders the polite status. When `action` is a string, use a form context plus synchronous first-valid-submit claim with `flushSync` before the native POST/303 navigation and prevent repeats; that parent form may also set `aria-busy` from its owned state. Native constraint validation remains authoritative: invalid forms never enter pending. Both modes preserve the existing action/method/hidden fields. The nested Loader is decorative because the visible pending label owns the accessible name.

Create `settleAccountAction` in `lib/account-action-outcome.ts`. It awaits an injected operational callback and returns only the caller's fixed success or failure path. Use it for profile persistence and for the operational portion of credential submission after authentication/legal redirect checks. Call `redirect(destination)` after the helper returns, outside its catch boundary; framework redirect exceptions are never converted into failure notices.

- [ ] **Step 5: Adopt one action owner per form/panel**

Use `activeSubmission` for login/register so email and Google cannot overlap. Wrap every asynchronous branch in recovery handling:

```tsx
setActiveSubmission("email")
setStatus(null)
try {
  const result = await performAction()
  if (result.navigates) {
    router.push(result.destination)
    router.refresh()
    return
  }
  setStatus(result.message)
} catch {
  setStatus("Something went wrong. Please try again.")
} finally {
  if (!navigationStarted) setActiveSubmission(null)
}
```

Use operation-specific pending copy:

- `Signing in…`
- `Connecting to Google…`
- `Creating account…`
- `Sending reset instructions…`
- `Updating password…`
- `Connecting Google…`
- `Saving sign-in method…`
- `Updating two-factor security…`
- `Saving profile…`
- `Submitting verification…`

Errors use `role="alert"`; successful/neutral text uses `role="status"`. Do not convert API/Auth.js forms to Server Actions merely to obtain framework form hooks.

Wrap the two existing account Server Action forms in `app/account/page.tsx` with `PendingSubmissionForm`/`PendingSubmitButton`. Preserve the exact actions and fields. In `app/account/actions.ts`, keep authentication and validation behavior, catch operational persistence/provider failures into safe result redirects, and redirect success/failure to exact account notice keys (`profile=saved|save-failed`, `credential=submitted|submit-failed`). Place the final redirect outside `try/catch` because Next redirects throw. Extend `accountNotice` and source tests; no ORM/provider error or entered credential value reaches the URL.

- [ ] **Step 6: Run focused tests and commit**

```bash
node --test tests/interaction-feedback.test.mjs tests/auth-registration.test.mjs tests/account-security-routes.test.mjs tests/auth-account-linking.test.mjs tests/account-page-tabs.test.mjs tests/account-action-outcome.test.mjs
npm run build:browser-qa
npm run test:browser -- tests/browser/interaction-feedback.spec.ts --project=desktop-chromium
npm run test:browser -- tests/browser/interaction-feedback.spec.ts --project=mobile-chromium
npm run typecheck
npm run lint
git diff --check
git add components/forms/async-action-button.tsx components/forms/pending-submission-form.tsx lib/account-action-outcome.ts app/login/login-form.tsx app/register/register-form.tsx app/forgot-password/page.tsx app/reset-password/reset-password-form.tsx app/account/link-google/link-google-form.tsx app/account/security/sign-in-methods-panel.tsx app/account/security/security-panel.tsx app/account/actions.ts app/account/page.tsx tests/interaction-feedback.test.mjs tests/browser/interaction-feedback.spec.ts tests/auth-registration.test.mjs tests/account-page-tabs.test.mjs tests/account-action-outcome.test.mjs
git commit -m "fix: make account actions visibly recoverable"
```

Expected: PASS.

---

### Task 3: Preserve native billing redirects with pending feedback

**Files:**
- Modify: `components/forms/pending-submission-form.tsx`
- Modify: `components/membership/pricing-cards.tsx`
- Modify: `app/pricing/page.tsx`
- Modify: `tests/helpers/membership-pricing-cards.mjs`
- Modify: `tests/membership-pricing-cards.test.mjs`
- Modify: `tests/donation-checkout-route.test.mjs`
- Modify: `tests/interaction-feedback.test.mjs`
- Modify: `tests/browser/interaction-feedback.spec.ts`

**Interfaces:**
- Reuses: `PendingSubmissionForm` with native form props except `onSubmit`/`aria-busy`.
- Extends: `PendingSubmitButton` with Button props, children, pendingLabel, and optional metal-attention presentation.
- Form context owns the single pending state and status announcement.

- [ ] **Step 1: Write failing native-form contracts**

Extend pricing rendering tests to prove current action URLs, `method="post"`, hidden membership/interval/amount/legal fields, Portal destination fields, and donation amount remain unchanged after wrapping.

Assert the new types:

```ts
export type PendingSubmissionFormProps = Omit<
  React.ComponentPropsWithoutRef<"form">,
  "onSubmit" | "aria-busy"
> & { pendingLabel: string }

export type PendingSubmitButtonProps =
  Omit<React.ComponentProps<typeof Button>, "children" | "aria-busy"> & {
    children: React.ReactNode
    pendingLabel: string
    presentation?: "button" | "metal-attention"
    metalFullWidth?: boolean
  }
```

- [ ] **Step 2: Add delayed billing browser RED cases**

Delay `/api/billing/donation` and a membership/Portal POST with local route fixtures. Repeated activation must result in one POST, `aria-busy=true`, disabled submit, and exact visible copy:

- `Opening secure subscription checkout…`
- `Opening billing portal…`
- `Opening secure checkout…`

Complete the existing redirect contract and assert the app returns correctly.

- [ ] **Step 3: Run focused tests and verify RED**

```bash
node --test tests/membership-pricing-cards.test.mjs tests/interaction-feedback.test.mjs
npm run build:browser-qa
npm run test:browser -- tests/browser/interaction-feedback.spec.ts --project=desktop-chromium
```

Expected: FAIL because native forms have no pending owner.

- [ ] **Step 4: Implement form-owned synchronous pending**

Extend the shared pending-submission owner only with the optional MetalAttentionButton presentation needed by billing. Its already-tested `flushSync` first-submit claim must commit pending before the browser leaves for the 303 redirect. While pending, repeat submits remain prevented, the form stays `aria-busy`, and one polite status remains visible. `PendingSubmitButton` renders a decorative 18 px Loader plus pending text using Button or MetalAttentionButton presentation without changing hidden inputs/action/method.

- [ ] **Step 5: Wrap Checkout, Portal, and donation forms**

Replace only their outer `<form>` and submit control. Preserve every action, POST method, hidden input, legal checkbox relationship, server handler, and redirect behavior. Update `tests/helpers/membership-pricing-cards.mjs` with pass-through test mocks that retain children and form props for static rendering.

- [ ] **Step 6: Run focused tests and commit**

```bash
node --test tests/membership-pricing-cards.test.mjs tests/membership-checkout-route.test.mjs tests/billing-portal-route.test.mjs tests/donation-checkout-route.test.mjs tests/interaction-feedback.test.mjs
npm run build:browser-qa
npm run test:browser -- tests/browser/interaction-feedback.spec.ts --project=desktop-chromium
npm run test:browser -- tests/browser/interaction-feedback.spec.ts --project=mobile-chromium
npm run typecheck
npm run lint
git diff --check
git add components/forms/pending-submission-form.tsx components/membership/pricing-cards.tsx app/pricing/page.tsx tests/helpers/membership-pricing-cards.mjs tests/membership-pricing-cards.test.mjs tests/donation-checkout-route.test.mjs tests/interaction-feedback.test.mjs tests/browser/interaction-feedback.spec.ts
git commit -m "feat: show secure billing redirect progress"
```

Expected: PASS with one native POST per activation.

---

### Task 4: Verify browser lanes, document, and prove exact head

**Files:**
- Verify: `tests/browser/ci-lanes.mjs`
- Verify: `tests/browser/ci-lanes.test.mjs`
- Verify: `tests/browser-qa-harness.test.mjs`
- Modify: `docs/wiki/visual-system.md`
- Modify: `docs/wiki/release-checklist.md`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

**Interfaces:**
- Verifies interaction feedback remains assigned to both ordinary browser projects and adds it to the release checklist.
- Records only exact tested behavior; makes no deployment/provider claim.

- [ ] **Step 1: Verify the already-registered exact-once lanes**

Confirm Task 1's registration still has `interaction-feedback.spec.ts` exactly once for desktop and mobile, 14 ordinary specs, 28 project/spec pairs, and four nonempty lanes. Any drift is fixed in the task that introduced it rather than deferred to this documentation commit.

- [ ] **Step 2: Run required viewport and accessibility checks**

In the browser spec, explicitly cover desktop 1280×900, mobile portrait 390×844, compact landscape 844×390, enlarged text, keyboard focus, and `page.emulateMedia({ reducedMotion: "reduce" })`. Assert no horizontal overflow, route bar pointer-events-none, no focus stealing, one live announcement, visible feedback with stopped decorative motion, and player/app-bar controls not covered.

- [ ] **Step 3: Document the shared contracts**

In visual-system docs, record route bar/delayed Loader, Link descendant pending indicator, shared async action button, and native redirect form. In release checklist, require throttled route/action success and thrown-request cleanup, reduced motion, keyboard/status, desktop/mobile, and persistent music/timer proof.

- [ ] **Step 4: Run focused harness checks**

```bash
node --test tests/interaction-feedback.test.mjs tests/auth-registration.test.mjs tests/membership-pricing-cards.test.mjs tests/sitewide-loader.test.mjs tests/browser/ci-lanes.test.mjs tests/browser-qa-harness.test.mjs
npm run build:browser-qa
npm run test:browser -- tests/browser/interaction-feedback.spec.ts --project=desktop-chromium
npm run test:browser -- tests/browser/interaction-feedback.spec.ts --project=mobile-chromium
```

Expected: PASS and 28 exact project/spec assignments.

- [ ] **Step 5: Run the complete workstream gate**

```bash
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
npm run build:browser-qa
npm run test:browser
```

Expected: every command passes. If Windows sandbox launch fails before execution with error 1312, rerun the same command through the approved outside-sandbox path.

- [ ] **Step 6: Review persistent-state hazards**

Confirm no root provider/pathname key was added; Chimer navigation guard/custom timer navigation is unchanged; route overlays never capture input; MetalAttentionRing geometry is unchanged; WebGL Loader delay cleans up; auth/billing authority is unchanged; and no global click/history interception exists.

- [ ] **Step 7: Update canonical docs and commit**

Record the exact feedback head and validation/browser results in project state/log without claiming deployment. Then:

```bash
git add docs/wiki/visual-system.md docs/wiki/release-checklist.md docs/project-state.md docs/project-log.md
git commit -m "docs: record interaction feedback gates"
git status --short --branch
git log --oneline --decorate -4
```

Expected: clean feedback branch with four task commits. Hand off the exact head to the server/cost workstream.
