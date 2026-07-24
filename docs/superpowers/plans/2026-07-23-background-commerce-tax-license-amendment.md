# Background Commerce Tax And License Amendment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Track 1B with the approved Stripe Tax classification and a versioned permanent-background license that supports purchaser-operated personal and internal professional display without enabling account or asset sharing.

**Architecture:** Keep the existing environment-driven Stripe Tax gate, but make the reviewed background classification an exact application constant so any other `txcd_` value fails closed. Version the existing digital-purchase policy and reuse its current Checkout acceptance mechanism; do not add a personal-versus-business question or change ownership, cart, fulfillment, or subscription behavior.

**Tech Stack:** Next.js App Router, TypeScript/JavaScript, Stripe Checkout, repository legal-document registry, Node test runner, existing readiness script.

## Global Constraints

- The only approved permanent-background Stripe Tax product code is `txcd_10000000`.
- Background Checkout remains one U.S.-only, tax-exclusive flow and does not ask whether use is personal or professional.
- The purchaser may personally use and display a purchased background in their own sole proprietorship or practice.
- The license does not permit account sharing, staff or team account operation, redistribution, resale, sublicensing, asset extraction, packaging in another product, or access by unrelated third parties.
- Clients and staff may see a background displayed by the purchaser; that visibility does not grant them account access or a separate license.
- Do not change membership Products, Prices, coupons, subscriptions, Customer Portal configuration, or one-time support copy in this Track 1B amendment.
- Keep `BACKGROUND_COMMERCE_PURCHASING_ENABLED=false` until the merged code is deployed and a taxed test-mode Checkout/fulfillment smoke passes.
- Preserve the user-owned `TODO.md` edit and exclude it from every commit.

---

### Task 1: Pin The Approved Tax Code

**Files:**
- Modify: `lib/commerce/catalog.ts`
- Modify: `tests/commerce-core.test.mjs`
- Modify: `tests/background-checkout.test.mjs`
- Modify: `tests/background-fulfillment.test.mjs`
- Modify: `tests/stripe-readiness.test.mjs`

**Interfaces:**
- Produces: `BACKGROUND_COMMERCE_TAX_PRODUCT_CODE`, the exact reviewed value consumed by `getCommerceTaxReadiness`.
- Preserves: `getCommerceTaxReadiness(env)` return shape and every existing Checkout/fulfillment interface.

- [ ] **Step 1: Write the exact-code regression**

Add an assertion that `txcd_10000000` is ready only when the Stripe mode and both operator attestations are true, and that another syntactically valid code fails:

```js
assert.deepEqual(getCommerceTaxReadiness({
  BACKGROUND_COMMERCE_TAX_MODE: "stripe",
  BACKGROUND_COMMERCE_TAX_PRODUCT_CODE: "txcd_10000000",
  BACKGROUND_COMMERCE_TAX_PROVIDER_READY: "true",
  BACKGROUND_COMMERCE_TAX_REGISTRATIONS_READY: "true",
}), {
  mode: "stripe",
  ready: true,
  taxCode: "txcd_10000000",
})

assert.equal(getCommerceTaxReadiness({
  BACKGROUND_COMMERCE_TAX_MODE: "stripe",
  BACKGROUND_COMMERCE_TAX_PRODUCT_CODE: "txcd_10202003",
  BACKGROUND_COMMERCE_TAX_PROVIDER_READY: "true",
  BACKGROUND_COMMERCE_TAX_REGISTRATIONS_READY: "true",
}).ready, false)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/commerce-core.test.mjs`

Expected: FAIL because the current gate accepts any value beginning with `txcd_`.

- [ ] **Step 3: Add the exact application constant**

Export and use:

```ts
export const BACKGROUND_COMMERCE_TAX_PRODUCT_CODE = "txcd_10000000"
```

The readiness expression must compare the configured value exactly:

```ts
const ready = taxMode === "stripe"
  && taxCode === BACKGROUND_COMMERCE_TAX_PRODUCT_CODE
  && explicitTrue(env[TAX_PROVIDER_READY_ENV])
  && explicitTrue(env[TAX_REGISTRATIONS_READY_ENV])
```

- [ ] **Step 4: Replace provisional fixture codes**

Replace every Track 1A/1B test fixture value `txcd_10202003` with `txcd_10000000`. Keep the explicit wrong-code regression from Step 1 so the old provisional value remains covered as a rejection case.

- [ ] **Step 5: Run the tax and fulfillment tests**

Run:

