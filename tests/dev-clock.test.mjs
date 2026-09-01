import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

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
    assert.match(layoutSource, /<AccountShellBootstrapProvider/)
    assert.match(layoutSource, /key=\{accountBootstrap\.ownerKey \?\? "anonymous"\}/)
    assert.match(layoutSource, /<MusicProvider>/)
    assert.doesNotMatch(layoutSource, /accountSyncEnabled/)
    assert.match(musicProviderSource, /useAccountShellBootstrap/)
    assert.match(
      musicProviderSource,
      /bootstrapStatus === "anonymous"[\s\S]*setAccountStatus\("anonymous"\)/,
    )
    const ownerAdoptionAnchor = musicProviderSource.indexOf("if (!storageHydrated)")
    const ownerAdoptionStart = musicProviderSource.lastIndexOf(
      "useEffect(() => {",
      ownerAdoptionAnchor,
    )
    const ownerAdoptionEnd = musicProviderSource.indexOf(
      "const retryVisualizerAccountSync",
      ownerAdoptionStart,
    )
    assert.ok(ownerAdoptionStart >= 0 && ownerAdoptionEnd > ownerAdoptionStart)
    const ownerAdoptionSource = musicProviderSource.slice(ownerAdoptionStart, ownerAdoptionEnd)
    assert.match(
      ownerAdoptionSource,
      /const ownerChanged[\s\S]*adoptedAccountOwnerRef\.current = \{ ownerKey, syncEnabled \}[\s\S]*if \(ownerChanged\) \{[\s\S]*accountRequestIdRef\.current \+= 1[\s\S]*accountWritePendingRef\.current = null/,
    )
    assert.match(
      musicProviderSource,
      /const persistVisualizerAccountPreferences = useCallback\([\s\S]*?if \(!syncEnabled \|\| !ownerKey\) \{[\s\S]*?return[\s\S]*?\}/,
    )
    assert.doesNotMatch(musicProviderSource, /syncVisualizerAccountPreferences/)
    assert.match(wrapperSource, /pathname === "\/dev\/clock"/)
  })
})
