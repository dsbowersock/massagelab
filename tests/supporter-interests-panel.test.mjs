import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { resolveSupporterRoadmapInterestsAfterSave } from "../lib/account-preferences.js"
import {
  normalizeSupporterRoadmapInterests,
  supporterRoadmapInterestOptions,
} from "../lib/onboarding-preferences.js"
import {
  createCompiledModuleLoader,
  createElement,
  findElement,
} from "./helpers/compiled-module.mjs"

const panelSource = await readFile(
  new URL("../app/account/supporter-interests-panel.tsx", import.meta.url),
  "utf8",
)
// The repository uses Node's test runner without a DOM test library. Load the
// real client component with only the hook/JSX boundary it needs so these tests
// exercise its async state transitions without duplicating them.
const loadCompiledModule = createCompiledModuleLoader(import.meta.url)

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

function createJsonResponse(body, ok = true) {
  return {
    ok,
    async json() {
      return body
    },
  }
}

/**
 * Executes the real panel with a deliberately small hook/JSX model. It
 * supports state, refs, stable callbacks, and the panel's single mount effect;
 * it does not emulate React scheduling, DOM behavior, or changing dependencies.
 */
function createPanelHarness(fetchImpl) {
  const originalFetch = globalThis.fetch
  const state = []
  const refs = []
  const callbacks = []
  const initializedEffects = new Set()
  const pendingEffects = []
  const cleanups = []
  let hookIndex = 0
  let mounted = false
  let tree = null
  let updatesAfterUnmount = 0

  function useState(initialValue) {
    const stateIndex = hookIndex
    hookIndex += 1

    if (!(stateIndex in state)) {
      state[stateIndex] = typeof initialValue === "function"
        ? initialValue()
        : initialValue
    }

    function setState(nextValue) {
      if (!mounted) {
        updatesAfterUnmount += 1
        return
      }

      state[stateIndex] = typeof nextValue === "function"
        ? nextValue(state[stateIndex])
        : nextValue
    }

    return [state[stateIndex], setState]
  }

  function useRef(initialValue) {
    const refIndex = hookIndex
    hookIndex += 1

    if (!(refIndex in refs)) {
      refs[refIndex] = { current: initialValue }
    }
    return refs[refIndex]
  }

  function useCallback(callback, dependencies) {
    const callbackIndex = hookIndex
    hookIndex += 1

    if (!Array.isArray(dependencies)) {
      throw new Error(`SupporterInterestsPanel callback ${callbackIndex} must declare dependencies`)
    }
    if (!(callbackIndex in callbacks)) {
      callbacks[callbackIndex] = {
        callback,
        dependencies: [...dependencies],
      }
    } else {
      const priorDependencies = callbacks[callbackIndex].dependencies
      const dependenciesChanged = priorDependencies.length !== dependencies.length
        || dependencies.some((dependency, index) => !Object.is(dependency, priorDependencies[index]))
      if (dependenciesChanged) {
        throw new Error(
          `SupporterInterestsPanel callback ${callbackIndex} dependencies changed; extend the harness before relying on memoization`,
        )
      }
    }
    return callbacks[callbackIndex].callback
  }

  /**
   * Schedules each effect slot once. The callback model above fails loudly if
   * its dependency arrays change, keeping this narrow effect assumption honest.
   */
  function useEffect(effect) {
    const effectIndex = hookIndex
    hookIndex += 1

    if (!initializedEffects.has(effectIndex)) {
      initializedEffects.add(effectIndex)
      pendingEffects.push(effect)
    }
  }

  function SettingsSurface() {}
  function Button() {}
  function Checkbox() {}
  function Loader() {}
  function HeartHandshake() {}

  const { SupporterInterestsPanel } = loadCompiledModule(
    panelSource,
    "supporter-interests-panel.tsx",
    {
      react: { useCallback, useEffect, useRef, useState },
      "react/jsx-runtime": {
        Fragment: Symbol.for("supporter-interests-panel.fragment"),
        jsx: createElement,
        jsxs: createElement,
      },
      "lucide-react": { HeartHandshake },
      "@/lib/onboarding-preferences": {
        normalizeSupporterRoadmapInterests,
        supporterRoadmapInterestOptions,
      },
      "@/lib/account-preferences": { resolveSupporterRoadmapInterestsAfterSave },
      "@/components/account/settings-surfaces": { SettingsSurface },
      "@/components/ui/button": { Button },
      "@/components/ui/checkbox": { Checkbox },
      "@/components/ui/loader": { Loader },
    },
  )

  function render() {
    hookIndex = 0
    tree = SupporterInterestsPanel()
    return tree
  }

  function mount() {
    globalThis.fetch = fetchImpl
    mounted = true
    render()

    for (const effect of pendingEffects.splice(0)) {
      const cleanup = effect()
      if (typeof cleanup === "function") {
        cleanups.push(cleanup)
      }
    }

    return tree
  }

  function unmount() {
    if (!mounted) {
      return
    }

    mounted = false
    for (const cleanup of cleanups.splice(0)) {
      cleanup()
    }
  }

  function dispose() {
    unmount()
    globalThis.fetch = originalFetch
  }

  return {
    dispose,
    getTree: () => tree,
    getUpdatesAfterUnmount: () => updatesAfterUnmount,
    mount,
    render,
    unmount,
  }
}

