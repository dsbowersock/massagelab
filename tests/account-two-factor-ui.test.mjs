import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

import {
  createCompiledModuleLoader,
  createElement,
  elementText,
  findElement,
  findElements,
  passThroughElement,
  renderFunctionComponents,
} from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const panelUrl = new URL("../app/account/security/two-factor-management-panel.tsx", import.meta.url)
const recoveryUrl = new URL("../lib/two-factor-management-recovery.ts", import.meta.url)

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body },
  }
}

async function createPanelHarness({
  twoFactorEnabled = false,
  hasPasswordCredential = true,
  googleLinked = false,
  googlePrimaryProofReady = false,
  fetchImpl = async () => jsonResponse(500, {}),
  signInImpl = async () => undefined,
  signOutImpl = async () => undefined,
} = {}) {
  assert.equal(existsSync(fileURLToPath(panelUrl)), true, "missing two-factor UI owner")
  assert.equal(existsSync(fileURLToPath(recoveryUrl)), true, "missing two-factor recovery owner")
  const [panelSource, recoverySource] = await Promise.all([
    readFile(panelUrl, "utf8"),
    readFile(recoveryUrl, "utf8"),
  ])
  const recovery = loadCompiledModule(recoverySource, "lib/two-factor-management-recovery.ui-test.ts")
  const hooks = createHookRuntime()
  const fetchCalls = []
  const signInCalls = []
  const signOutCalls = []
  const focusEvents = []
  let mountedRefs = new Set()
  let actionLock = null
  const props = {
    twoFactorEnabled,
    hasPasswordCredential,
    googleLinked,
    googlePrimaryProofReady,
    pendingAction: null,
    beginAction(action) {
      if (actionLock !== null) return false
      actionLock = action
      props.pendingAction = action
      return true
    },
    finishAction(action) {
      if (actionLock !== action) return
      actionLock = null
      props.pendingAction = null
    },
  }
  let renderDuringSignOut = null

  const compiled = loadCompiledModule(
    panelSource,
    "app/account/security/two-factor-management-panel.test.tsx",
    {
      react: hooks.react,
      "react/jsx-runtime": { Fragment: "fragment", jsx: createElement, jsxs: createElement },
      "next-auth/react": {
        async signIn(...args) {
          signInCalls.push(args)
          await signInImpl(...args)
        },
        async signOut(...args) {
          signOutCalls.push(args)
          renderDuringSignOut = elementText(render())
          await signOutImpl(...args)
        },
      },
      "next/image": { default: passThroughElement("image") },
      "@/components/forms/async-action-button": {
        AsyncActionButton(buttonProps) {
          return createElement("button", {
            ...buttonProps,
            "aria-busy": buttonProps.pending,
            disabled: buttonProps.pending || buttonProps.disabled,
            children: buttonProps.pending ? buttonProps.pendingLabel : buttonProps.idleLabel,
          })
        },
      },
      "@/components/ui/app-surface": {
        AppInset: passThroughElement("div"),
        AppSurface({ title, description, children, ...surfaceProps }) {
          return createElement("section", {
            ...surfaceProps,
            children: [title, description, children],
          })
        },
      },
      "@/components/ui/input": { Input: passThroughElement("input") },
      "@/components/ui/label": { Label: passThroughElement("label") },
      "@/lib/two-factor-management-recovery": recovery,
    },
  )

  async function trackedFetch(url, options) {
    fetchCalls.push({ url, options })
    return fetchImpl(url, options, fetchCalls.length)
  }

  const previousFetch = globalThis.fetch
  globalThis.fetch = trackedFetch

  function render() {
    hooks.startRender()
    const tree = renderFunctionComponents(compiled.TwoFactorManagementPanel(props))
    const nextMountedRefs = new Set()
    for (const element of findElements(tree, (candidate) => isObjectRef(candidate.props.ref))) {
      const ref = element.props.ref
      nextMountedRefs.add(ref)
      if (ref.current === null) {
        const target = element.props["data-two-factor-recovery"]
          ?? element.props["data-two-factor-surface"]
          ?? "unlabelled"
        ref.current = {
          focus(options) { focusEvents.push({ target, options }) },
        }
      }
    }
    for (const ref of mountedRefs) {
      if (!nextMountedRefs.has(ref)) ref.current = null
    }
    mountedRefs = nextMountedRefs
    hooks.finishRender()
    return tree
  }

  return {
    fetchCalls,
    signInCalls,
    signOutCalls,
    focusEvents,
    get renderDuringSignOut() { return renderDuringSignOut },
    render,
    restore() { globalThis.fetch = previousFetch },
  }
}

