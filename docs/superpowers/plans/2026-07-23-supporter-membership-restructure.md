# Supporter Membership Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the currently advertised Supporter/Therapist/Practice subscription tiers with one MassageLab Supporter Membership offering three approved support amounts with identical benefits, while preserving future Therapist and Practice product names for later beta products.

**Architecture:** Keep the internal membership enum and historical webhook normalization stable, but expose and sell only Supporter memberships. Introduce amount-choice metadata independent of feature entitlements, map every approved Supporter Price ID to the same `SUPPORTER` entitlement, and use Stripe Customer Portal to switch only among the approved Supporter Prices. Treat the live Stripe catalog migration as an idempotent, separately verified operation after the application change is deployed.

**Tech Stack:** Next.js App Router, Stripe Billing and Checkout Sessions, Stripe Customer Portal, Prisma membership records, Node test runner, Vercel production environment.

## Global Constraints

- The current paid product is named `MassageLab Supporter Membership`.
- The approved recurring support amounts are $1, $2, or $5 monthly and $10, $20, or $50 annually.
- Every approved amount grants the same current Supporter benefits, including all backgrounds.
- Amount choice does not determine roadmap interests, feature entitlements, tax classification, or professional/business status.
- Therapist and Practice subscriptions are not offered, cannot start Checkout, and remain unavailable until separately approved beta products exist.
- Keep internal historical `THERAPIST` and `PRACTICE` enum values readable so old webhook/database records cannot become unknown or be silently reclassified.
- Do not grant therapist documentation, external calendar sync, full scheduling, or team scheduling merely from the current Supporter Membership.
- Do not revoke a real active entitlement without a database and Stripe subscriber inventory proving the affected account and an explicit migration decision.
- The intended current membership tax classification is `txcd_10000000`, pending final professional confirmation before live Automatic Tax is enabled for recurring charges.
- Public payment language may say support, supporter membership, or contribution; it must not imply charitable status or tax deductibility.
- Roadmap interests are editable, multi-select preferences and do not alter billing or entitlements.
- Preserve `TODO.md` unchanged and unstaged.

---

### Task 1: Define One Supporter Offering With Three Amount Choices

**Files:**
- Modify: `lib/membership.js`
- Modify: `lib/membership-pricing.js`
- Modify: `app/pricing/page.tsx`
- Modify: `app/api/billing/checkout/route.ts`
- Modify: `scripts/stripe-readiness-check.mjs`
- Modify: `.env.example`
- Modify: `tests/membership.test.mjs`
- Modify: `tests/membership-pricing.test.mjs`
- Modify: `tests/stripe-billing.test.mjs`
- Modify: `tests/stripe-readiness.test.mjs`

**Interfaces:**
- Produces: six configured Supporter Price IDs, each resolving to `SUPPORTER`.
- Preserves: historical normalization of known Therapist/Practice subscriptions.

- [ ] **Step 1: Add failing supporter-choice tests**

Define stable choice IDs:

```js
export const SUPPORTER_AMOUNT_CHOICES = Object.freeze([
  Object.freeze({ id: "support-1", month: 100, year: 1000 }),
  Object.freeze({ id: "support-2", month: 200, year: 2000 }),
  Object.freeze({ id: "support-5", month: 500, year: 5000 }),
])
```

