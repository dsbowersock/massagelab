import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  createCompiledModuleLoader,
  createElement,
  findElements,
  passThroughElement,
  renderFunctionComponents,
} from "./helpers/compiled-module.mjs"
import {
  DONATION_OPTIONS,
  DONATION_PURPOSE,
  ONE_TIME_SUPPORT_TAX_CODE,
  findDonationOption,
  normalizeDonationAmountCents,
} from "../lib/donations.js"
import { safeErrorCode } from "../lib/safe-error-code.js"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const CHECKOUT_ATTEMPT_ID = "123e4567-e89b-42d3-a456-426614174000"
const NEXT_CHECKOUT_ATTEMPT_ID = "01890f47-9f7b-4f2a-8c6d-f2bf668ad3d1"
const CHECKOUT_ATTEMPT_NOW = Date.UTC(2026, 7, 31, 12, 0, 0)
const publicRequestIdSource = await readFile(
  new URL("../lib/public-request-id.ts", import.meta.url),
  "utf8",
)
const donationAttemptSource = await readFile(
  new URL("../lib/donation-checkout-attempt.ts", import.meta.url),
  "utf8",
)
const pricingPageSource = await readFile(
  new URL("../app/pricing/page.tsx", import.meta.url),
  "utf8",
)
const donationFormSource = await readFile(
  new URL("../app/pricing/donation-checkout-form.tsx", import.meta.url),
  "utf8",
)

const { normalizePublicRequestId } = loadCompiledModule(
  publicRequestIdSource,
  "lib/public-request-id.ts",
)

function loadDonationAttemptModule() {
  const donations = { DONATION_OPTIONS, findDonationOption }
  const requestIds = { normalizePublicRequestId }
  return loadCompiledModule(
    donationAttemptSource,
    "lib/donation-checkout-attempt.ts",
    {
      "./donations.js": donations,
      "@/lib/donations": donations,
      "./public-request-id.ts": requestIds,
      "@/lib/public-request-id": requestIds,
    },
  )
}

/** Renders the public pricing page with local read-only doubles around its billing forms. */
async function renderPricingPage(donation) {
  const Div = passThroughElement("div")
  const Button = passThroughElement("button")
  const Form = passThroughElement("form")
  const pricingPage = loadCompiledModule(
    pricingPageSource,
    "app/pricing/page.tsx",
    {
      "react/jsx-runtime": { Fragment: "fragment", jsx: createElement, jsxs: createElement },
      "next/link": passThroughElement("a"),
      "lucide-react": {
        HeartHandshake: Div,
        ShieldCheck: Div,
        Sparkles: Div,
      },
      "@/lib/rsc-session": { getCurrentRscSession: async () => null },
      "@/lib/donations": { DONATION_OPTIONS },
      "@/lib/membership": {
        getUserMembershipPricingStatus: async () => null,
        resolveMembershipPricingMode: () => "auth",
      },
      "@/lib/membership-pricing": { getMembershipPricingCatalog: async () => ({}) },
      "@/lib/public-launch-controls": {
        getPublicLaunchControls: () => ({ registrationOpen: true, supporterCheckoutOpen: true }),
      },
      "@/lib/prisma": { prisma: {} },
      "@/components/membership/pricing-cards": { MembershipPricingCards: Div },
      "@/app/pricing/donation-checkout-form": {
        DonationCheckoutForm: Form,
      },
      "@/components/ui/app-surface": {
        AppNotice: Div,
        AppPageShell: Div,
        AppSurface: Div,
        appCalloutClassName: "test-callout",
      },
      "@/components/ui/button": { Button },
      "@/components/ui/metal-attention-button": { MetalAttentionButton: Button },
      "@/lib/seo": { createPublicPageMetadata: () => ({}) },
      "@/lib/safe-error-code": { safeErrorCode },
      "node:crypto": { randomUUID: () => CHECKOUT_ATTEMPT_ID },
    },
  )

  return renderFunctionComponents(await pricingPage.default({
    searchParams: Promise.resolve({ donation }),
  }))
}

describe("one-time support options", () => {
  it("offers fixed one-time support amounts", () => {
    assert.deepEqual(
      DONATION_OPTIONS.map((option) => option.amountCents),
      [500, 1500, 3000, 7500],
    )
    assert.equal(DONATION_PURPOSE, "massagelab_project_support")
    assert.equal(ONE_TIME_SUPPORT_TAX_CODE, "txcd_90000001")
    assert.equal(DONATION_OPTIONS.every((option) => /support/i.test(option.description)), true)
    assert.equal(DONATION_OPTIONS.some((option) => /donation|donate/i.test(option.description)), false)
  })

  it("rejects arbitrary client-provided amounts", () => {
    assert.equal(normalizeDonationAmountCents("1500"), 1500)
    assert.equal(findDonationOption(3000)?.label, "$30")
    assert.equal(normalizeDonationAmountCents("1499"), null)
    assert.equal(normalizeDonationAmountCents("999999"), null)
    assert.equal(findDonationOption("free"), null)
  })
})

