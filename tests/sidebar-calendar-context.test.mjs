import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readFileSync } from "node:fs"
import * as sidebarCalendarContextModule from "../lib/sidebar-calendar-context.js"
import {
  createCompiledModuleLoader,
  createElement,
} from "./helpers/compiled-module.mjs"

const { emptySidebarCalendarContext } = sidebarCalendarContextModule

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const providerSource = readFileSync(
  new URL("../components/sidebar/sidebar-calendar-provider.tsx", import.meta.url),
  "utf8",
)
const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8")
const routeSource = readFileSync(
  new URL("../app/api/calendar/sidebar-context/route.ts", import.meta.url),
  "utf8",
)

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

function loadCoordinator(loadContext, options = {}) {
  const {
    fetchJsonWithTimeout = async () => ({ response: { ok: false }, json: undefined }),
    ...coordinatorOptions
  } = options
  const provider = loadCompiledModule(
    providerSource,
    "components/sidebar/sidebar-calendar-provider.test.tsx",
    {
      react: {
        createContext: () => ({ Provider: () => null }),
        useCallback: (callback) => callback,
        useContext: () => null,
        useEffect: () => undefined,
        useMemo: (factory) => factory(),
        useState: (initial) => [typeof initial === "function" ? initial() : initial, () => undefined],
      },
      "@/lib/client-fetch": { fetchJsonWithTimeout },
      "@/lib/sidebar-calendar-context": { emptySidebarCalendarContext },
    },
  )
  assert.equal(
    typeof provider.createSidebarCalendarCoordinator,
    "function",
    "sidebar calendar must expose one testable owner-keyed request coordinator",
  )
  return provider.createSidebarCalendarCoordinator({
    initialEnabled: false,
    initialOwnerKey: null,
    loadContext,
    ...coordinatorOptions,
  })
}

/** Replays Provider effects with stable hook slots for owner-change and unmount assertions. */
function createSidebarProviderEffectHarness(fetchJsonWithTimeout) {
  const stateSlots = []
  const effectSlots = []
  let stateCursor = 0
  let effectCursor = 0

  function dependenciesChanged(previous, current) {
    return !previous
      || !current
      || previous.length !== current.length
      || current.some((value, index) => !Object.is(value, previous[index]))
  }

  const react = {
    createContext: () => ({ Provider: "context-provider" }),
    useCallback: (callback) => callback,
    useContext: () => null,
    useEffect: (effect, dependencies) => {
      const index = effectCursor
      effectCursor += 1
      const previous = effectSlots[index]
      effectSlots[index] = {
        cleanup: previous?.cleanup,
        dependencies,
        effect,
        pending: dependenciesChanged(previous?.dependencies, dependencies),
      }
    },
    useMemo: (factory) => factory(),
    useState: (initial) => {
      const index = stateCursor
      stateCursor += 1
      if (!Object.hasOwn(stateSlots, index)) {
        stateSlots[index] = typeof initial === "function" ? initial() : initial
      }
      return [stateSlots[index], (value) => {
        stateSlots[index] = typeof value === "function" ? value(stateSlots[index]) : value
      }]
    },
  }
  const provider = loadCompiledModule(
    providerSource,
    "components/sidebar/sidebar-calendar-provider.effect-test.tsx",
    {
      react,
      "react/jsx-runtime": { Fragment: "fragment", jsx: createElement, jsxs: createElement },
      "@/lib/client-fetch": { fetchJsonWithTimeout },
      "@/lib/sidebar-calendar-context": { emptySidebarCalendarContext },
    },
  )

  return {
    render(props) {
      stateCursor = 0
      effectCursor = 0
      provider.SidebarCalendarProvider({ ...props, children: null })
      for (const slot of effectSlots) {
        if (!slot.pending) continue
        slot.cleanup?.()
        slot.cleanup = slot.effect()
        slot.pending = false
      }
    },
    unmount() {
      for (const slot of effectSlots.toReversed()) slot.cleanup?.()
      effectSlots.length = 0
    },
  }
}

function loadRoute(session, contextLoads, ownerCalls = []) {
  return loadCompiledModule(routeSource, "app/api/calendar/sidebar-context/route.test.ts", {
    "next/server": {
      NextResponse: {
        json: (body, init = {}) => ({ body, status: init.status ?? 200 }),
      },
    },
    "@/auth": { getCurrentSession: async () => session },
    "@/lib/sidebar-calendar-context": {
      isCanonicalSidebarCalendarOwnerId:
        sidebarCalendarContextModule.isCanonicalSidebarCalendarOwnerId,
      getSidebarCalendarContext: async (ownerId) => {
        ownerCalls.push(ownerId)
        contextLoads.count += 1
        return emptySidebarCalendarContext
      },
    },
  })
}