Assert every configured choice resolves to membership level `SUPPORTER`, and POST attempts using `THERAPIST` or `PRACTICE` return the existing unavailable/validation response before Stripe Checkout is called.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
node --test tests/membership.test.mjs tests/membership-pricing.test.mjs tests/stripe-billing.test.mjs
```

Expected: FAIL because pricing is currently keyed by three entitlement tiers.

- [ ] **Step 3: Implement the supporter-only catalog**

Use six explicit environment keys:

```text
STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID
STRIPE_SUPPORTER_1_YEARLY_PRICE_ID
STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID
STRIPE_SUPPORTER_2_YEARLY_PRICE_ID
STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID
STRIPE_SUPPORTER_5_YEARLY_PRICE_ID
```

Render one product card headed `MassageLab Supporter Membership`, one Monthly/Yearly interval control, and three amount choices. Use identical benefit copy for every choice and submit the selected choice ID plus interval; never submit a Therapist/Practice level.

- [ ] **Step 4: Keep professional access separate**

Keep current professional feature keys controlled by their existing verified-role, explicit grant, historical subscription, or future-plan gates. Add a regression proving an active `SUPPORTER` subscription does not grant:

```js
[
  "therapist_documentation_tools",
  "calendar_full_scheduling",
  "external_calendar_sync",
  "calendar_team_scheduling",
]
```

- [ ] **Step 5: Migrate the deployment-readiness contract**

Replace the legacy six-tier `REQUIRED_PRICE_VARS` entries in
`scripts/stripe-readiness-check.mjs` with the six approved Supporter amount
keys. Update `.env.example` and readiness tests so a complete Supporter-only
configuration passes, a missing or duplicate Supporter Price fails, and legacy
Therapist/Practice Price variables cannot make the new readiness check pass.
Keep historical webhook/database normalization separate from deploy-time public
catalog readiness.

- [ ] **Step 6: Pass focused tests and commit**

Run the focused tests from Step 2 plus
`node --test tests/stripe-readiness.test.mjs` and `git diff --check`.

Expected: PASS.

```powershell
git add lib/membership.js lib/membership-pricing.js app/pricing/page.tsx app/api/billing/checkout/route.ts scripts/stripe-readiness-check.mjs .env.example tests/membership.test.mjs tests/membership-pricing.test.mjs tests/stripe-billing.test.mjs tests/stripe-readiness.test.mjs
git commit -m "feat: offer one supporter membership"
```

### Task 2: Replace Donation Language With One-Time Support

**Files:**
- Modify: `lib/donations.js`
- Modify: `lib/stripe-billing.js`
- Modify: `app/pricing/page.tsx`
- Modify: `app/api/billing/donation/route.ts`
- Modify: `app/roadmap/page.tsx`
- Modify: `app/page.tsx`
- Modify: `tests/donations.test.mjs`
- Modify: `tests/stripe-billing.test.mjs`
- Modify: applicable copy/roadmap/visual-system tests

**Interfaces:**
- Preserves: metadata purpose `massagelab_project_support` and the existing route for webhook and link compatibility.
- Produces: public label `One-time support`.

- [ ] **Step 1: Write failing public-language and Checkout tests**

Assert public pages and Stripe `product_data` contain `support`, contain no `donation`/`donate` wording, and disclose:

```text
One-time support does not create a membership or unlock features. It is not a charitable donation and is not tax-deductible.
```

Assert the Checkout Session omits `submit_type: "donate"` or uses `submit_type: "pay"`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
node --test tests/donations.test.mjs tests/stripe-billing.test.mjs tests/public-roadmap.test.mjs tests/user-facing-copy.test.mjs
```

Expected: FAIL on current donation language.

- [ ] **Step 3: Change user-facing copy without changing event identity**

Keep `DONATION_PURPOSE = "massagelab_project_support"` as a compatibility constant, but change headings, notices, button labels, error messages, comments presented in generated docs, and Stripe Checkout product copy to `One-time support`. Use default Pay semantics rather than Stripe's Donate submit label.

- [ ] **Step 4: Keep tax treatment fail closed**

Do not enable Automatic Tax for a no-entitlement one-time support payment until a tax professional confirms whether it is taxable consideration and selects its classification. Document that this classification is separate from `txcd_10000000` backgrounds/supporter memberships.

- [ ] **Step 5: Pass focused tests and commit**

Run the focused tests from Step 2 and `git diff --check`.

Expected: PASS.

```powershell
git add lib/donations.js lib/stripe-billing.js app/pricing/page.tsx app/api/billing/donation/route.ts app/roadmap/page.tsx app/page.tsx tests/donations.test.mjs tests/stripe-billing.test.mjs tests/public-roadmap.test.mjs tests/user-facing-copy.test.mjs
git commit -m "fix: describe one-time project support accurately"
```

### Task 3: Collect Editable Roadmap Interests

**Files:**
- Modify: `lib/onboarding-preferences.js`
- Modify: `lib/account-preferences.js`
- Create: `app/account/supporter-interests-panel.tsx`
- Modify: `app/account/page.tsx`
- Modify: `tests/onboarding-preferences.test.mjs`
- Modify: `tests/account-preferences.test.mjs`

