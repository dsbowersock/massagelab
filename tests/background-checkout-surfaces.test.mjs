import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  createCompiledModuleLoader,
  createElement,
  elementText,
  findElement,
  passThroughElement,
  renderFunctionComponents,
} from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)

const reviewPath = new URL("../components/backgrounds/BackgroundCheckoutReview.tsx", import.meta.url)
const cartPath = new URL("../components/backgrounds/BackgroundCommerceCart.tsx", import.meta.url)
const returnPath = new URL("../components/backgrounds/BackgroundCheckoutReturnStatus.tsx", import.meta.url)
const chimerPagePath = new URL("../app/chimer/page.tsx", import.meta.url)
const setTimerPath = new URL("../app/chimer/set-timer.tsx", import.meta.url)

describe("background checkout review", () => {
  it("shows itemized $1 lines, U.S. and tax posture, and the current legal documents", async () => {
    const source = await readFile(reviewPath, "utf8")
    for (const copy of [
      "Review checkout",
      "U.S. only",
      "Applicable tax is calculated",
      "Digital Purchases & Refund Policy",
      "immediate digital delivery",
      "final-sale",
    ]) {
      assert.ok(source.toLowerCase().includes(copy.toLowerCase()), `Missing checkout copy: ${copy}`)
    }
    assert.match(source, /requiredLegalDocumentsForEvent\("digital-purchase"\)/)
    assert.match(source, /legalDocumentAcceptanceId/)
  })

  it("requires one unchecked combined consent and locks duplicate submission", async () => {
    const harness = await loadCheckoutReviewHarness()
    try {
      const initial = harness.render()
      const initialConsent = checkoutConsent(initial)
      const initialSubmit = checkoutSubmit(initial)
      assert.equal(initialConsent.props.checked, false)
      assert.equal(initialSubmit.props.disabled, true)

      initialConsent.props.onChange({ target: { checked: true } })
      const accepted = harness.render()
      assert.equal(checkoutConsent(accepted).props.checked, true)
      assert.equal(checkoutSubmit(accepted).props.disabled, false)

      checkoutSubmit(accepted).props.onClick()
      const pending = harness.render()
      assert.equal(checkoutSubmit(pending).props.disabled, true)
      assert.equal(elementText(checkoutSubmit(pending)), "Opening secure Checkout...")

      checkoutSubmit(pending).props.onClick()
      assert.deepEqual(harness.checkoutCalls, [{
        acceptedLegalDocuments: ["digital-purchases-refunds:2026-08-29"],
        combinedConsentAccepted: true,
        purchaseCountry: "US",
        returnPath: "/clock?panel=background",
      }])
      assert.deepEqual(harness.storageWrites, [[
        "massagelab-background-checkout-return-v1",
        JSON.stringify({
          returnPath: "/clock?panel=background",
          backgroundIds: ["background-one"],
        }),
      ]])
    } finally {
      harness.resolveCheckout()
      await Promise.resolve()
      harness.cleanup()
    }
  })

  it("keeps lawful exceptions and account cart recovery visible", async () => {
    const source = await readFile(reviewPath, "utf8")
    for (const copy of [
      "duplicate charges",
      "unauthorized purchases",
      "non-delivery",
      "material defects",
    ]) {
      assert.match(source.replace(/\s+/g, " "), new RegExp(copy, "i"))
    }
    const cart = await readFile(cartPath, "utf8")
    assert.match(cart, /<BackgroundCheckoutReview/)
    assert.match(cart, /setReviewOpen\(true\)/)
  })
})

function checkoutConsent(tree) {
  const consent = findElement(tree, (element) => element.type === "input" && element.props.type === "checkbox")
  assert.ok(consent, "checkout review must render its consent checkbox")
  return consent
}

function checkoutSubmit(tree) {
  const submit = findElement(tree, (element) => (
    element.type === "button"
    && /(?:Continue to Checkout|Opening secure Checkout)/.test(elementText(element))
  ))
  assert.ok(submit, "checkout review must render its submit button")
  return submit
}

