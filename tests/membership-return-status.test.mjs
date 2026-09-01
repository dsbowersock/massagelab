import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { fetchJsonWithTimeout } from "../lib/client-fetch.ts"
import { BILLING_PORTAL_DESTINATIONS } from "../lib/billing-portal-destinations.js"
import {
  createCompiledModuleLoader,
  createElement,
  findElement,
  passThroughElement,
  renderFunctionComponents,
} from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const formattedAccountDates = []
const membershipReturnSource = await readFile(
  new URL("../app/account/membership-return-status.tsx", import.meta.url),
  "utf8",
)
const {
  MEMBERSHIP_RETURN_POLL_DELAYS_MS,
  parseMembershipConvergenceStatus,
  pollMembershipReturnStatus,
  readPersistedMembershipStatus,
  statusMessage,
} = loadCompiledModule(
  membershipReturnSource,
  "app/account/membership-return-status.tsx",
  {
    "react/jsx-runtime": {
      Fragment: Symbol.for("membership-return-test.fragment"),
      jsx: () => null,
      jsxs: () => null,
    },
    "next/link": () => null,
    react: {
      useCallback: () => {},
      useEffect: () => {},
      useRef: () => ({ current: null }),
      useState: () => [null, () => {}],
    },
    "@/components/forms/pending-submission-form": {
      PendingSubmissionForm: () => null,
      PendingSubmitButton: () => null,
    },
    "@/components/ui/button": { Button: () => null },
    "@/components/ui/loader": { Loader: () => null },
    "@/lib/billing-portal-destinations": {
      BILLING_PORTAL_DESTINATIONS,
    },
    "@/lib/client-fetch": { fetchJsonWithTimeout },
    "@/lib/account-page": {
      formatAccountDate: (date) => {
        formattedAccountDates.push(date)
        return "local-account-date"
      },
    },
  },
)

/** Creates the complete provider-free status projection consumed by the return watcher. */
function persistedStatus({
  state = "active",
  revision = "2026-08-29T12:00:01.000Z",
  paidLevel = state === "active" ? "SUPPORTER" : null,
  featureKeys = state === "active" ? ["premium_backgrounds"] : [],
  subscriptionStatus = state === "active" ? "active" : "incomplete_expired",
  portalAvailable = true,
} = {}) {
  return {
    state,
    paidLevel,
    featureKeys,
    subscriptionStatus,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: state === "active" ? "2026-09-29T12:00:00.000Z" : null,
    revision,
    portalAvailable,
  }
}

/** Drives deterministic status/error reads while recording every wait and published status. */
function pollingFixture(sequence) {
  const waits = []
  const displays = []
  let reads = 0
  return {
    displays,
    waits,
    get reads() {
      return reads
    },
    options: {
      wait: async (delay) => waits.push(delay),
      readStatus: async () => {
        const value = sequence[reads]
        reads += 1
        if (value instanceof Error) throw value
        return value
      },
      onStatus: (status) => displays.push(status),
    },
  }
}

/** Installs abort-only fetches for deadline/unmount tests and returns their signals plus cleanup. */
function installStalledMembershipFetch(onStart = () => {}) {
  const originalFetch = globalThis.fetch
  const requestSignals = []
  globalThis.fetch = (_input, init = {}) => new Promise((_resolve, reject) => {
    requestSignals.push(init.signal)
    onStart()
    init.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true })
  })
  return {
    requestSignals,
    restore() {
      globalThis.fetch = originalFetch
    },
  }
}

