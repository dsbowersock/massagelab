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
      /const DEV_CLOCK_FEATURE_KEYS = \[\s*FEATURE_KEYS\.premiumBackgrounds,\s*FEATURE_KEYS\.chimerCustomColors,\s*\]/,
    )
    assert.match(source, /const DEV_CLOCK_STORAGE_KEY = "massagelab-dev-clock-settings"/)
    assert.match(
      source,
      /const immersiveContext = developmentSubscriberReview\s*\? "clock"/,
    )
    assert.match(
      source,
      /if \(developmentSubscriberReview\) \{[\s\S]*setCanSync\(false\)[\s\S]*setAccountSyncStatus\("synced"\)[\s\S]*\} else \{\s*void syncAccountSettings\(\)/,
    )
    assert.match(source, /localStorage\.setItem\(storageKey/)
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
    assert.match(layoutSource, /<MusicProvider accountSyncEnabled=\{canSyncAccountSettings\}>/)
    assert.match(
      musicProviderSource,
      /if \(!accountSyncEnabled\) \{[\s\S]*setAccountStatus\("anonymous"\)[\s\S]*return[\s\S]*void syncVisualizerAccountPreferences\(\)/,
    )
    assert.match(
      musicProviderSource,
      /if \(!accountSyncEnabled\) \{[\s\S]*accountRequestIdRef\.current \+= 1[\s\S]*accountAbortControllerRef\.current\?\.abort\(\)/,
    )
    assert.match(
      musicProviderSource,
      /const persistVisualizerAccountPreferences = useCallback\([\s\S]*?if \(!accountSyncEnabled\) \{[\s\S]*?return[\s\S]*?\}/,
    )
    assert.match(
      musicProviderSource,
      /const syncVisualizerAccountPreferences = useCallback\([\s\S]*?if \(!accountSyncEnabled\) \{[\s\S]*?return[\s\S]*?\}/,
    )
    assert.match(wrapperSource, /pathname === "\/dev\/clock"/)
  })
})