/** Renders the real checkout review with stateful hooks and deterministic commerce dependencies. */
async function loadCheckoutReviewHarness() {
  const source = await readFile(reviewPath, "utf8")
  const checkoutCalls = []
  const storageWrites = []
  let resolveCheckout
  const pendingCheckout = new Promise((resolve) => { resolveCheckout = resolve })
  const hooks = createHookHarness()
  const Div = passThroughElement("div")
  const review = loadCompiledModule(source, "BackgroundCheckoutReview.behavior.test.tsx", {
    react: hooks.react,
    "react/jsx-runtime": {
      Fragment: Symbol.for("background-checkout-test.fragment"),
      jsx: createElement,
      jsxs: createElement,
    },
    "next/link": { __esModule: true, default: passThroughElement("a") },
    "next/navigation": {
      usePathname: () => "/clock",
      useSearchParams: () => new URLSearchParams(),
    },
    "@/components/backgrounds/BackgroundCommerceProvider": {
      useBackgroundCommerce: () => ({
        state: {
          snapshot: {
            cart: {
              currency: "usd",
              items: [{
                currency: "usd",
                displayName: "Background One",
                productKey: "background-one",
                unitAmount: 100,
              }],
              subtotalAmount: 100,
            },
          },
        },
        startCheckout: (input) => {
          checkoutCalls.push(input)
          return pendingCheckout
        },
      }),
    },
    "@/components/ui/button": { Button: passThroughElement("button") },
    "@/components/ui/dialog": {
      Dialog: Div,
      DialogContent: Div,
      DialogDescription: Div,
      DialogFooter: Div,
      DialogHeader: Div,
      DialogTitle: Div,
    },
    "@/lib/background-commerce-client.js": {
      formatCommerceAmount: (amount) => `$${amount / 100}`,
    },
    "@/lib/legal-documents.js": {
      legalDocumentAcceptanceId: (document) => `${document.key}:${document.version}`,
      requiredLegalDocumentsForEvent: () => [{
        key: "digital-purchases-refunds",
        route: "/legal/digital-purchases-refunds",
        shortLabel: "Digital purchases",
        version: "2026-08-29",
      }],
    },
  })
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage")
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: { setItem: (...args) => storageWrites.push(args) },
  })

  return {
    checkoutCalls,
    storageWrites,
    resolveCheckout,
    render: () => hooks.render(review.BackgroundCheckoutReview, { open: true, onOpenChange: () => {} }),
    cleanup() {
      try {
        hooks.unmount()
      } finally {
        if (previousStorage) Object.defineProperty(globalThis, "sessionStorage", previousStorage)
        else delete globalThis.sessionStorage
      }
    },
  }
}

describe("checkout review hook harness", () => {
  it("memoizes by dependency and cleans changed, removed, and unmounted effects by hook index", () => {
    const hooks = createHookHarness()
    const events = []
    let memoized

    function Fixture({ dependency, includeTail }) {
      memoized = hooks.react.useMemo(() => ({ dependency }), [dependency])
      hooks.react.useEffect(() => {
        events.push(`setup:${dependency}`)
        return () => events.push(`cleanup:${dependency}`)
      }, [dependency])
      if (includeTail) {
        hooks.react.useEffect(() => {
          events.push("setup:tail")
          return () => events.push("cleanup:tail")
        }, [])
      }
      return null
    }

    hooks.render(Fixture, { dependency: "first", includeTail: true })
    const firstMemo = memoized
    hooks.render(Fixture, { dependency: "first", includeTail: true })
    assert.equal(memoized, firstMemo)
    hooks.render(Fixture, { dependency: "second", includeTail: false })
    assert.notEqual(memoized, firstMemo)
    hooks.unmount()

    assert.deepEqual(events, [
      "setup:first",
      "setup:tail",
      "cleanup:first",
      "cleanup:tail",
      "setup:second",
      "cleanup:second",
    ])
  })
})

/** Supplies enough React hook lifecycle to observe event-driven rerenders. */
function createHookHarness() {
  const states = []
  const effects = []
  const memos = []
  let stateCursor = 0
  let effectCursor = 0
  let memoCursor = 0
  let pendingEffects = []
  const react = {
    useState(initialValue) {
      const index = stateCursor
      stateCursor += 1
      if (!Object.hasOwn(states, index)) {
        states[index] = typeof initialValue === "function" ? initialValue() : initialValue
      }
      return [states[index], (value) => {
        states[index] = typeof value === "function" ? value(states[index]) : value
      }]
    },
    useMemo(factory, dependencies) {
      const index = memoCursor
      memoCursor += 1
      const previous = memos[index]
      if (!previous || dependenciesChanged(previous.dependencies, dependencies)) {
        memos[index] = {
          dependencies: dependencies === undefined ? undefined : [...dependencies],
          value: factory(),
        }
      }
      return memos[index].value
    },
    useEffect(effect, dependencies) {
      const index = effectCursor
      effectCursor += 1
      if (dependenciesChanged(effects[index]?.dependencies, dependencies)) {
        pendingEffects.push({ effect, dependencies, index })
      }
    },
  }

  return {
    react,
    render(Component, props) {
      stateCursor = 0
      effectCursor = 0
      memoCursor = 0
      pendingEffects = []
      const tree = renderFunctionComponents(Component(props))
      const changedIndexes = new Set(pendingEffects.map(({ index }) => index))
      const cleanups = []
      for (let index = 0; index < effects.length; index += 1) {
        if (index < effectCursor && !changedIndexes.has(index)) continue
        const cleanup = effects[index]?.cleanup
        if (cleanup) cleanups.push(cleanup)
      }
      for (const cleanup of cleanups) cleanup()
      effects.length = effectCursor
      for (const { dependencies, effect, index } of pendingEffects) {
        const cleanup = effect()
        effects[index] = {
          cleanup: typeof cleanup === "function" ? cleanup : undefined,
          dependencies: dependencies === undefined ? undefined : [...dependencies],
        }
      }
      memos.length = memoCursor
      return tree
    },
    unmount() {
      for (const effect of effects) effect?.cleanup?.()
      effects.length = 0
      pendingEffects = []
    },
  }
}

