import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const hookSource = await readFile(
  new URL("../app/admin/users/[userId]/use-pending-action-render-nudge.ts", import.meta.url),
  "utf8",
).catch(() => "")
const ownerSource = await readFile(
  new URL("../app/admin/users/[userId]/temporary-access-form.tsx", import.meta.url),
  "utf8",
)
const creditOwnerSource = await readFile(
  new URL("../app/admin/users/[userId]/credit-action-form.tsx", import.meta.url),
  "utf8",
)
const roleOwnerSource = await readFile(
  new URL("../app/admin/users/[userId]/role-change-form.tsx", import.meta.url),
  "utf8",
)
const securityOwnerSource = await readFile(
  new URL("../app/admin/users/[userId]/security-action-forms.tsx", import.meta.url),
  "utf8",
)
const passwordResetOwnerSource = securityOwnerSource.match(
  /export function FreshPasswordResetForm[\s\S]*?(?=\nfunction RevokeSessionsForm)/,
)?.[0] ?? ""
const revokeSessionsOwnerSource = securityOwnerSource.match(
  /function RevokeSessionsForm[\s\S]*?(?=\nfunction TwoFactorResetForm)/,
)?.[0] ?? ""
const twoFactorResetOwnerSource = securityOwnerSource.match(
  /function TwoFactorResetForm[\s\S]*?(?=\nfunction ReasonFields)/,
)?.[0] ?? ""

