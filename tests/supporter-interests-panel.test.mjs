import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import ts from "typescript"

import { resolveSupporterRoadmapInterestsAfterSave } from "../lib/account-preferences.js"
import {
  normalizeSupporterRoadmapInterests,
  supporterRoadmapInterestOptions,
} from "../lib/onboarding-preferences.js"

const panelSource = await readFile(
  new URL("../app/account/supporter-interests-panel.tsx", import.meta.url),
  "utf8",
)
// The repository uses Node's test runner without a DOM test library. Transpile
// the real client component and provide only the hook/JSX boundary it needs so
// these tests exercise its async state transitions without duplicating them.
const compiledPanelSource = ts.transpileModule(panelSource, {
  compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: "supporter-interests-panel.tsx",
}).outputText

function createDeferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

function createJsonResponse(body, ok = true) {
  return {
    ok,
    async json() {
      return body
    },
  }
}

function createElement(type, props, key) {
  return {
    type,
    key: key ?? null,
    props: props ?? {},
  }
}

function findElement(tree, predicate) {
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const match = findElement(child, predicate)
      if (match) {
        return match
      }
    }
    return null
  }

  if (!tree || typeof tree !== "object") {
    return null
  }

  if (predicate(tree)) {
    return tree
  }

  return findElement(tree.props?.children, predicate)
}

function createPanelHarness(fetchImpl) {
  const originalFetch = globalThis.fetch
  const state = []
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

  function useEffect(effect) {
    const effectIndex = hookIndex
    hookIndex += 1

    if (!initializedEffects.has(effectIndex)) {
      initializedEffects.add(effectIndex)
      pendingEffects.push(effect)
    }
  }

  function SettingsSurface() {}
  function Checkbox() {}
  function Loader() {}
  function HeartHandshake() {}

  const compiledModule = { exports: {} }
  const loadPanel = new Function("require", "exports", "module", compiledPanelSource)
  loadPanel((specifier) => {
    switch (specifier) {
      case "react":
        return { useEffect, useState }
      case "react/jsx-runtime":
        return {
          Fragment: Symbol.for("supporter-interests-panel.fragment"),
          jsx: createElement,
          jsxs: createElement,
        }
      case "lucide-react":
        return { HeartHandshake }
      case "@/lib/onboarding-preferences":
        return {
          normalizeSupporterRoadmapInterests,
          supporterRoadmapInterestOptions,
        }
      case "@/lib/account-preferences":
        return { resolveSupporterRoadmapInterestsAfterSave }
      case "@/components/account/settings-surfaces":
        return { SettingsSurface }
      case "@/components/ui/checkbox":
        return { Checkbox }
      case "@/components/ui/loader":
        return { Loader }
      default:
        throw new Error(`Unexpected SupporterInterestsPanel import: ${specifier}`)
    }
  }, compiledModule.exports, compiledModule)

  const { SupporterInterestsPanel } = compiledModule.exports

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

function findStatus(tree) {
  return findElement(tree, (element) => element.props?.role === "status")
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
      await settleAsyncWork()
      harness.render()

      assert.equal(findInterestCheckbox(harness.getTree(), initialInterest).props.checked, true)
      assert.equal(findInterestCheckbox(harness.getTree(), addedInterest).props.checked, false)

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
      assert.equal(findStatus(harness.getTree()).props.children, "Roadmap interests saved.")
    } finally {
      harness.dispose()
    }
  })

  it("rolls a failed save back to the previously persisted interests", async () => {
    const persistedInterest = supporterRoadmapInterestOptions[0].id
    const failedInterest = supporterRoadmapInterestOptions[1].id
    const harness = createPanelHarness(async (_url, init = {}) => {
      if (init.method === "PUT") {
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
      assert.equal(
        findStatus(harness.getTree()).props.children,
        "Could not save roadmap interests. Please try again.",
      )
    } finally {
      harness.dispose()
    }
  })

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