function dependenciesChanged(previous, next) {
  return next === undefined
    || previous === undefined
    || previous.length !== next.length
    || previous.some((value, index) => !Object.is(value, next[index]))
}

describe("checkout return recovery", () => {
  it("polls server snapshots and never grants ownership from URL state", async () => {
    const source = await readFile(returnPath, "utf8")
    const commerceMembers = source.match(
      /const\s*\{(?<members>[^}]*)\}\s*=\s*useBackgroundCommerce\(\)/,
    )?.groups?.members ?? ""
    assert.match(source, /Confirming purchase/)
    assert.notEqual(commerceMembers, "", "checkout return must consume the commerce context")
    for (const member of ["state", "ensureSnapshot", "refresh"]) {
      assert.match(commerceMembers, new RegExp(`\\b${member}\\b`), member)
    }
    assert.match(source, /result !== "success" && result !== "cancelled"[\s\S]*void ensureSnapshot\(\)/)
    assert.match(source, /await refresh\(\)/)
    assert.match(source, /catch \{[\s\S]*finally \{[\s\S]*setChecks/)
    assert.match(source, /ownedBackgroundIds/)
    assert.match(source, /Check again/)
    assert.doesNotMatch(source, /session_id|ownedBackgroundIds\.push|grantOwnership/)
  })

  it("restores safe Clock, Chimer, and Music Background origins", async () => {
    const source = await readFile(returnPath, "utf8")
    assert.match(source, /backgroundPurchase=cancelled/)
    assert.match(source, /panel.*background/)
    assert.match(source, /if \(orderId\) url\.searchParams\.set\("orderId", orderId\)/)
    assert.match(source, /returnUrl\(resolvedReturnPath, "success", orderId\)/)
    assert.match(source, /\[fulfilled, orderId, pathname/)
    assert.match(source, /\/clock/)
    assert.match(source, /\/chimer/)
    const review = await readFile(reviewPath, "utf8")
    assert.match(review, /music/)
    const page = await readFile(chimerPagePath, "utf8")
    const setup = await readFile(setTimerPath, "utf8")
    assert.match(page, /searchParams\.get\("panel"\) === "background"/)
    assert.match(page, /initialStep=\{requestedInitialPanel === "background" \? CHIMER_BACKGROUND_SETUP_STEP_INDEX : 0\}/)
    assert.match(setup, /initialStep/)
    assert.match(setup, /CHIMER_BACKGROUND_SETUP_STEP_INDEX = CHIMER_SETUP_STEPS\.indexOf\("Choose background"\)/)
    assert.match(setup, /if \(CHIMER_BACKGROUND_SETUP_STEP_INDEX === -1\)/)
    assert.match(setup, /Number\.isFinite\(initialStep\) \? Math\.trunc\(initialStep\) : 0/)
    assert.match(setup, /setActiveStep\(Math\.min\(CHIMER_SETUP_STEPS\.length - 1, Math\.max\(0, normalizedStep\)\)\)/)
    assert.match(setup, /\}, \[initialStep\]\)/)
    assert.match(setup, /const canAdvanceStep = isTimerSet/)
    assert.match(setup, /stepIndex === 0 \? isTimerSet : stepIndex < activeStep/)
  })

  it("distinguishes delayed review and access exception states without processor ids", async () => {
    const source = await readFile(returnPath, "utf8")
    for (const copy of [
      "still processing",
      "manual review",
      "refund pending",
      "dispute suspended",
      "retired",
      "support",
    ]) {
      assert.match(source, new RegExp(copy, "i"))
    }
    assert.doesNotMatch(source, /stripe|paymentIntent|checkoutSession|chargeId/)
  })
})