describe("Admin pending-action render nudge ownership", () => {
  it("keeps one boolean-only compatibility hook in the temporary-access owner", () => {
    assert.match(hookSource, /export function usePendingActionRenderNudge\(pending: boolean\)/)
    assert.match(hookSource, /Next\.js issues #96233 and #97990/)
    assert.match(hookSource, /remove/i)
    assert.deepEqual(
      ownerSource.match(/usePendingActionRenderNudge\(grantPending \|\| revokePending\)/g),
      ["usePendingActionRenderNudge(grantPending || revokePending)"],
    )
  })

  it("keeps exactly one boolean-only compatibility hook invocation in the credit owner", () => {
    assert.deepEqual(
      creditOwnerSource.match(/usePendingActionRenderNudge\(isPending\)/g),
      ["usePendingActionRenderNudge(isPending)"],
    )
  })

  it("keeps exactly one boolean-only compatibility hook invocation in the role-change owner", () => {
    assert.deepEqual(
      roleOwnerSource.match(/usePendingActionRenderNudge\(isPending\)/g),
      ["usePendingActionRenderNudge(isPending)"],
    )
    assert.match(
      roleOwnerSource,
      /function RoleChangeForm[\s\S]*?useActionState\([\s\S]*?usePendingActionRenderNudge\(isPending\)/,
    )
  })

  it("keeps exactly one boolean-only compatibility hook invocation in the password-reset owner", () => {
    assert.deepEqual(
      passwordResetOwnerSource.match(/usePendingActionRenderNudge\(isPending\)/g),
      ["usePendingActionRenderNudge(isPending)"],
    )
    assert.match(
      passwordResetOwnerSource,
      /export function FreshPasswordResetForm[\s\S]*?useActionState\([\s\S]*?usePendingActionRenderNudge\(isPending\)/,
    )
  })

  it("keeps exactly one boolean-only compatibility hook invocation in the session-revocation owner", () => {
    assert.deepEqual(
      revokeSessionsOwnerSource.match(/usePendingActionRenderNudge\(isPending\)/g),
      ["usePendingActionRenderNudge(isPending)"],
    )
    assert.match(
      revokeSessionsOwnerSource,
      /function RevokeSessionsForm[\s\S]*?useActionState\([\s\S]*?usePendingActionRenderNudge\(isPending\)/,
    )
  })

  it("keeps exactly one boolean-only compatibility hook invocation in the two-factor-reset owner", () => {
    assert.deepEqual(
      twoFactorResetOwnerSource.match(/usePendingActionRenderNudge\(isPending\)/g),
      ["usePendingActionRenderNudge(isPending)"],
    )
    assert.match(
      twoFactorResetOwnerSource,
      /function TwoFactorResetForm[\s\S]*?useActionState\([\s\S]*?usePendingActionRenderNudge\(isPending\)/,
    )
  })

  it("keeps the compatibility hook limited to the three confirmed security owners", () => {
    assert.deepEqual(
      securityOwnerSource.match(/usePendingActionRenderNudge\(isPending\)/g),
      [
        "usePendingActionRenderNudge(isPending)",
        "usePendingActionRenderNudge(isPending)",
        "usePendingActionRenderNudge(isPending)",
      ],
    )
  })
})

// Source ownership checks above remain active even when this local compiler
// cannot load the hook; only the executable behavior cases are then skipped.
const behaviorDescribe = hookSource ? describe : describe.skip
behaviorDescribe("Admin pending-action render nudge behavior", () => {
  it("schedules nothing while pending is false", () => {
    const harness = createHookHarness()
    try {
      harness.render(false)
      assert.equal(harness.intervalCount(), 0)
      assert.equal(harness.timeoutCount(), 0)
      assert.equal(harness.revision(), 0)
    } finally {
      harness.dispose()
    }
  })

  it("schedules one named-cadence interval and fixed cap whose ticks update only local revision", () => {
    const harness = createHookHarness()
    try {
      harness.render(true)
      assert.deepEqual(harness.intervalDelays(), [300])
      assert.deepEqual(harness.timeoutDelays(), [30_000])
      harness.tickIntervals()
      assert.equal(harness.revision(), 1)
      assert.equal(harness.intervalCount(), 1)
      assert.equal(harness.timeoutCount(), 1)
    } finally {
      harness.dispose()
    }
  })

  it("does not stack timers when rerendered while pending remains true", () => {
    const harness = createHookHarness()
    try {
      harness.render(true)
      harness.render(true)
      assert.equal(harness.intervalCount(), 1)
      assert.equal(harness.timeoutCount(), 1)
    } finally {
      harness.dispose()
    }
  })

  it("cleans interval and cap on settle with no post-cleanup tick", () => {
    const harness = createHookHarness()
    try {
      harness.render(true)
      harness.render(false)
      assert.equal(harness.intervalCount(), 0)
      assert.equal(harness.timeoutCount(), 0)
      harness.tickIntervals()
      assert.equal(harness.revision(), 0)
    } finally {
      harness.dispose()
    }
  })

  it("cleans interval and cap on unmount with no post-cleanup tick", () => {
    const harness = createHookHarness()
    try {
      harness.render(true)
      harness.unmount()
      assert.equal(harness.intervalCount(), 0)
      assert.equal(harness.timeoutCount(), 0)
      harness.tickIntervals()
      assert.equal(harness.revision(), 0)
    } finally {
      harness.dispose()
    }
  })

  it("cleans interval and cap at the fixed cap with no later tick", () => {
    const harness = createHookHarness()
    try {
      harness.render(true)
      harness.fireTimeouts()
      assert.equal(harness.intervalCount(), 0)
      assert.equal(harness.timeoutCount(), 0)
      harness.tickIntervals()
      assert.equal(harness.revision(), 0)
    } finally {
      harness.dispose()
    }
  })
})

function createHookHarness() {
  let nextTimerId = 1
  let revision = 0
  let effectCleanup
  let effectDependencies
  let pendingEffect
  const intervals = new Map()
  const timeouts = new Map()
  const intervalSchedule = []
  const timeoutSchedule = []
  const originalTimers = {
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  }

  globalThis.setInterval = ((callback, delayMs) => {
    const id = nextTimerId++
    intervals.set(id, callback)
    intervalSchedule.push(delayMs)
    return id
  })
  globalThis.clearInterval = ((id) => {
    intervals.delete(id)
  })
  globalThis.setTimeout = ((callback, delayMs) => {
    const id = nextTimerId++
    timeouts.set(id, callback)
    timeoutSchedule.push(delayMs)
    return id
  })
  globalThis.clearTimeout = ((id) => {
    timeouts.delete(id)
  })

  const react = {
    useReducer(reducer, initialValue) {
      revision = revision ?? initialValue
      return [revision, () => {
        revision = reducer(revision)
      }]
    },
    useEffect(effect, dependencies) {
      pendingEffect = { effect, dependencies }
    },
  }
  const hookExports = loadCompiledModule(
    hookSource,
    "app/admin/users/[userId]/use-pending-action-render-nudge.test.ts",
    { react },
  )
  const renderPendingActionNudge = hookExports.usePendingActionRenderNudge

  function render(pending) {
    pendingEffect = undefined
    renderPendingActionNudge(pending)
    assert.ok(pendingEffect, "the hook must register one effect")
    const nextDependencies = pendingEffect.dependencies
    const changed = !effectDependencies
      || nextDependencies.length !== effectDependencies.length
      || nextDependencies.some((value, index) => value !== effectDependencies[index])
    // Retaining the existing effect and timers for unchanged dependencies
    // mirrors React's useEffect dependency-array behavior.
    if (!changed) return
    effectCleanup?.()
    effectCleanup = pendingEffect.effect()
    effectDependencies = [...nextDependencies]
  }

  function unmount() {
    effectCleanup?.()
    effectCleanup = undefined
    effectDependencies = undefined
  }

  function restoreTimers() {
    globalThis.setInterval = originalTimers.setInterval
    globalThis.clearInterval = originalTimers.clearInterval
    globalThis.setTimeout = originalTimers.setTimeout
    globalThis.clearTimeout = originalTimers.clearTimeout
  }

  return {
    render,
    unmount,
    intervalCount: () => intervals.size,
    timeoutCount: () => timeouts.size,
    intervalDelays: () => [...intervalSchedule],
    timeoutDelays: () => [...timeoutSchedule],
    revision: () => revision,
    tickIntervals: () => {
      for (const callback of [...intervals.values()]) callback()
    },
    fireTimeouts: () => {
      for (const [id, callback] of [...timeouts.entries()]) {
        timeouts.delete(id)
        callback()
      }
    },
    dispose: () => {
      unmount()
      restoreTimers()
    },
  }
}