describe("sidebar calendar context route gating", () => {
  it("makes zero endpoint requests for an owner without a practice membership", async () => {
    let requests = 0
    const coordinator = loadCoordinator(async () => {
      requests += 1
      return { practice: { id: "unexpected", name: "Unexpected" } }
    })

    await coordinator.adopt({ ownerKey: "owner-a", enabled: false })

    assert.equal(requests, 0)
    assert.equal(coordinator.getValue(), emptySidebarCalendarContext)
  })

  it("loads the unchanged endpoint once for a practice member", async () => {
    const calls = []
    const expected = {
      practice: { id: "practice-a", name: "Practice A" },
      therapists: [{ id: "owner-a", label: "Taylor" }],
      canManageAvailability: true,
      pendingAppointmentRequestCount: 2,
      openWaitlistEntryCount: 1,
    }
    const coordinator = loadCoordinator(async (input) => {
      calls.push(input)
      return expected
    })

    await coordinator.adopt({ ownerKey: "owner-a", enabled: true })

    assert.equal(calls.length, 1)
    const [call] = calls
    assert.ok(call, "practice member adoption must issue one context request")
    assert.equal(call.ownerKey, "owner-a")
    assert.equal(call.signal.aborted, false)
    assert.deepEqual(coordinator.getValue(), expected)
  })

  it("bounds the default sidebar endpoint read through the shared JSON helper", async () => {
    const calls = []
    const expected = {
      ...emptySidebarCalendarContext,
      practice: { id: "practice-a", name: "Practice A" },
    }
    const coordinator = loadCoordinator(undefined, {
      initialEnabled: true,
      initialOwnerKey: "owner-a",
      fetchJsonWithTimeout: async (...args) => {
        calls.push(args)
        return { response: { ok: true }, json: expected }
      },
    })

    await coordinator.refresh()

    assert.equal(calls.length, 1)
    const [call] = calls
    assert.ok(call, "explicit refresh must issue one bounded endpoint request")
    assert.equal(call[0], "/api/calendar/sidebar-context")
    assert.equal(call[1].method, "GET")
    assert.equal(call[1].signal instanceof AbortSignal, true)
    assert.equal(call[2], 10_000)
    assert.deepEqual(coordinator.getValue(), expected)
  })

  it("rejects a padded route owner before loading sidebar context", async () => {
    const contextLoads = { count: 0 }
    const route = loadRoute({ user: { id: " owner-a " } }, contextLoads)

    const response = await route.GET()

    assert.equal(response.status, 401)
    assert.equal(contextLoads.count, 0)
    assert.equal(
      await sidebarCalendarContextModule.getSidebarCalendarContext(" owner-a "),
      emptySidebarCalendarContext,
    )
  })

  it("loads the canonical session owner once through the route boundary", async () => {
    const contextLoads = { count: 0 }
    const ownerCalls = []
    const route = loadRoute({ user: { id: "owner-a" } }, contextLoads, ownerCalls)

    const response = await route.GET()

    assert.deepEqual(response, { body: emptySidebarCalendarContext, status: 200 })
    assert.deepEqual(ownerCalls, ["owner-a"])
    assert.equal(contextLoads.count, 1)
  })

  it("fails closed when the sidebar endpoint returns a malformed payload", async () => {
    const coordinator = loadCoordinator(undefined, {
      initialEnabled: true,
      initialOwnerKey: "owner-a",
      fetchJsonWithTimeout: async () => ({
        response: { ok: true },
        json: {
          practice: { id: "practice-a", name: { unsafe: true } },
          therapists: "not-an-array",
          canManageAvailability: "yes",
          pendingAppointmentRequestCount: -1,
          openWaitlistEntryCount: 2.5,
        },
      }),
    })

    await coordinator.refresh()

    assert.equal(coordinator.getValue(), emptySidebarCalendarContext)
  })

  it("preserves a same-owner server initial context while its refresh is pending", async () => {
    const refreshRequest = deferred()
    const initialContext = {
      ...emptySidebarCalendarContext,
      practice: { id: "practice-a", name: "Server Practice" },
    }
    const coordinator = loadCoordinator(() => refreshRequest.promise, {
      initialContext,
      initialEnabled: true,
      initialOwnerKey: "owner-a",
    })

    const refresh = coordinator.adopt({ ownerKey: "owner-a", enabled: true })

    assert.deepEqual(coordinator.getValue(), initialContext)
    refreshRequest.resolve({
      ...initialContext,
      practice: { id: "practice-a", name: "Refreshed Practice" },
    })
    await refresh
    assert.equal(coordinator.getValue().practice?.name, "Refreshed Practice")
  })

  it("keeps the last context visible while an explicit refresh replaces it", async () => {
    const refreshRequest = deferred()
    const initialContext = {
      ...emptySidebarCalendarContext,
      practice: { id: "practice-a", name: "Initial Practice" },
    }
    const refreshedContext = {
      ...emptySidebarCalendarContext,
      practice: { id: "practice-a", name: "Refreshed Practice" },
    }
    let requests = 0
    const coordinator = loadCoordinator(async () => {
      requests += 1
      return requests === 1 ? initialContext : refreshRequest.promise
    })

    await coordinator.adopt({ ownerKey: "owner-a", enabled: true })
    const refresh = coordinator.refresh()

    assert.deepEqual(coordinator.getValue(), initialContext)
    refreshRequest.resolve(refreshedContext)
    await refresh
    assert.equal(requests, 2)
    assert.deepEqual(coordinator.getValue(), refreshedContext)
  })

  it("aborts owner A and exposes empty context until owner B resolves", async () => {
    const ownerARequest = deferred()
    const ownerBRequest = deferred()
    const calls = []
    const coordinator = loadCoordinator(({ ownerKey, signal }) => {
      calls.push({ ownerKey, signal })
      return ownerKey === "owner-a" ? ownerARequest.promise : ownerBRequest.promise
    })

    const staleRequest = coordinator.adopt({ ownerKey: "owner-a", enabled: true })
    const currentRequest = coordinator.adopt({ ownerKey: "owner-b", enabled: true })
    assert.equal(calls.length, 2)
    const [ownerACall] = calls
    assert.ok(ownerACall, "owner A must begin before owner B is adopted")
    assert.equal(ownerACall.signal.aborted, true)
    assert.equal(coordinator.getValue(), emptySidebarCalendarContext)

    ownerARequest.resolve({
      ...emptySidebarCalendarContext,
      practice: { id: "practice-a", name: "Stale Practice" },
    })
    await staleRequest
    assert.equal(coordinator.getValue(), emptySidebarCalendarContext)

    const ownerBContext = {
      ...emptySidebarCalendarContext,
      practice: { id: "practice-b", name: "Current Practice" },
    }
    ownerBRequest.resolve(ownerBContext)
    await currentRequest
    assert.deepEqual(coordinator.getValue(), ownerBContext)
  })

  it("adopts changed Provider ownership and disposes the active request on unmount", async () => {
    const requests = [deferred(), deferred()]
    const calls = []
    const harness = createSidebarProviderEffectHarness((...args) => {
      const request = requests[calls.length]
      calls.push(args)
      assert.ok(request, "Provider must not start an unexpected context request")
      return request.promise
    })
    let ownerACall
    let ownerBCall

    try {
      harness.render({ ownerKey: "owner-a", enabled: true })
      assert.equal(calls.length, 1)
      ownerACall = calls[0]
      assert.ok(ownerACall, "Provider mount must adopt owner A")
      assert.equal(ownerACall[1].signal.aborted, false)

      harness.render({ ownerKey: "owner-b", enabled: true })
      assert.equal(calls.length, 2)
      ownerBCall = calls[1]
      assert.ok(ownerBCall, "Provider prop change must adopt owner B")
      assert.equal(ownerACall[1].signal.aborted, true)
      assert.equal(ownerBCall[1].signal.aborted, false)
    } finally {
      harness.unmount()
      for (const request of requests) {
        request.resolve({ response: { ok: true }, json: emptySidebarCalendarContext })
      }
      await Promise.all(requests.map((request) => request.promise))
    }

    assert.equal(ownerBCall[1].signal.aborted, true)
  })

  it("exposes safe zero counts in the empty context", () => {
    assert.equal(emptySidebarCalendarContext.pendingAppointmentRequestCount, 0)
    assert.equal(emptySidebarCalendarContext.openWaitlistEntryCount, 0)
  })

  it("freezes the empty therapists collection", () => {
    assert.throws(() => {
      emptySidebarCalendarContext.therapists.push({ id: "therapist_1", label: "Therapist" })
    }, TypeError)
  })

  it("counts pending appointment requests and open waitlist entries without returning PHI", () => {
    const source = readFileSync(new URL("../lib/sidebar-calendar-context.js", import.meta.url), "utf8")

    assert.match(source, /prisma\.appointment\.count/)
    assert.match(source, /status: "REQUESTED"/)
    assert.match(source, /membership\.role === "THERAPIST" \? \{ therapistId: userId \} : \{\}/)
    assert.match(source, /prisma\.bookingWaitlistEntry\.count/)
    assert.match(source, /status: "OPEN"/)
    assert.doesNotMatch(source, /practiceClient:\s*true/)
    assert.doesNotMatch(source, /include:\s*\{\s*practiceClient/)
  })

  it("uses root practice membership as the only client enablement signal", () => {
    assert.match(layoutSource, /<SidebarCalendarProvider/)
    assert.match(layoutSource, /ownerKey=\{accountBootstrap\.ownerKey\}/)
    assert.match(layoutSource, /enabled=\{accountBootstrap\.hasPracticeMembership\}/)
    assert.doesNotMatch(layoutSource, /<SidebarCalendarProvider\s+enabled=\{Boolean\(user\)\}/)
    assert.match(providerSource, /createSidebarCalendarCoordinator/)
  })

  it("keeps the endpoint response PHI-minimized", () => {
    assert.doesNotMatch(routeSource, /practiceClient|clinical|soap|intake/i)
  })
})