describe("bounded membership return polling", () => {
  it("rejects malformed endpoint payloads so they consume a safe retry instead of breaking render", () => {
    assert.deepEqual(
      parseMembershipConvergenceStatus(persistedStatus()),
      persistedStatus(),
    )
    for (const value of [null, {}, { ...persistedStatus(), featureKeys: null }]) {
      assert.throws(() => parseMembershipConvergenceStatus(value), /membership status response/i)
    }
  })

  it("uses exactly five reads over the prescribed fifteen-second delay bound", () => {
    assert.deepEqual([...MEMBERSHIP_RETURN_POLL_DELAYS_MS], [0, 1_000, 2_000, 4_000, 8_000])
    assert.equal(MEMBERSHIP_RETURN_POLL_DELAYS_MS.reduce((total, delay) => total + delay, 0), 15_000)
  })

  it("keeps an old incomplete_expired Checkout row as processing until a new active revision arrives", async () => {
    const oldTerminal = persistedStatus({
      state: "billing-attention",
      revision: "2026-08-29T12:00:00.000Z",
      subscriptionStatus: "incomplete_expired",
    })
    const active = persistedStatus({ revision: "2026-08-29T12:00:03.000Z" })
    const fixture = pollingFixture([oldTerminal, oldTerminal, active])

    const result = await pollMembershipReturnStatus({ kind: "checkout", ...fixture.options })

    assert.equal(result.outcome, "settled")
    assert.equal(result.attempts, 3)
    assert.equal(result.baselineRevision, oldTerminal.revision)
    assert.deepEqual(fixture.displays, [active])
    assert.deepEqual(fixture.waits, [0, 1_000, 2_000])
  })

  it("confirms Checkout billing attention or no membership only after the polling run observes a changed revision", async () => {
    for (const state of ["billing-attention", "no-active-membership"]) {
      const baseline = persistedStatus({ state, revision: "2026-08-29T12:00:00.000Z" })
      const changed = persistedStatus({ state, revision: "2026-08-29T12:00:05.000Z" })
      const fixture = pollingFixture([baseline, baseline, changed])

      const result = await pollMembershipReturnStatus({ kind: "checkout", ...fixture.options })

      assert.equal(result.outcome, "settled")
      assert.deepEqual(fixture.displays, [changed])
    }
  })

  it("settles Checkout active access immediately even when its revision is unchanged", async () => {
    const active = persistedStatus()
    const fixture = pollingFixture([active])

    const result = await pollMembershipReturnStatus({ kind: "checkout", ...fixture.options })

    assert.equal(result.outcome, "settled")
    assert.equal(result.attempts, 1)
    assert.deepEqual(fixture.displays, [active])
  })

  it("advances safely through transient failures and exhausts all five Checkout reads", async () => {
    const fixture = pollingFixture([
      new Error("temporary one"),
      new Error("temporary two"),
      persistedStatus({ state: "billing-attention", revision: "old" }),
      new Error("temporary three"),
      persistedStatus({ state: "billing-attention", revision: "old" }),
    ])

    const result = await pollMembershipReturnStatus({ kind: "checkout", ...fixture.options })

    assert.equal(result.outcome, "exhausted")
    assert.equal(result.attempts, 5)
    assert.equal(fixture.reads, 5)
    assert.deepEqual(fixture.waits, [0, 1_000, 2_000, 4_000, 8_000])
    assert.deepEqual(fixture.displays, [])
  })

  it("consumes five deadline-aborted stalled reads before clearing to the safe retry outcome", { timeout: 500 }, async () => {
    const stalledFetch = installStalledMembershipFetch()
    const owner = new AbortController()
    const waits = []
    const displays = []

    try {
      const result = await pollMembershipReturnStatus({
        kind: "checkout",
        signal: owner.signal,
        wait: async (delay) => waits.push(delay),
        readStatus: () => readPersistedMembershipStatus(owner.signal, 5),
        onStatus: (status) => displays.push(status),
      })

      assert.equal(result.outcome, "exhausted")
      assert.equal(result.attempts, 5)
      assert.equal(owner.signal.aborted, false)
      assert.deepEqual(waits, [0, 1_000, 2_000, 4_000, 8_000])
      assert.deepEqual(displays, [])
      assert.equal(stalledFetch.requestSignals.length, 5)
      assert.equal(stalledFetch.requestSignals.every((signal) => signal?.aborted), true)
      assert.equal(stalledFetch.requestSignals.every((signal) => signal?.reason?.name === "TimeoutError"), true)
    } finally {
      stalledFetch.restore()
    }
  })

  it("composes owner abort with a stalled deadline read without publishing post-unmount state", { timeout: 500 }, async () => {
    let notifyStarted
    const started = new Promise((resolve) => {
      notifyStarted = resolve
    })
    const stalledFetch = installStalledMembershipFetch(notifyStarted)
    const owner = new AbortController()
    const displays = []

    try {
      const pending = pollMembershipReturnStatus({
        kind: "portal",
        signal: owner.signal,
        wait: async () => {},
        readStatus: () => readPersistedMembershipStatus(owner.signal, 1_000),
        onStatus: (status) => displays.push(status),
      })
      await started
      owner.abort(new DOMException("Membership return unmounted.", "AbortError"))

      const result = await pending
      assert.equal(result.outcome, "aborted")
      assert.equal(result.attempts, 0)
      assert.deepEqual(displays, [])
      assert.equal(stalledFetch.requestSignals.length, 1)
      assert.equal(stalledFetch.requestSignals[0]?.reason?.name, "AbortError")
    } finally {
      stalledFetch.restore()
    }
  })

  it("does not publish a read that settles after its owner has unmounted", async () => {
    let resolveRead
    let notifyReadStarted
    const delayedStatus = new Promise((resolve) => {
      resolveRead = resolve
    })
    const readStarted = new Promise((resolve) => {
      notifyReadStarted = resolve
    })
    const owner = new AbortController()
    const displays = []
    const pending = pollMembershipReturnStatus({
      kind: "portal",
      signal: owner.signal,
      wait: async () => {},
      readStatus: () => {
        notifyReadStarted()
        return delayedStatus
      },
      onStatus: (status) => displays.push(status),
    })

    await readStarted
    owner.abort(new DOMException("Membership return unmounted.", "AbortError"))
    resolveRead(persistedStatus())

    const result = await pending
    assert.equal(result.outcome, "aborted")
    assert.deepEqual(displays, [])
  })

  it("shows Portal persisted state on the first read while watching for a changed revision", async () => {
    const attention = persistedStatus({ state: "billing-attention", revision: "old" })
    const active = persistedStatus({ revision: "new" })
    const fixture = pollingFixture([attention, attention, active])

    const result = await pollMembershipReturnStatus({ kind: "portal", ...fixture.options })

    assert.equal(result.outcome, "settled")
    assert.equal(result.baselineRevision, "old")
    assert.deepEqual(fixture.displays, [attention, attention, active])
  })

  it("clears a bounded unchanged Portal watch without losing the first-read status", async () => {
    const active = persistedStatus({ revision: "same" })
    const fixture = pollingFixture([active, active, active, active, active])

    const result = await pollMembershipReturnStatus({ kind: "portal", ...fixture.options })

    assert.equal(result.outcome, "exhausted")
    assert.equal(result.status, active)
    assert.equal(result.attempts, 5)
    assert.equal(fixture.displays.length, 5)
  })
})

