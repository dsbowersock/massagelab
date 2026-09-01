import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readFileSync } from "node:fs"
import * as sidebarCalendarContextModule from "../lib/sidebar-calendar-context.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

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

function loadRoute(session, downstreamReads) {
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
      getSidebarCalendarContext: async () => {
        downstreamReads.readiness += 1
        downstreamReads.preferences += 1
        downstreamReads.memberships += 1
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
    assert.equal(calls[0].ownerKey, "owner-a")
    assert.equal(calls[0].signal.aborted, false)
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
    assert.equal(calls[0][0], "/api/calendar/sidebar-context")
    assert.equal(calls[0][1].method, "GET")
    assert.equal(calls[0][1].signal instanceof AbortSignal, true)
    assert.equal(calls[0][2], 10_000)
    assert.deepEqual(coordinator.getValue(), expected)
  })

  it("rejects a padded route owner before readiness, preference, or membership reads", async () => {
    const downstreamReads = { readiness: 0, preferences: 0, memberships: 0 }
    const route = loadRoute({ user: { id: " owner-a " } }, downstreamReads)

    const response = await route.GET()

    assert.equal(response.status, 401)
    assert.deepEqual(downstreamReads, { readiness: 0, preferences: 0, memberships: 0 })
    assert.equal(
      await sidebarCalendarContextModule.getSidebarCalendarContext(" owner-a "),
      emptySidebarCalendarContext,
    )
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
    assert.equal(calls[0].signal.aborted, true)
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
    assert.match(providerSource, /new AbortController\(\)/)
    assert.match(providerSource, /fetchJsonWithTimeout[\s\S]*"\/api\/calendar\/sidebar-context"/)
    assert.match(providerSource, /fetchJsonWithTimeout[\s\S]*10_000/)
  })

  it("keeps the endpoint authenticated and its PHI-minimized response owner unchanged", () => {
    assert.match(routeSource, /getCurrentSession/)
    assert.match(routeSource, /isCanonicalSidebarCalendarOwnerId/)
    assert.match(routeSource, /status:\s*401/)
    assert.match(routeSource, /getSidebarCalendarContext\(ownerId\)/)
    assert.doesNotMatch(routeSource, /practiceClient|clinical|soap|intake/i)
  })
})