describe("recoverable two-factor management UI", () => {
  it("presents the four method states without offering unsafe setup", async () => {
    const passwordOnly = await createPanelHarness()
    const passwordTree = passwordOnly.render()
    assert.match(elementText(passwordTree), /Set up authenticator-app 2FA/)
    assert.ok(field(passwordTree, "setupPassword"))
    assert.ok(field(passwordTree, "setupConfirmed"))
    assert.equal(button(passwordTree, "Confirm with Google"), null)
    passwordOnly.restore()

    const linked = await createPanelHarness({ googleLinked: true })
    const linkedText = elementText(linked.render())
    assert.match(linkedText, /Use your password/)
    assert.match(linkedText, /Confirm with Google/)
    linked.restore()

    const googleOnly = await createPanelHarness({ hasPasswordCredential: false, googleLinked: true })
    const googleOnlyTree = googleOnly.render()
    assert.match(elementText(googleOnlyTree), /Add a password first/)
    assert.equal(actionForm(googleOnlyTree, "setup"), null)
    assert.equal(button(googleOnlyTree, "Confirm with Google"), null)
    googleOnly.restore()

    const legacyGoogle = await createPanelHarness({
      twoFactorEnabled: true,
      hasPasswordCredential: false,
      googleLinked: true,
    })
    const legacyTree = legacyGoogle.render()
    assert.equal(actionForm(legacyTree, "setup"), null)
    assert.ok(actionForm(legacyTree, "disable"))
    assert.ok(actionForm(legacyTree, "backup-codes"))
    assert.match(elementText(legacyTree), /Confirm with Google/)
    legacyGoogle.restore()

    const noPrimary = await createPanelHarness({
      twoFactorEnabled: true,
      hasPasswordCredential: false,
      googleLinked: false,
    })
    const noPrimaryTree = noPrimary.render()
    assert.match(elementText(noPrimaryTree), /full administrator.*recovery/i)
    assert.equal(actionForm(noPrimaryTree, "disable"), null)
    assert.equal(actionForm(noPrimaryTree, "backup-codes"), null)
    assert.equal(noPrimary.fetchCalls.length, 0)
    noPrimary.restore()
  })

  it("uses the exact display-only Google return without sending URL state as authorization", async () => {
    const harness = await createPanelHarness({
      googleLinked: true,
      googlePrimaryProofReady: true,
      fetchImpl: async () => jsonResponse(200, {
        code: "TWO_FACTOR_SETUP_READY",
        qrCode: "data:image/png;base64,qr-memory-only",
        manualCode: "MANUAL-MEMORY-ONLY",
      }),
    })
    let tree = harness.render()
    assert.match(elementText(tree), /Google confirmation is ready/)
    change(field(tree, "setupConfirmed"), true, "checked")
    tree = harness.render()
    await submit(actionForm(tree, "setup"))

    assert.equal(harness.fetchCalls.length, 1)
    assert.equal(harness.fetchCalls[0].url, "/api/account/security/totp/setup")
    assert.equal(harness.fetchCalls[0].options.headers["content-type"], "application/json")
    assert.deepEqual(JSON.parse(harness.fetchCalls[0].options.body), {
      proofMethod: "GOOGLE",
      confirmed: true,
    })
    assert.doesNotMatch(harness.fetchCalls[0].options.body, /reauth|two-factor/)
    harness.restore()
  })

  it("starts one bounded Google proof before the user chooses a two-factor operation", async () => {
    const harness = await createPanelHarness({
      googleLinked: true,
      fetchImpl: async () => jsonResponse(200, {
        ok: true,
        callbackUrl: "/account?tab=security",
      }),
    })
    const tree = harness.render()
    await button(tree, "Confirm with Google").props.onClick()

    assert.equal(harness.fetchCalls.length, 1)
    assert.equal(harness.fetchCalls[0].url, "/api/auth/google/intent")
    assert.equal(harness.fetchCalls[0].options.headers["content-type"], "application/json")
    assert.deepEqual(JSON.parse(harness.fetchCalls[0].options.body), { purpose: "LINK_GOOGLE" })
    assert.deepEqual(harness.signInCalls, [["google", { redirectTo: "/account?tab=security" }]])
    const redirectingTree = harness.render()
    const pendingButton = button(redirectingTree, "Redirecting to Google…")
    assert.ok(pendingButton)
    assert.equal(pendingButton.props.disabled, true)
    assert.doesNotMatch(elementText(redirectingTree), /Something went wrong\. Please try again\./)
    harness.restore()
  })

  it("keeps enrollment secrets and backup codes in memory until acknowledgment, then signs out", async () => {
    const responses = [
      jsonResponse(200, {
        code: "TWO_FACTOR_SETUP_READY",
        qrCode: "data:image/png;base64,qr-memory-only",
        manualCode: "MANUAL-MEMORY-ONLY",
      }),
      jsonResponse(200, {
        code: "TWO_FACTOR_ENABLED",
        backupCodes: ["backup-memory-one", "backup-memory-two"],
      }),
    ]
    const harness = await createPanelHarness({ fetchImpl: async () => responses.shift() })
    let tree = harness.render()
    change(field(tree, "setupPassword"), "password-proof")
    change(field(tree, "setupConfirmed"), true, "checked")
    tree = harness.render()
    await submit(actionForm(tree, "setup"))

    tree = harness.render()
    assert.match(elementText(tree), /MANUAL-MEMORY-ONLY/)
    change(field(tree, "enableCode"), "123456")
    change(field(tree, "enableConfirmed"), true, "checked")
    tree = harness.render()
    await submit(actionForm(tree, "enable"))

    assert.deepEqual(JSON.parse(harness.fetchCalls[0].options.body), {
      proofMethod: "PASSWORD",
      password: "password-proof",
      confirmed: true,
    })
    assert.deepEqual(JSON.parse(harness.fetchCalls[1].options.body), {
      code: "123456",
      confirmed: true,
    })
    assert.equal(harness.signOutCalls.length, 0)

    tree = harness.render()
    assert.match(elementText(tree), /backup-memory-one/)
    const acknowledge = button(tree, "I saved these codes; sign in again")
    assert.equal(acknowledge.props.disabled, true)
    change(field(tree, "backupCodesAcknowledged"), true, "checked")
    tree = harness.render()
    await button(tree, "I saved these codes; sign in again").props.onClick()

    assert.deepEqual(harness.signOutCalls, [[{
      redirectTo: "/login?security=two-factor-changed",
    }]])
    assert.match(harness.renderDuringSignOut, /backup-memory-one|backup-memory-two/)
    assert.doesNotMatch(elementText(harness.render()), /backup-memory-one|backup-memory-two/)
    harness.restore()
  })

  it("keeps rotated backup codes recoverable when sign-out fails", async () => {
    const harness = await createPanelHarness({
      twoFactorEnabled: true,
      fetchImpl: async () => jsonResponse(200, {
        code: "BACKUP_CODES_REGENERATED",
        backupCodes: ["retry-backup-one", "retry-backup-two"],
      }),
      signOutImpl: async () => { throw new Error("sign-out unavailable") },
    })
    let tree = harness.render()
    change(field(tree, "regeneratePassword"), "password-proof")
    change(field(tree, "regenerateTwoFactorCode"), "123456")
    change(field(tree, "regenerateConfirmed"), true, "checked")
    await submit(actionForm(harness.render(), "backup-codes"))
    tree = harness.render()
    change(field(tree, "backupCodesAcknowledged"), true, "checked")
    await button(harness.render(), "I saved these codes; sign in again").props.onClick()

    tree = harness.render()
    assert.match(elementText(tree), /retry-backup-one|retry-backup-two/)
    assert.ok(button(tree, "I saved these codes; sign in again"))
    assert.match(elementText(tree), /Something went wrong\. Please try again\./)
    assert.equal(harness.signOutCalls.length, 1)
    harness.restore()
  })

  it("clears QR and manual enrollment material when the server reports expiry", async () => {
    const responses = [
      jsonResponse(200, {
        code: "TWO_FACTOR_SETUP_READY",
        qrCode: "data:image/png;base64,expires",
        manualCode: "EXPIRES-MANUAL",
      }),
      jsonResponse(403, {
        code: "ENROLLMENT_EXPIRED",
        message: "private enrollment row detail",
      }),
    ]
    const harness = await createPanelHarness({ fetchImpl: async () => responses.shift() })
    let tree = harness.render()
    change(field(tree, "setupPassword"), "password-proof")
    change(field(tree, "setupConfirmed"), true, "checked")
    await submit(actionForm(harness.render(), "setup"))
    tree = harness.render()
    change(field(tree, "enableCode"), "123456")
    change(field(tree, "enableConfirmed"), true, "checked")
    await submit(actionForm(harness.render(), "enable"))

    const expiredText = elementText(harness.render())
    assert.doesNotMatch(expiredText, /EXPIRES-MANUAL|private enrollment row detail/)
    assert.match(expiredText, /setup expired/i)
    harness.restore()
  })

  it("moves focus from successful enablement to the mounted backup-code recovery inset", async () => {
    const responses = [
      jsonResponse(200, {
        code: "TWO_FACTOR_SETUP_READY",
        qrCode: "data:image/png;base64,focus-target",
        manualCode: "FOCUS-TARGET",
      }),
      jsonResponse(200, {
        code: "TWO_FACTOR_ENABLED",
        backupCodes: ["focus-backup-code"],
      }),
    ]
    const harness = await createPanelHarness({ fetchImpl: async () => responses.shift() })
    let tree = harness.render()
    change(field(tree, "setupPassword"), "password-proof")
    change(field(tree, "setupConfirmed"), true, "checked")
    await submit(actionForm(harness.render(), "setup"))

    tree = harness.render()
    harness.focusEvents.length = 0
    change(field(tree, "enableCode"), "123456")
    change(field(tree, "enableConfirmed"), true, "checked")
    await submit(actionForm(harness.render(), "enable"))
    tree = harness.render()

    const recovery = recoverySurface(tree, "backup-codes")
    assert.ok(recovery)
    assert.equal(recovery.props.tabIndex, -1)
    assert.deepEqual(harness.focusEvents.map(({ target }) => target), ["backup-codes"])
    harness.restore()
  })

  it("moves focus from successful disablement to the mounted reauthentication recovery inset", async () => {
    const harness = await createPanelHarness({
      twoFactorEnabled: true,
      fetchImpl: async () => jsonResponse(200, { code: "TWO_FACTOR_DISABLED" }),
    })
    let tree = harness.render()
    change(field(tree, "disablePassword"), "password-proof")
    change(field(tree, "disableTwoFactorCode"), "123456")
    change(field(tree, "disableConfirmed"), true, "checked")
    await submit(actionForm(harness.render(), "disable"))
    tree = harness.render()

    const recovery = recoverySurface(tree, "reauth")
    assert.ok(recovery)
    assert.equal(recovery.props.tabIndex, -1)
    assert.deepEqual(harness.focusEvents.map(({ target }) => target), ["reauth"])
    harness.restore()
  })

  it("keeps destructive proofs isolated and offers explicit re-sign-in transitions", async () => {
    const responses = [
      jsonResponse(200, { code: "BACKUP_CODES_REGENERATED", backupCodes: ["rotation-code"] }),
      jsonResponse(200, { code: "TWO_FACTOR_DISABLED" }),
    ]
    const harness = await createPanelHarness({
      twoFactorEnabled: true,
      googleLinked: true,
      googlePrimaryProofReady: true,
      fetchImpl: async () => responses.shift(),
    })
    let tree = harness.render()
    change(field(tree, "regenerateTwoFactorCode"), "rotation-factor")
    change(field(tree, "regenerateConfirmed"), true, "checked")
    await submit(actionForm(harness.render(), "backup-codes"))

    assert.deepEqual(JSON.parse(harness.fetchCalls[0].options.body), {
      proofMethod: "GOOGLE",
      twoFactorCode: "rotation-factor",
      confirmed: true,
    })
    assert.equal(harness.signOutCalls.length, 0)

    tree = harness.render()
    change(field(tree, "disableTwoFactorCode"), "disable-factor")
    change(field(tree, "disableConfirmed"), true, "checked")
    await submit(actionForm(harness.render(), "disable"))

    assert.deepEqual(JSON.parse(harness.fetchCalls[1].options.body), {
      proofMethod: "GOOGLE",
      twoFactorCode: "disable-factor",
      confirmed: true,
    })
    tree = harness.render()
    assert.match(elementText(tree), /Two-factor authentication is disabled.*sign in again/is)
    assert.equal(harness.signOutCalls.length, 0)
    await button(tree, "Sign in again").props.onClick()
    assert.deepEqual(harness.signOutCalls, [[{ redirectTo: "/login?security=two-factor-changed" }]])
    harness.restore()
  })

  it("requires password, current factor, and separate confirmation for password-only management", async () => {
    const harness = await createPanelHarness({
      twoFactorEnabled: true,
      fetchImpl: async () => jsonResponse(200, {
        code: "BACKUP_CODES_REGENERATED",
        backupCodes: ["password-rotation-code"],
      }),
    })
    let tree = harness.render()
    assert.ok(field(tree, "disablePassword"))
    assert.ok(field(tree, "disableTwoFactorCode"))
    assert.ok(field(tree, "disableConfirmed"))
    assert.ok(field(tree, "regeneratePassword"))
    assert.ok(field(tree, "regenerateTwoFactorCode"))
    assert.ok(field(tree, "regenerateConfirmed"))
    change(field(tree, "regeneratePassword"), "password-primary-proof")
    change(field(tree, "regenerateTwoFactorCode"), "current-factor-proof")
    change(field(tree, "regenerateConfirmed"), true, "checked")
    await submit(actionForm(harness.render(), "backup-codes"))

    assert.deepEqual(JSON.parse(harness.fetchCalls[0].options.body), {
      proofMethod: "PASSWORD",
      password: "password-primary-proof",
      twoFactorCode: "current-factor-proof",
      confirmed: true,
    })
    harness.restore()
  })

  it("locks rapid backup-code recovery sign-out and keeps its pending recovery surface observable", async () => {
    let resolveSignOut
    const signOutRequest = new Promise((resolve) => { resolveSignOut = resolve })
    const harness = await createPanelHarness({
      twoFactorEnabled: true,
      fetchImpl: async () => jsonResponse(200, {
        code: "BACKUP_CODES_REGENERATED",
        backupCodes: ["rapid-backup-code"],
      }),
      signOutImpl: async () => signOutRequest,
    })
    let tree = harness.render()
    change(field(tree, "regeneratePassword"), "password-proof")
    change(field(tree, "regenerateTwoFactorCode"), "123456")
    change(field(tree, "regenerateConfirmed"), true, "checked")
    await submit(actionForm(harness.render(), "backup-codes"))
    tree = harness.render()
    change(field(tree, "backupCodesAcknowledged"), true, "checked")
    tree = harness.render()

    const recoveryButton = button(tree, "I saved these codes; sign in again")
    const first = recoveryButton.props.onClick()
    const second = recoveryButton.props.onClick()
    tree = harness.render()

    const recovery = recoverySurface(tree, "backup-codes")
    assert.ok(recovery)
    assert.equal(recovery.props["aria-busy"], true)
    const pendingButton = button(tree, "Signing out…")
    assert.ok(pendingButton)
    assert.equal(pendingButton.props["aria-busy"], true)
    assert.equal(pendingButton.props.disabled, true)
    assert.equal(harness.signOutCalls.length, 1)

    resolveSignOut()
    await Promise.all([first, second])
    harness.restore()
  })

  it("locks rapid disable-recovery sign-out and exposes its pending state", async () => {
    let resolveSignOut
    const signOutRequest = new Promise((resolve) => { resolveSignOut = resolve })
    const harness = await createPanelHarness({
      twoFactorEnabled: true,
      fetchImpl: async () => jsonResponse(200, { code: "TWO_FACTOR_DISABLED" }),
      signOutImpl: async () => signOutRequest,
    })
    let tree = harness.render()
    change(field(tree, "disablePassword"), "password-proof")
    change(field(tree, "disableTwoFactorCode"), "123456")
    change(field(tree, "disableConfirmed"), true, "checked")
    await submit(actionForm(harness.render(), "disable"))
    tree = harness.render()

    const recoveryButton = button(tree, "Sign in again")
    const first = recoveryButton.props.onClick()
    const second = recoveryButton.props.onClick()
    tree = harness.render()

    const recovery = recoverySurface(tree, "reauth")
    assert.ok(recovery)
    assert.equal(recovery.props["aria-busy"], true)
    const pendingButton = button(tree, "Signing out…")
    assert.ok(pendingButton)
    assert.equal(pendingButton.props["aria-busy"], true)
    assert.equal(pendingButton.props.disabled, true)
    assert.equal(harness.signOutCalls.length, 1)

    resolveSignOut()
    await Promise.all([first, second])
    harness.restore()
  })

  it("locks double submit, announces pending and safe failures, and retains the action focus surface", async () => {
    let resolveRequest
    const request = new Promise((resolve) => { resolveRequest = resolve })
    const harness = await createPanelHarness({ fetchImpl: async () => request })
    let tree = harness.render()
    change(field(tree, "setupPassword"), "password-proof")
    change(field(tree, "setupConfirmed"), true, "checked")
    tree = harness.render()
    const surface = findElement(tree, (element) => element.props["data-two-factor-surface"] === "setup")
    let focusCalls = 0
    surface.props.ref.current = { focus() { focusCalls += 1 } }
    const form = actionForm(tree, "setup")
    const first = submit(form)
    const second = submit(form)

    tree = harness.render()
    assert.equal(actionForm(tree, "setup").props["aria-busy"], true)
    assert.match(elementText(tree), /Preparing two-factor setup…/)
    assert.equal(harness.fetchCalls.length, 1)
    resolveRequest(jsonResponse(409, {
      code: "CONFLICT",
      message: "private database row and provider detail",
    }))
    await Promise.all([first, second])

    tree = harness.render()
    const alert = findElement(tree, (element) => element.props.role === "alert")
    assert.ok(alert)
    assert.equal(alert.props["aria-live"], "assertive")
    assert.match(elementText(alert), /security settings changed/i)
    assert.doesNotMatch(elementText(tree), /private database row|provider detail/i)
    assert.equal(focusCalls, 1)
    harness.restore()
  })
})