describe("donation Checkout attempt records", () => {
  it("accepts only a canonical current 24-hour browser attempt record", () => {
    const { readDonationCheckoutAttempt } = loadDonationAttemptModule()
    const valid = {
      attemptId: CHECKOUT_ATTEMPT_ID,
      amountCents: 1500,
      createdAt: CHECKOUT_ATTEMPT_NOW - (24 * 60 * 60 * 1000),
    }

    assert.deepEqual(
      readDonationCheckoutAttempt(JSON.stringify(valid), { now: CHECKOUT_ATTEMPT_NOW }),
      valid,
    )

    for (const invalid of [
      null,
      "",
      "not-json",
      "[]",
      JSON.stringify({ ...valid, attemptId: CHECKOUT_ATTEMPT_ID.toUpperCase() }),
      JSON.stringify({ ...valid, attemptId: "123e4567-e89b-12d3-a456-426614174000" }),
      JSON.stringify({ ...valid, attemptId: "123e4567-e89b-42d3-7456-426614174000" }),
      JSON.stringify({ ...valid, amountCents: 1499 }),
      JSON.stringify({ ...valid, createdAt: Number.NaN }),
      JSON.stringify({ ...valid, createdAt: CHECKOUT_ATTEMPT_NOW + 1 }),
      JSON.stringify({ ...valid, createdAt: CHECKOUT_ATTEMPT_NOW - (24 * 60 * 60 * 1000) - 1 }),
    ]) {
      assert.equal(readDonationCheckoutAttempt(invalid, { now: CHECKOUT_ATTEMPT_NOW }), null, invalid)
    }
  })

  it("retains only a valid same-amount attempt and rotates amount, expiry, or deliberate-new work", () => {
    const {
      donationCheckoutAttemptForAmount,
      readDonationCheckoutAttempt,
    } = loadDonationAttemptModule()
    const current = readDonationCheckoutAttempt(JSON.stringify({
      attemptId: CHECKOUT_ATTEMPT_ID,
      amountCents: 500,
      createdAt: CHECKOUT_ATTEMPT_NOW - 1_000,
    }), { now: CHECKOUT_ATTEMPT_NOW })
    let createCalls = 0
    const createId = () => {
      createCalls += 1
      return NEXT_CHECKOUT_ATTEMPT_ID
    }

    assert.equal(donationCheckoutAttemptForAmount({
      current,
      amountCents: 500,
      createId,
      now: CHECKOUT_ATTEMPT_NOW,
    }), current)
    assert.equal(createCalls, 0)

    for (const [input, expectedAmount] of [
      [{ current, amountCents: 1500 }, 1500],
      [{ current: null, amountCents: 500 }, 500],
      [{ current, amountCents: 500, forceNew: true }, 500],
      [{
        current: { ...current, createdAt: CHECKOUT_ATTEMPT_NOW - (24 * 60 * 60 * 1000) - 1 },
        amountCents: 500,
      }, 500],
    ]) {
      assert.deepEqual(donationCheckoutAttemptForAmount({
        ...input,
        createId,
        now: CHECKOUT_ATTEMPT_NOW,
      }), {
        attemptId: NEXT_CHECKOUT_ATTEMPT_ID,
        amountCents: expectedAmount,
        createdAt: CHECKOUT_ATTEMPT_NOW,
      })
    }
    assert.equal(createCalls, 4)

    assert.throws(() => donationCheckoutAttemptForAmount({
      current: null,
      amountCents: 1499,
      createId,
      now: CHECKOUT_ATTEMPT_NOW,
    }))
    assert.throws(() => donationCheckoutAttemptForAmount({
      current: null,
      amountCents: 500,
      createId: () => "not-a-uuid",
      now: CHECKOUT_ATTEMPT_NOW,
    }))
  })

  it("clears only terminal or conflicting redirects and retains retry-ambiguous attempts", () => {
    const { shouldClearDonationCheckoutAttempt } = loadDonationAttemptModule()
    for (const code of ["thanks", "cancelled", "invalid-amount", "invalid-request", "conflict"]) {
      assert.equal(shouldClearDonationCheckoutAttempt(code), true, code)
    }
    for (const code of [undefined, "", "rate-limited", "unavailable", "checkout-error", "timeout", "unknown"]) {
      assert.equal(shouldClearDonationCheckoutAttempt(code), false, code)
    }
  })

  it("derives the exact non-identifying donation provider key", () => {
    const { donationCheckoutIdempotencyKey } = loadDonationAttemptModule()
    assert.equal(
      donationCheckoutIdempotencyKey(CHECKOUT_ATTEMPT_ID),
      `massagelab-donation-v1:${CHECKOUT_ATTEMPT_ID}`,
    )
    for (const invalid of [
      CHECKOUT_ATTEMPT_ID.toUpperCase(),
      "not-a-uuid",
      "123e4567-e89b-12d3-a456-426614174000",
    ]) {
      assert.throws(() => donationCheckoutIdempotencyKey(invalid))
    }
  })
})