```powershell
node --test tests/commerce-core.test.mjs tests/background-checkout.test.mjs tests/background-fulfillment.test.mjs tests/stripe-readiness.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add lib/commerce/catalog.ts tests/commerce-core.test.mjs tests/background-checkout.test.mjs tests/background-fulfillment.test.mjs tests/stripe-readiness.test.mjs
git commit -m "fix: pin background commerce tax classification"
```

### Task 2: Version The Purchaser-Operated Background License

**Files:**
- Modify: `lib/legal-documents.js`
- Modify: `tests/legal-documents.test.mjs`
- Modify: `tests/legal-acceptance.test.mjs`
- Modify: `docs/wiki/billing-memberships.md`
- Modify: `docs/project-state.md`
- Modify: `docs/project-log.md`

**Interfaces:**
- Produces: `DIGITAL_PURCHASES_REFUNDS_VERSION = "2026-07-digital-purchases-v2"`.
- Preserves: the existing `digital-purchase` acceptance event and its combined Checkout consent.

- [ ] **Step 1: Write the license and version regressions**

Assert the policy is version 2 and its public body covers both the allowed scope and prohibited transfers:

```js
assert.equal(DIGITAL_PURCHASES_REFUNDS_VERSION, "2026-07-digital-purchases-v2")
assert.match(policyText, /personal use/i)
assert.match(policyText, /own sole proprietorship or practice/i)
assert.match(policyText, /account sharing/i)
assert.match(policyText, /redistribut/i)
assert.match(policyText, /resale/i)
assert.match(policyText, /another product/i)
assert.match(policyText, /unrelated third parties/i)
```

Update the stale-acceptance fixture to replace the version 2 acceptance ID, proving an earlier acceptance cannot satisfy a new purchase.

- [ ] **Step 2: Run the focused legal tests and verify RED**

Run:

```powershell
node --test tests/legal-documents.test.mjs tests/legal-acceptance.test.mjs
```

Expected: FAIL because version 1 lacks the approved license section.

- [ ] **Step 3: Add the versioned license section**

Set:

```js
export const DIGITAL_PURCHASES_REFUNDS_VERSION = "2026-07-digital-purchases-v2"
```

Add a `Permitted use and license limits` section that states:

```text
The purchasing account holder receives a non-transferable right to personally use and display each purchased background for personal activities and while providing services through the purchaser's own sole proprietorship or practice. Clients or staff may see that purchaser-operated display, but visibility does not grant them account access or a separate license.

Purchases do not permit account sharing, staff or team operation through the purchaser's login, redistribution, resale, sublicensing, extracting or distributing the background assets, packaging a background into another product or service, or providing access to unrelated third parties.
```

- [ ] **Step 4: Update operational documentation**

Record:

- exact tax code `txcd_10000000`;
- active Ohio Stripe Tax registration verified on July 23, 2026;
- document version `2026-07-digital-purchases-v2`;
- no personal/business checkout question;
- purchaser-operated internal professional display scope; and
- purchasing remains disabled pending the taxed test-mode smoke and post-merge production configuration.

- [ ] **Step 5: Run focused and complete validation**

Run separately:

```powershell
node --test tests/legal-documents.test.mjs tests/legal-acceptance.test.mjs tests/commerce-core.test.mjs tests/background-checkout.test.mjs tests/background-fulfillment.test.mjs tests/stripe-readiness.test.mjs
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
```

Expected: every command PASS; lint may retain only already documented warnings.

- [ ] **Step 6: Commit**

```powershell
git add lib/legal-documents.js tests/legal-documents.test.mjs tests/legal-acceptance.test.mjs docs/wiki/billing-memberships.md docs/project-state.md docs/project-log.md docs/superpowers/plans/2026-07-23-background-commerce-tax-license-amendment.md
git commit -m "docs: define permanent background license"
```

## Completion Criteria

- Only `txcd_10000000` can satisfy paid background readiness.
- Checkout applies that exact code to every inline background line item.
- A purchaser makes one purchase without classifying use as personal or business.
- The versioned policy allows purchaser-operated personal and internal professional display and prohibits transfer, sharing, redistribution, resale, sublicensing, asset extraction, bundling, and unrelated-party access.
- Existing version 1 acceptance cannot authorize a version 2 purchase.
- Subscription billing, Customer Portal, coupons, one-time support, and live Stripe catalog objects remain unchanged in this Track 1B branch.
- Complete validation and review pass before the PR returns to merge-ready.