function createHookRuntime() {
  const states = []
  const refs = []
  const effectDependencies = []
  const pendingEffects = []
  let stateCursor = 0
  let refCursor = 0
  let effectCursor = 0
  return {
    startRender() {
      stateCursor = 0
      refCursor = 0
      effectCursor = 0
      pendingEffects.length = 0
    },
    finishRender() {
      for (const effect of pendingEffects.splice(0)) effect()
    },
    react: {
      useEffect(effect, dependencies) {
        const index = effectCursor
        effectCursor += 1
        const previous = effectDependencies[index]
        const changed = !previous
          || previous.length !== dependencies.length
          || previous.some((value, dependencyIndex) => !Object.is(value, dependencies[dependencyIndex]))
        if (changed) {
          effectDependencies[index] = dependencies
          pendingEffects.push(effect)
        }
      },
      useState(initialValue) {
        const index = stateCursor
        stateCursor += 1
        if (!(index in states)) {
          states[index] = typeof initialValue === "function" ? initialValue() : initialValue
        }
        return [states[index], (value) => {
          states[index] = typeof value === "function" ? value(states[index]) : value
        }]
      },
      useRef(initialValue) {
        const index = refCursor
        refCursor += 1
        if (!(index in refs)) refs[index] = { current: initialValue }
        return refs[index]
      },
    },
  }
}

function field(tree, id) {
  return findElement(tree, (element) => element.props.id === id)
}

function button(tree, label) {
  return findElement(tree, (element) => (
    element.type === "button" && elementText(element) === label
  ))
}

function actionForm(tree, action) {
  return findElement(tree, (element) => (
    element.type === "form" && element.props["data-two-factor-action"] === action
  ))
}

function recoverySurface(tree, recovery) {
  return findElement(tree, (element) => element.props["data-two-factor-recovery"] === recovery)
}

function isObjectRef(value) {
  return Boolean(value) && typeof value === "object" && Object.hasOwn(value, "current")
}

function change(element, value, property = "value") {
  assert.ok(element)
  element.props.onChange({ target: { [property]: value } })
}

function submit(form) {
  assert.ok(form)
  return form.props.onSubmit({ preventDefault() {} })
}