describe("membership return component safety", () => {
  it("formats cancellation period ends through the shared local account-date owner", () => {
    assert.equal(typeof statusMessage, "function")
    const currentPeriodEnd = "2026-09-29T00:30:00.000Z"
    const status = {
      ...persistedStatus(),
      cancelAtPeriodEnd: true,
      currentPeriodEnd,
    }
    formattedAccountDates.length = 0

    assert.equal(
      statusMessage(status, false, "portal"),
      "Your membership access is active through local-account-date.",
    )
    assert.deepEqual(
      formattedAccountDates.map((date) => date.toISOString()),
      [currentPeriodEnd],
    )
    assert.match(membershipReturnSource, /import \{ formatAccountDate \} from "@\/lib\/account-page"/)
    assert.doesNotMatch(membershipReturnSource, /currentPeriodEnd\.slice/)
  })

  it("gives the billing-attention portal form one synchronous pending owner", () => {
    const states = [persistedStatus({ state: "billing-attention" }), false, false, 0]
    let stateIndex = 0
    let pendingFormProps = null
    let pendingButtonProps = null
    const compiled = loadCompiledModule(
      membershipReturnSource,
      "app/account/membership-return-status.portal-form-test.tsx",
      {
        "react/jsx-runtime": { Fragment: "fragment", jsx: createElement, jsxs: createElement },
        "next/link": passThroughElement("a"),
        react: {
          useCallback: (callback) => callback,
          useEffect: () => {},
          useRef: () => ({ current: null }),
          useState: () => [states[stateIndex++], () => {}],
        },
        "@/components/forms/pending-submission-form": {
          PendingSubmissionForm(props) {
            pendingFormProps = props
            return createElement("form", props)
          },
          PendingSubmitButton(props) {
            pendingButtonProps = props
            return createElement("button", props)
          },
        },
        "@/components/ui/button": { Button: passThroughElement("button") },
        "@/components/ui/loader": { Loader: passThroughElement("loader") },
        "@/lib/account-page": { formatAccountDate: () => "local-account-date" },
        "@/lib/billing-portal-destinations": {
          BILLING_PORTAL_DESTINATIONS,
        },
        "@/lib/client-fetch": { fetchJsonWithTimeout },
      },
    )

    const tree = renderFunctionComponents(compiled.MembershipReturnStatus({ kind: "portal" }))
    assert.ok(pendingFormProps, "billing management must reuse the native pending form owner")
    assert.equal(pendingFormProps.action, "/api/billing/portal")
    assert.equal(pendingFormProps.method, "post")
    assert.equal(pendingFormProps.pendingLabel, "Opening billing portal…")
    assert.ok(pendingButtonProps, "billing management must expose the form's pending state")
    assert.equal(pendingButtonProps.type, "submit")
    assert.equal(pendingButtonProps.variant, "outline")
    assert.equal(pendingButtonProps.pendingLabel, "Opening billing portal…")
    assert.equal(pendingButtonProps.children, "Manage billing account")
    const destination = findElement(tree, ({ type, props }) => (
      type === "input" && props.name === "destination"
    ))
    assert.ok(destination)
    assert.equal(destination.props.value, "manage")
  })

  it("uses one polite live region, canonical hidden loader semantics, retry-only timeout, and no Checkout recreation", async () => {
    const source = membershipReturnSource

    assert.equal((source.match(/aria-live="polite"/g) ?? []).length, 1)
    assert.match(source, /aria-busy=\{busy\}/)
    assert.match(source, /<Loader[^>]*aria-hidden="true"/s)
    assert.match(source, /still processing/i)
    assert.match(source, /Check status again/)
    assert.match(source, /\/api\/billing\/membership-status/)
    assert.match(source, /\/chimer\?panel=background/)
    assert.match(source, /\/api\/billing\/portal/)
    assert.doesNotMatch(source, /\/api\/billing\/checkout|CHECKOUT_SESSION_ID|session_id|stripe/i)
  })

  it("reuses the exact disposable-target guard and migration-gated fixture boundary", async () => {
    const [specSource, fixtureSource] = await Promise.all([
      readFile(new URL("./browser/membership-return-status.spec.ts", import.meta.url), "utf8"),
      readFile(new URL("./browser/membership-return-status-fixture.ts", import.meta.url), "utf8"),
    ])

    assert.match(specSource, /isBrowserQaDatabaseTargetAuthorized\(process\.env\)/)
    assert.match(specSource, /explicitly approved disposable target\/fingerprint and applied 20260828130000_membership_subscription_convergence migration/)
    assert.match(fixtureSource, /20260828130000_membership_subscription_convergence/)
    assert.match(fixtureSource, /\.example\.test/)
    assert.match(fixtureSource, /installSignedInSessionCookie/)
    assert.match(fixtureSource, /membershipSubscription\.deleteMany/)
    assert.match(fixtureSource, /stripeCustomer\.deleteMany/)
    assert.match(fixtureSource, /user\.deleteMany/)
    assert.doesNotMatch(fixtureSource, /process\.env\.(?:DATABASE_URL|DIRECT_URL)\s*=|Remove-Item|VERCEL_ENV\s*=\s*["']production/i)
  })
})
