import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
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

  it("rejects unknown iOS browsers that merely include the Safari token", () => {
    assert.equal(isIosSafariNavigator({
      userAgent: "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 AcmeBrowser/1.0 Safari/604.1",
      platform: "iPhone",
      maxTouchPoints: 5,
    }), false)
  })

  it("keeps install conditional and renders the selected public actions", () => {
    const sidebar = readFileSync(new URL("../components/sidebar/app-sidebar-client.tsx", import.meta.url), "utf8")
    assert.match(sidebar, /status === "prompt" \|\| status === "instructions"/)
    assert.match(sidebar, /Install MassageLab/)
    assert.match(
      sidebar,
      /const publicRoutes = accountRoutes\.filter\(\(route\) => \["help-faq", "send-feedback", "legal"\]\.includes\(route\.id\)\)/,
    )

    const commonMenuGroup = sidebar.match(
      /<DropdownMenuGroup>\s*\{installAvailable[\s\S]*?<\/DropdownMenuGroup>/,
    )?.[0]
    assert.ok(commonMenuGroup)
    assert.match(commonMenuGroup, /\{publicRoutes\.map\(\(route\) => \{/)
    assert.match(commonMenuGroup, /<DropdownMenuItem key=\{route\.id\} asChild>/)
    assert.match(commonMenuGroup, /\{route\.label\}/)
  })
})