**Interfaces:**
- Produces: `appSettings.supporterRoadmapInterests: string[]`.
- Preserves: existing onboarding `useCases` and unrelated `appSettings` values.

- [ ] **Step 1: Add failing normalization tests**

Allow only:

```js
[
  "personal_wellness",
  "backgrounds_and_sound",
  "therapist_tools",
  "practice_management",
  "anatomy_and_education",
  "professional_documentation",
]
```

Assert unknown, duplicate, non-string, and PHI-shaped values are dropped.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
node --test tests/onboarding-preferences.test.mjs tests/account-preferences.test.mjs
```

Expected: FAIL because the preference does not exist.

- [ ] **Step 3: Add the editable multi-select**

Present the six approved reader-facing labels. Save only through the existing sanitized `UserPreference.appSettings` path. Do not send the selection to Stripe, Checkout metadata, membership resolution, or tax classification.

- [ ] **Step 4: Pass focused tests and commit**

Run the focused tests from Step 2 and `git diff --check`.

Expected: PASS.

```powershell
git add lib/onboarding-preferences.js lib/account-preferences.js app/account/supporter-interests-panel.tsx app/account/page.tsx tests/onboarding-preferences.test.mjs tests/account-preferences.test.mjs
git commit -m "feat: collect supporter roadmap interests"
```

### Task 4: Create An Idempotent Stripe Migration Command

**Files:**
- Create: `scripts/stripe-supporter-membership-migration.mjs`
- Modify: `package.json`
- Create: `tests/stripe-supporter-membership-migration.test.mjs`
- Modify: `.env.example`
- Modify: `docs/wiki/deployment.md`

**Interfaces:**
- Produces: `npm run stripe:migrate-supporter-membership -- --mode=verify|apply`.
- Consumes: the current Stripe account and exact approved production object IDs supplied through environment variables.

- [ ] **Step 1: Write failing dry-run and apply tests**

The command must:

- refuse test/live mode mismatch;
- print no customer identifiers, secrets, or payment details;
- verify the only active subscription is the documented test subscription before any catalog mutation;
- create or reuse one `MassageLab Supporter Membership` Product with tax code `txcd_10000000`;
- create or reuse the six exact approved Prices;
- never reuse a Therapist/Practice-owned Price as a Supporter Price because Stripe Prices cannot be reassigned to another Product;
- make the unapproved $9/$90, $29/$279, and $79/$759 Prices inactive;
- make Therapist and Practice Products/Prices inactive after dependency verification;
- delete the zero-redemption Student-to-Therapist and Early Access coupons only after verifying their names, percentages, duration, and redemption counts;
- enable Customer Portal subscription updates only among the six Supporter Prices; and
- preserve cancellation, payment method, billing address/name/email updates, and invoice history.

- [ ] **Step 2: Run the command tests and verify RED**

Run:

```powershell
node --test tests/stripe-supporter-membership-migration.test.mjs
```

Expected: FAIL because the command does not exist.

- [ ] **Step 3: Implement verify mode**

`--mode=verify` performs GET requests only and returns a safe PASS/FAIL checklist. It must fail on unexpected subscriptions, coupon redemptions, Price amounts, product ownership, portal configuration, livemode, or missing tax classification.

- [ ] **Step 4: Implement idempotent apply mode**

`--mode=apply` performs mutations in dependency order and re-retrieves each object after mutation. Re-running it must report the already-correct state without creating duplicate Products or Prices.

- [ ] **Step 5: Pass focused tests and commit**

Run the focused test, `npm run lint`, and `git diff --check`.

Expected: PASS.

```powershell
git add scripts/stripe-supporter-membership-migration.mjs tests/stripe-supporter-membership-migration.test.mjs package.json .env.example docs/wiki/deployment.md
git commit -m "ops: add supporter Stripe migration"
```

### Task 5: Deploy, Migrate, And Verify Portal/Tax Behavior

**Files:**
- Modify: `lib/stripe-billing.js`
- Modify: `app/api/billing/checkout/route.ts`
- Modify: `tests/stripe-billing.test.mjs`
- Modify: `scripts/stripe-readiness-check.mjs`
- Modify: `tests/stripe-readiness.test.mjs`
- Modify: `.env.example`
- Modify: `docs/wiki/billing-memberships.md`
- Modify: `docs/wiki/release-checklist.md`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

**Interfaces:**
- Consumes: deployed supporter-only application code and migration verify/apply command.
- Produces: verified production Supporter Checkout and Customer Portal behavior.

- [ ] **Step 1: Inventory database and Stripe subscribers**

Run read-only database and Stripe checks. Stop if any non-test active, trialing, past-due, paused, or canceling subscription exists; record a subscriber-specific grandfathering decision before proceeding.

- [ ] **Step 2: Prepare deployable supporter-only code without mutating live Stripe**

Complete the application, entitlement, readiness, migration-command, and portal
tests from Tasks 1-4. Run the migration command in `--mode=verify` only. Do not
deploy the new public enrollment flow or run `--mode=apply` while recurring tax
classification remains unconfirmed.

- [ ] **Step 3: Implement recurring Automatic Tax only after confirmation**

After professional confirmation of `txcd_10000000`, first add failing Checkout
tests that require new Supporter Sessions to use automatic tax, required billing
address collection, Customer address updates, and the confirmed tax code and
exclusive tax behavior. Update the readiness script/tests and `.env.example`
with explicit recurring-tax enablement, provider, registration, and
classification gates. Then implement those fields in
`createStripeCheckoutSession` and its route before deploying. Existing recurring
subscriptions require explicit separate updates; do not assume enabling new
Checkout updates them.

- [ ] **Step 4: Deploy the complete code and verify the live migration**

Deploy the supporter-only application, recurring-tax Checkout, readiness, and
migration-command changes together. Supply old and new Price IDs only as
required for the controlled migration window. Confirm Therapist/Practice cannot
start new Checkout, then run:

```powershell
npm run stripe:migrate-supporter-membership -- --mode=verify
```

Expected: PASS with no customer identifiers in output. Stop before mutation if
the deployed code, recurring-tax readiness, subscriber inventory, or catalog
dependency checks are not exact.

- [ ] **Step 5: Apply and re-verify the live migration**

Run:

```powershell
npm run stripe:migrate-supporter-membership -- --mode=apply
npm run stripe:migrate-supporter-membership -- --mode=verify
```

Expected: APPLY, PASS with no customer identifiers in output.

- [ ] **Step 6: Run live smoke tests**

Using a controlled production account:

- subscribe at the $1 monthly amount;
- verify all-background access and no professional/team feature grant;
- switch to $2 and then $5 through Customer Portal;
- change payment method and address;
- review invoice history;
- cancel at period end; and
- verify webhook-backed account state after every transition.

- [ ] **Step 7: Complete validation and documentation**

Run:

```powershell
npm run lint
npm run test
npm run typecheck
npm run build
git diff --check
```

Update canonical docs with the one-product model, approved amounts, disabled professional products, portal behavior, coupon removal, one-time-support language, interest preference, tax posture, and smoke evidence.

Commit the reviewed recurring-tax application/readiness changes before the live
catalog migration and smoke. Do not configure the portal or catalog around code
that still validates or creates the legacy tier contract.

## Completion Criteria

- Only one MassageLab Supporter Membership is publicly offered.
- The six approved recurring amounts are $1/$10, $2/$20, and $5/$50.
- Deployment readiness validates those six Supporter Price IDs rather than the
  legacy Supporter/Therapist/Practice Price set.
- Every amount maps to identical Supporter entitlements, including all backgrounds.
- Therapist and Practice cannot start Checkout and their live catalog objects are inactive.
- The unapproved higher Prices are inactive and cannot be selected.
- Student-to-Therapist and Early Access coupons are removed after zero-redemption verification.
- Customer Portal permits switching among approved Supporter Prices, canceling, payment-method updates, account billing detail updates, and invoice review.
- One-time support copy does not use charitable donation language and clearly states that the payment grants no membership/features and is not tax-deductible.
- Roadmap interests remain editable and independent from billing, entitlements, and tax.
- Recurring Automatic Tax is enabled only after final professional classification confirmation.
- New recurring Checkout Sessions implement and test the confirmed tax code,
  automatic tax, billing-address collection, and Customer address update before
  the live smoke.
- No real subscriber loses access without explicit inventory and grandfathering review.
