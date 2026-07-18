import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isIosSafariNavigator, resolvePwaInstallStatus } from "../lib/pwa-install.js"

describe("PWA install capability", () => {
  it("prioritizes installed state over all install actions", () => {
    assert.equal(resolvePwaInstallStatus({ isStandalone: true, hasPrompt: true, isIosSafari: true }), "installed")
  })

  it("uses a captured native prompt before manual instructions", () => {
    assert.equal(resolvePwaInstallStatus({ hasPrompt: true, isIosSafari: true }), "prompt")
  })

  it("offers instructions only to recognized iOS Safari", () => {
    assert.equal(resolvePwaInstallStatus({ isIosSafari: true }), "instructions")
    assert.equal(resolvePwaInstallStatus({}), "unsupported")
  })

  it("recognizes iPhone Safari and touch-enabled iPad desktop UA", () => {
    assert.equal(isIosSafariNavigator({
      userAgent: "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
      maxTouchPoints: 5,
    }), true)
    assert.equal(isIosSafariNavigator({
      userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 5,
    }), true)
    assert.equal(isIosSafariNavigator({
      userAgent: "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/130.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
      maxTouchPoints: 5,
    }), false)
  })
})