function findInterestCheckbox(tree, interestId) {
  return findElement(
    tree,
    (element) => element.props?.id === `supporter-roadmap-interest-${interestId}`,
  )
}

function findLiveRegion(tree) {
  return findElement(
    tree,
    (element) => element.props?.["aria-live"] != null,
  )
}

function liveRegionMessage(tree) {
  const message = findElement(
    findLiveRegion(tree),
    (element) => element.type === "p",
  )
  return message?.props.children ?? ""
}

function assertLiveRegion(tree, politeness) {
  const region = findLiveRegion(tree)
  assert.ok(region)
  assert.equal(region.props.role, undefined)
  assert.equal(region.props["aria-live"], politeness)
  assert.equal(region.props["aria-atomic"], "true")
}

function findRetryButton(tree) {
  return findElement(
    tree,
    (element) => (
      element.props?.children === "Retry"
      && typeof element.props?.onClick === "function"
    ),
  )
}

async function settleAsyncWork() {
  await new Promise((resolve) => setImmediate(resolve))
}

describe("SupporterInterestsPanel", () => {
  it("persists a successful interest toggle and keeps the saved selection", async () => {
    const initialInterest = supporterRoadmapInterestOptions[0].id
    const addedInterest = supporterRoadmapInterestOptions[1].id
    const putBodies = []
    const harness = createPanelHarness(async (_url, init = {}) => {
      if (init.method !== "PUT") {
        return createJsonResponse({
          appSettings: {
            supporterRoadmapInterests: [initialInterest],
          },
        })
      }

      const body = JSON.parse(init.body)
      putBodies.push(body)
      return createJsonResponse(body)
    })

    try {
      harness.mount()
      assertLiveRegion(harness.getTree(), "polite")
      assert.equal(liveRegionMessage(harness.getTree()), "")
      await settleAsyncWork()
      harness.render()

      assert.equal(findInterestCheckbox(harness.getTree(), initialInterest).props.checked, true)
      assert.equal(findInterestCheckbox(harness.getTree(), addedInterest).props.checked, false)
      assert.equal(findInterestCheckbox(harness.getTree(), addedInterest).props.disabled, false)

      findInterestCheckbox(harness.getTree(), addedInterest).props.onCheckedChange(true)
      harness.render()

      assert.equal(findInterestCheckbox(harness.getTree(), addedInterest).props.checked, true)
      assert.equal(findInterestCheckbox(harness.getTree(), addedInterest).props.disabled, true)

      await settleAsyncWork()
      harness.render()

      assert.deepEqual(putBodies, [{
        appSettings: {
          supporterRoadmapInterests: [initialInterest, addedInterest],
        },
      }])
      assert.equal(findInterestCheckbox(harness.getTree(), initialInterest).props.checked, true)
      assert.equal(findInterestCheckbox(harness.getTree(), addedInterest).props.checked, true)
      assert.equal(findInterestCheckbox(harness.getTree(), addedInterest).props.disabled, false)
      assertLiveRegion(harness.getTree(), "polite")
      assert.equal(liveRegionMessage(harness.getTree()), "Roadmap interests saved.")
    } finally {
      harness.dispose()
    }
  })

  it("keeps the submitted interests when a successful save response is not an array", async () => {
    const initialInterest = supporterRoadmapInterestOptions[0].id
    const addedInterest = supporterRoadmapInterestOptions[1].id
    const harness = createPanelHarness(async (_url, init = {}) => {
      if (init.method !== "PUT") {
        return createJsonResponse({
          appSettings: {
            supporterRoadmapInterests: [initialInterest],
          },
        })
      }

      return createJsonResponse({
        appSettings: {
          supporterRoadmapInterests: "invalid-response-shape",
        },
      })
    })

    try {
      harness.mount()
      await settleAsyncWork()
      harness.render()

      findInterestCheckbox(harness.getTree(), addedInterest).props.onCheckedChange(true)
      harness.render()
      await settleAsyncWork()
      harness.render()

      assert.equal(findInterestCheckbox(harness.getTree(), initialInterest).props.checked, true)
      assert.equal(findInterestCheckbox(harness.getTree(), addedInterest).props.checked, true)
      assert.equal(liveRegionMessage(harness.getTree()), "Roadmap interests saved.")
    } finally {
      harness.dispose()
    }
  })

  it("ignores an older save response that resolves after the latest selection", async () => {
    const initialInterest = supporterRoadmapInterestOptions[0].id
    const firstAddedInterest = supporterRoadmapInterestOptions[1].id
    const latestAddedInterest = supporterRoadmapInterestOptions[2].id
    const firstSave = createDeferred()
    const latestSave = createDeferred()
    const pendingSaves = [firstSave, latestSave]
    const harness = createPanelHarness(async (_url, init = {}) => {
      if (init.method !== "PUT") {
        return createJsonResponse({
          appSettings: {
            supporterRoadmapInterests: [initialInterest],
          },
        })
      }

      return pendingSaves.shift().promise
    })

    try {
      harness.mount()
      await settleAsyncWork()
      harness.render()

      findInterestCheckbox(harness.getTree(), firstAddedInterest).props.onCheckedChange(true)
      harness.render()
      findInterestCheckbox(harness.getTree(), latestAddedInterest).props.onCheckedChange(true)
      harness.render()

      latestSave.resolve(createJsonResponse({
        appSettings: {
          supporterRoadmapInterests: [
            initialInterest,
            firstAddedInterest,
            latestAddedInterest,
          ],
        },
      }))
      await settleAsyncWork()
      harness.render()

      assert.equal(findInterestCheckbox(harness.getTree(), firstAddedInterest).props.checked, true)
      assert.equal(findInterestCheckbox(harness.getTree(), latestAddedInterest).props.checked, true)
      assert.equal(liveRegionMessage(harness.getTree()), "Roadmap interests saved.")

      firstSave.resolve(createJsonResponse({
        appSettings: {
          supporterRoadmapInterests: [initialInterest, firstAddedInterest],
        },
      }))
      await settleAsyncWork()
      harness.render()

      assert.equal(findInterestCheckbox(harness.getTree(), firstAddedInterest).props.checked, true)
      assert.equal(findInterestCheckbox(harness.getTree(), latestAddedInterest).props.checked, true)
      assert.equal(liveRegionMessage(harness.getTree()), "Roadmap interests saved.")
    } finally {
      harness.dispose()
    }
  })

  it("ignores an older save failure after a newer save succeeds", async (context) => {
    const initialInterest = supporterRoadmapInterestOptions[0].id
    const firstAddedInterest = supporterRoadmapInterestOptions[1].id
    const latestAddedInterest = supporterRoadmapInterestOptions[2].id
    const staleFailure = new Error("older save failed")
    const logged = []
    context.mock.method(console, "error", (...args) => logged.push(args))
    const firstSave = createDeferred()
    const latestSave = createDeferred()
    const pendingSaves = [firstSave, latestSave]
    const harness = createPanelHarness(async (_url, init = {}) => {
      if (init.method !== "PUT") {
        return createJsonResponse({
          appSettings: {
            supporterRoadmapInterests: [initialInterest],
          },
        })
      }

      return pendingSaves.shift().promise
    })

    try {
      harness.mount()
      await settleAsyncWork()
      harness.render()

      findInterestCheckbox(harness.getTree(), firstAddedInterest).props.onCheckedChange(true)
      harness.render()
      findInterestCheckbox(harness.getTree(), latestAddedInterest).props.onCheckedChange(true)
      harness.render()

      latestSave.resolve(createJsonResponse({
        appSettings: {
          supporterRoadmapInterests: [
            initialInterest,
            firstAddedInterest,
            latestAddedInterest,
          ],
        },
      }))
      await settleAsyncWork()
      harness.render()
      firstSave.reject(staleFailure)
      await settleAsyncWork()
      harness.render()

      assert.equal(findInterestCheckbox(harness.getTree(), firstAddedInterest).props.checked, true)
      assert.equal(findInterestCheckbox(harness.getTree(), latestAddedInterest).props.checked, true)
      assert.equal(liveRegionMessage(harness.getTree()), "Roadmap interests saved.")
      assert.deepEqual(logged, [])
    } finally {
      harness.dispose()
    }
  })

  for (const failureMode of ["network rejection", "HTTP non-OK response"]) {
    it(`rolls a ${failureMode} save back to the previously persisted interests`, async (context) => {
      const persistedInterest = supporterRoadmapInterestOptions[0].id
      const failedInterest = supporterRoadmapInterestOptions[1].id
      const requestError = new Error("save request failed")
      const logged = []
      context.mock.method(console, "error", (...args) => logged.push(args))
      const harness = createPanelHarness(async (_url, init = {}) => {
        if (init.method === "PUT") {
          if (failureMode === "network rejection") {
            throw requestError
          }
          return createJsonResponse({}, false)
        }

        return createJsonResponse({
          appSettings: {
            supporterRoadmapInterests: [persistedInterest],
          },
        })
      })

      try {
        harness.mount()
        await settleAsyncWork()
        harness.render()

        findInterestCheckbox(harness.getTree(), failedInterest).props.onCheckedChange(true)
        harness.render()
        assert.equal(findInterestCheckbox(harness.getTree(), failedInterest).props.checked, true)

        await settleAsyncWork()
        harness.render()

        assert.equal(findInterestCheckbox(harness.getTree(), persistedInterest).props.checked, true)
        assert.equal(findInterestCheckbox(harness.getTree(), failedInterest).props.checked, false)
        assertLiveRegion(harness.getTree(), "assertive")
        assert.equal(
          liveRegionMessage(harness.getTree()),
          "Could not save roadmap interests. Please try again.",
        )
        assert.equal(logged.length, 1)
        assert.equal(logged[0][0], "SupporterInterestsPanel failed to save roadmap interests")
        if (failureMode === "network rejection") {
          assert.equal(logged[0][1], requestError)
        } else {
          assert.equal(logged[0][1] instanceof Error, true)
          assert.equal(logged[0][1].message, "Unable to save supporter roadmap interests")
        }
      } finally {
        harness.dispose()
      }
    })
  }

  for (const failureMode of ["network rejection", "HTTP non-OK response"]) {
    it(`retries a ${failureMode} initial load and keeps interests disabled until retry succeeds`, async (context) => {
      const requestError = new Error("load request failed")
      const loadedInterest = supporterRoadmapInterestOptions[0].id
      let loadAttempts = 0
      const logged = []
      context.mock.method(console, "error", (...args) => logged.push(args))
      const harness = createPanelHarness(async () => {
        loadAttempts += 1
        if (loadAttempts === 1) {
          if (failureMode === "network rejection") {
            throw requestError
          }
          return createJsonResponse({}, false)
        }
        return createJsonResponse({
          appSettings: {
            supporterRoadmapInterests: [loadedInterest],
          },
        })
      })

      try {
        harness.mount()
        await settleAsyncWork()
        harness.render()

        assertLiveRegion(harness.getTree(), "assertive")
        assert.equal(
          liveRegionMessage(harness.getTree()),
          "Could not load roadmap interests. Please try again.",
        )
        assert.equal(
          findInterestCheckbox(harness.getTree(), loadedInterest).props.disabled,
          true,
        )
        assert.equal(findRetryButton(harness.getTree()).props.disabled, false)
        assert.equal(logged.length, 1)
        assert.equal(logged[0][0], "SupporterInterestsPanel failed to load roadmap interests")
        if (failureMode === "network rejection") {
          assert.equal(logged[0][1], requestError)
        } else {
          assert.equal(logged[0][1] instanceof Error, true)
          assert.equal(logged[0][1].message, "Unable to load supporter roadmap interests")
        }

        findRetryButton(harness.getTree()).props.onClick()
        harness.render()
        assert.equal(findInterestCheckbox(harness.getTree(), loadedInterest).props.disabled, true)
        assert.equal(findRetryButton(harness.getTree()), null)

        await settleAsyncWork()
        harness.render()

        assert.equal(loadAttempts, 2)
        assert.equal(findInterestCheckbox(harness.getTree(), loadedInterest).props.checked, true)
        assert.equal(findInterestCheckbox(harness.getTree(), loadedInterest).props.disabled, false)
        assert.equal(liveRegionMessage(harness.getTree()), "")
      } finally {
        harness.dispose()
      }
    })
  }

  it("does not update state when the initial preferences finish after unmount", async () => {
    const preferences = createDeferred()
    let jsonCalls = 0
    const harness = createPanelHarness(async () => ({
      ok: true,
      json() {
        jsonCalls += 1
        return preferences.promise
      },
    }))

    try {
      harness.mount()
      await settleAsyncWork()
      assert.equal(jsonCalls, 1)

      harness.unmount()
      preferences.resolve({
        appSettings: {
          supporterRoadmapInterests: [supporterRoadmapInterestOptions[0].id],
        },
      })
      await settleAsyncWork()

      assert.equal(harness.getUpdatesAfterUnmount(), 0)
    } finally {
      harness.dispose()
    }
  })
})