describe("one-time support pricing owner", () => {
  it("renders one donation form owner with every catalog option and a server UUID", async () => {
    const pricingPage = await renderPricingPage()
    const donationForms = findElements(
      pricingPage,
      (element) => element.type === "form" && Array.isArray(element.props.options),
    )

    assert.equal(donationForms.length, 1)
    assert.deepEqual(donationForms[0].props.options, DONATION_OPTIONS)
    assert.equal(donationForms[0].props.initialAttemptId, CHECKOUT_ATTEMPT_ID)
  })

  it("uses one native form with synchronous attempt persistence and no automatic replay", () => {
    assert.match(donationFormSource, /^"use client"/)
    assert.equal((donationFormSource.match(/<form\b/g) ?? []).length, 1)
    assert.match(donationFormSource, /action="\/api\/billing\/donation"/)
    assert.match(donationFormSource, /method="post"/)
    assert.match(donationFormSource, /name="amountCents"/)
    assert.match(donationFormSource, /name="checkoutAttemptId"/)
    assert.match(donationFormSource, /sessionStorage\.setItem/)
    assert.ok(
      donationFormSource.indexOf("sessionStorage.setItem")
        < donationFormSource.indexOf("setPending(true)"),
      "the attempt must be persisted before the pending navigation state",
    )
    assert.match(donationFormSource, /Opening secure checkout…/)
    assert.match(donationFormSource, /Start a new checkout attempt/)
    assert.doesNotMatch(donationFormSource, /\.(?:requestSubmit|submit)\s*\(|\bfetch\s*\(/)
  })

  it("recovers a retained native attempt from pending when pageshow restores bfcache", () => {
    const storage = new Map()
    const storageWrites = []
    const listeners = new Map()
    const animationFrames = []
    const nativeSubmissions = []
    const previousWindow = globalThis.window
    const previousSessionStorage = globalThis.sessionStorage
    const previousHtmlFormElement = globalThis.HTMLFormElement
    globalThis.window = {
      addEventListener: (type, listener) => listeners.set(type, listener),
      removeEventListener: (type, listener) => {
        if (listeners.get(type) === listener) listeners.delete(type)
      },
      requestAnimationFrame: (callback) => {
        animationFrames.push(callback)
        return animationFrames.length
      },
    }
    globalThis.sessionStorage = {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        storageWrites.push([key, value])
        storage.set(key, value)
      },
      removeItem: (key) => storage.delete(key),
    }

    try {
      class FakeHtmlFormElement {
        submit() {
          nativeSubmissions.push({
            amountCents: amountInput.value,
            checkoutAttemptId: attemptInput.value,
          })
        }
      }
      globalThis.HTMLFormElement = FakeHtmlFormElement
      const stateSlots = []
      const refSlots = []
      const effectDependencies = []
      const pendingEffects = []
      const effectCleanups = []
      let stateCursor = 0
      let refCursor = 0
      let effectCursor = 0
      const sameDependencies = (left, right) => (
        Array.isArray(left)
        && Array.isArray(right)
        && left.length === right.length
        && left.every((value, index) => Object.is(value, right[index]))
      )
      const react = {
        useEffect(effect, dependencies) {
          const index = effectCursor++
          if (!sameDependencies(effectDependencies[index], dependencies)) {
            effectDependencies[index] = dependencies
            pendingEffects.push([index, effect])
          }
        },
        useRef(current) {
          const index = refCursor++
          refSlots[index] ??= { current }
          return refSlots[index]
        },
        useState(initial) {
          const index = stateCursor++
          if (!(index in stateSlots)) {
            stateSlots[index] = typeof initial === "function" ? initial() : initial
          }
          return [stateSlots[index], (value) => {
            stateSlots[index] = typeof value === "function" ? value(stateSlots[index]) : value
          }]
        },
      }
      const SharedButton = passThroughElement("button")
      const { DonationCheckoutForm } = loadCompiledModule(
        donationFormSource,
        "app/pricing/donation-checkout-form.tsx",
        {
          "react/jsx-runtime": { Fragment: "fragment", jsx: createElement, jsxs: createElement },
          react,
          "react-dom": { flushSync: (callback) => callback() },
          "@/components/ui/button": { Button: SharedButton },
          "@/lib/donation-checkout-attempt": loadDonationAttemptModule(),
        },
      )
      const render = () => {
        stateCursor = 0
        refCursor = 0
        effectCursor = 0
        return renderFunctionComponents(DonationCheckoutForm({
          options: DONATION_OPTIONS,
          initialAttemptId: CHECKOUT_ATTEMPT_ID,
        }))
      }
      const flushEffects = () => {
        for (const [index, effect] of pendingEffects.splice(0)) {
          effectCleanups[index]?.()
          effectCleanups[index] = effect()
        }
      }

      let tree = render()
      let amountInput
      let attemptInput
      for (const input of findElements(tree, (element) => element.type === "input")) {
        const renderedInput = { value: input.props.defaultValue }
        input.props.ref.current = renderedInput
        if (input.props.name === "amountCents") amountInput = renderedInput
        if (input.props.name === "checkoutAttemptId") attemptInput = renderedInput
      }
      flushEffects()
      assert.equal(typeof listeners.get("pageshow"), "function")

      const form = findElements(tree, (element) => element.type === "form")[0]
      const submitButtons = findElements(
        tree,
        (element) => element.type === "button" && element.props.type === "submit",
      )
      assert.deepEqual(
        submitButtons.map((button) => ({
          ariaLabel: button.props["aria-label"],
          effect: button.props.effect,
          name: button.props.name,
          tone: button.props.tone,
          type: button.props.type,
          value: button.props.value,
          variant: button.props.variant,
        })),
        DONATION_OPTIONS.map((option) => ({
          ariaLabel: `${option.label} ${option.description}`,
          effect: "glowFlicker",
          name: "amountCents",
          tone: "pricing",
          type: "submit",
          value: option.amountCents,
          variant: "glow",
        })),
      )
      const explicitNewButton = findElements(
        tree,
        (element) => element.type === "button" && element.props.type === "button",
      )[0]
      assert.equal(explicitNewButton.props.variant, "link")

      const submitButton = submitButtons.find((button) => button.props.value === 500)
      assert.ok(submitButton)
      let prevented = false
      form.props.onSubmitCapture({
        currentTarget: new FakeHtmlFormElement(),
        nativeEvent: { submitter: submitButton.props },
        preventDefault: () => { prevented = true },
      })
      assert.equal(prevented, true)
      assert.equal(storageWrites.length, 1)
      assert.equal(nativeSubmissions.length, 0, "native submit waits until pending can paint")

      tree = render()
      assert.equal(
        findElements(tree, (element) => element.type === "button" && element.props.type === "submit")
          .every((button) => button.props.disabled === true),
        true,
      )
      assert.equal(findElements(tree, (element) => element.props.role === "status").length, 1)

      assert.equal(animationFrames.length, 1)
      animationFrames.shift()()
      assert.equal(nativeSubmissions.length, 0, "one painted frame precedes native navigation")
      assert.equal(animationFrames.length, 1)
      animationFrames.shift()()
      assert.deepEqual(nativeSubmissions, [{
        amountCents: "500",
        checkoutAttemptId: CHECKOUT_ATTEMPT_ID,
      }])

      listeners.get("pageshow")()
      tree = render()
      assert.equal(
        findElements(tree, (element) => element.type === "button" && element.props.type === "submit")
          .every((button) => button.props.disabled === false),
        true,
      )
      assert.equal(findElements(tree, (element) => element.props.role === "status").length, 0)
      assert.equal(storageWrites.length, 1, "pageshow must not replay or replace the retained attempt")
      assert.equal(nativeSubmissions.length, 1, "pageshow must not resubmit the retained attempt")

      for (const cleanup of effectCleanups) cleanup?.()
      assert.equal(listeners.size, 0)
    } finally {
      if (previousWindow === undefined) delete globalThis.window
      else globalThis.window = previousWindow
      if (previousSessionStorage === undefined) delete globalThis.sessionStorage
      else globalThis.sessionStorage = previousSessionStorage
      if (previousHtmlFormElement === undefined) delete globalThis.HTMLFormElement
      else globalThis.HTMLFormElement = previousHtmlFormElement
    }
  })

  it("renders fixed notices for bounded, unavailable, and conflicting attempts", async () => {
    for (const [code, title] of [
      ["rate-limited", "One-time support checkout temporarily paused"],
      ["unavailable", "One-time support checkout temporarily unavailable"],
      ["conflict", "One-time support checkout attempt changed"],
    ]) {
      const pricingPage = await renderPricingPage(code)
      const notices = findElements(
        pricingPage,
        (element) => element.props.title === title,
      )
      assert.equal(notices.length, 1, code)
      assert.equal(typeof notices[0].props.description, "string", code)
    }
  })
})
