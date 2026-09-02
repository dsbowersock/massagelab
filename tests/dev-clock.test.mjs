import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import ts from "typescript"

/** Requires the keyed account bootstrap JSX owner to structurally contain Music. */
function assertAccountBootstrapOwnsMusic(layoutSource) {
  const sourceFile = ts.createSourceFile(
    "app/layout.tsx",
    layoutSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const accountProviders = []
  function collectAccountProviders(node) {
    const tagName = ts.isJsxElement(node)
      ? node.openingElement.tagName.getText(sourceFile)
      : ts.isJsxSelfClosingElement(node)
        ? node.tagName.getText(sourceFile)
        : null
    if (tagName === "AccountShellBootstrapProvider") accountProviders.push(node)
    ts.forEachChild(node, collectAccountProviders)
  }
  collectAccountProviders(sourceFile)

  assert.equal(accountProviders.length, 1, "layout must have exactly one AccountShellBootstrapProvider")
  const accountProvider = accountProviders[0]
  assert.ok(ts.isJsxElement(accountProvider), "AccountShellBootstrapProvider must own nested JSX")
  const keyAttribute = accountProvider.openingElement.attributes.properties.find((attribute) => (
    ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === "key"
  ))
  assert.ok(
    keyAttribute
      && ts.isJsxAttribute(keyAttribute)
      && keyAttribute.initializer
      && ts.isJsxExpression(keyAttribute.initializer)
      && keyAttribute.initializer.expression,
    "AccountShellBootstrapProvider must retain its owner-key expression",
  )
  assert.equal(
    keyAttribute.initializer.expression.getText(sourceFile),
    'accountBootstrap.ownerKey ?? "anonymous"',
  )

  const musicProviders = []
  function collectNestedMusic(node) {
    const tagName = ts.isJsxElement(node)
      ? node.openingElement.tagName.getText(sourceFile)
      : ts.isJsxSelfClosingElement(node)
        ? node.tagName.getText(sourceFile)
        : null
    if (tagName === "MusicProvider") musicProviders.push(node)
    ts.forEachChild(node, collectNestedMusic)
  }
  for (const child of accountProvider.children) collectNestedMusic(child)
  assert.equal(musicProviders.length, 1, "AccountShellBootstrapProvider must contain one MusicProvider")
}

describe("development Clock review route", () => {
  it("is development-only and renders the production Clock implementation", async () => {
    const source = await readFile(
      new URL("../app/dev/clock/page.tsx", import.meta.url),
      "utf8",
    )

    assert.match(source, /process\.env\.NODE_ENV === "production"[\s\S]*notFound\(\)/)
    assert.match(source, /<ChimerPage developmentSubscriberReview \/>/)
    assert.doesNotMatch(source, /MovingBackground|RunningTimer|BackgroundHost/)
  })

  it("uses paid feature keys without account sync and isolates review settings", async () => {
    const source = await readFile(
      new URL("../app/chimer/page.tsx", import.meta.url),
      "utf8",
    )

    assert.match(
      source,
      /const DEV_CLOCK_FEATURE_KEYS = \[\s*FEATURE_KEYS\.premiumBackgrounds,\s*\]/,
    )
    assert.match(source, /const DEV_CLOCK_STORAGE_KEY = "massagelab-dev-clock-settings"/)
    assert.match(
      source,
      /const immersiveContext = developmentSubscriberReview\s*\? "clock"/,
    )
    assert.match(
      source,
      /if \(developmentSubscriberReview\) \{[\s\S]*setCanSync\(false\)[\s\S]*setAccountSyncStatus\("synced"\)[\s\S]*\} else \{\s*requestAccountSync\(\)/,
    )
    assert.match(source, /localStorage\.setItem\(storageKey/)
  })

  it("keeps the retired custom-color contract out of runtime sources", async () => {
    const sources = await Promise.all([
      "../app/chimer/page.tsx",
      "../app/chimer/running-timer.tsx",
      "../app/account/page.tsx",
      "../components/sidebar/sidebar.tsx",
      "../auth.ts",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")))

    for (const source of sources) {
      assert.doesNotMatch(source, /chimerCustomColors|chimer_custom_colors|canUseChimerCustomColors|canUseCustomColors|canUseAccountColorControls/)
    }
  })

  it("uses the Clock shell and stays anonymous when local auth is unconfigured", async () => {
    const [authSource, layoutSource, musicProviderSource, wrapperSource] = await Promise.all([
      readFile(new URL("../auth.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/providers/music-provider.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/layout-wrapper.tsx", import.meta.url), "utf8"),
    ])

    assert.match(
      authSource,
      /process\.env\.NODE_ENV !== "production" && !getAuthSecret\(\)[\s\S]*return Promise\.resolve\(null\)/,
    )
    assert.match(authSource, /return auth\(\)/)
    assertAccountBootstrapOwnsMusic(layoutSource)
    assert.doesNotMatch(layoutSource, /accountSyncEnabled/)
    assert.match(musicProviderSource, /useAccountShellBootstrap/)
    assert.match(
      musicProviderSource,
      /bootstrapStatus === "anonymous"[\s\S]*setAccountStatus\("anonymous"\)/,
    )
    assert.match(wrapperSource, /pathname === "\/dev\/clock"/)
  })

  it("resets stale Music transport when the account bootstrap owner changes", async () => {
    const musicProviderSource = await readFile(
      new URL("../components/providers/music-provider.tsx", import.meta.url),
      "utf8",
    )
    const ownerAdoptionAnchor = musicProviderSource.indexOf("if (!storageHydrated)")
    assert.notEqual(ownerAdoptionAnchor, -1, "Music provider owner-adoption anchor missing")
    const ownerAdoptionStart = musicProviderSource.lastIndexOf(
      "useEffect(() => {",
      ownerAdoptionAnchor,
    )
    const ownerAdoptionEnd = musicProviderSource.indexOf(
      "const retryVisualizerAccountSync",
      ownerAdoptionStart,
    )
    assert.ok(
      ownerAdoptionStart >= 0 && ownerAdoptionEnd > ownerAdoptionStart,
      "Music provider owner-adoption effect boundaries missing or reordered",
    )
    const ownerAdoptionSource = musicProviderSource.slice(ownerAdoptionStart, ownerAdoptionEnd)
    const ownerResetStart = ownerAdoptionSource.indexOf("if (ownerChanged) {")
    assert.notEqual(ownerResetStart, -1, "Music provider owner-reset block start missing")
    const ownerResetEnd = ownerAdoptionSource.indexOf(
      'if (bootstrapStatus === "anonymous"',
      ownerResetStart,
    )
    assert.ok(
      ownerResetStart >= 0 && ownerResetEnd > ownerResetStart,
      "Music provider owner-reset block boundaries missing or reordered",
    )
    const ownerResetSource = ownerAdoptionSource.slice(ownerResetStart, ownerResetEnd)
    assert.match(
      ownerAdoptionSource,
      /const ownerChanged = previousOwner\.ownerKey !== ownerKey\s*\|\| previousOwner\.syncEnabled !== syncEnabled/,
    )
    assert.match(ownerAdoptionSource, /adoptedAccountOwnerRef\.current = \{ ownerKey, syncEnabled \}/)
    assert.match(ownerResetSource, /accountIntentTracker\.clear\(\)/)
    assert.match(ownerResetSource, /accountRequestIdRef\.current \+= 1/)
    assert.match(ownerResetSource, /accountWritePendingRef\.current = null/)
  })

  it("skips Music preference persistence without a sync-enabled account owner", async () => {
    const musicProviderSource = await readFile(
      new URL("../components/providers/music-provider.tsx", import.meta.url),
      "utf8",
    )
    const persistPreferencesStart = musicProviderSource.indexOf(
      "const persistVisualizerAccountPreferences = useCallback(",
    )
    const mediaOwnershipAnchor = musicProviderSource.indexOf(
      "carrierEventBridgeRef.current = bridge",
      persistPreferencesStart,
    )
    assert.notEqual(mediaOwnershipAnchor, -1, "Music provider media-ownership effect anchor missing")
    const persistPreferencesEnd = musicProviderSource.lastIndexOf(
      "useEffect(() => {",
      mediaOwnershipAnchor,
    )
    assert.ok(
      persistPreferencesStart >= 0 && persistPreferencesEnd > persistPreferencesStart,
      "Music provider visualizer-persistence callback boundaries missing or reordered",
    )
    const persistPreferencesSource = musicProviderSource.slice(
      persistPreferencesStart,
      persistPreferencesEnd,
    )
    assert.match(
      persistPreferencesSource,
      /if \(!syncEnabled \|\| !ownerKey\) \{\s*return\s*\}/,
    )
    assert.doesNotMatch(musicProviderSource, /syncVisualizerAccountPreferences/)
  })
})
