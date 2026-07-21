import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  defaultAppSettings,
  getAudioPlayerToolbarPlacement,
  normalizeAppSettings,
} from "../lib/app-settings.js"
import {
  getMusicPlayerPlacement,
  resolveMainBarLayout,
} from "../lib/app-shell.js"
import {
  getSidebarRenderMode,
  shouldCollapseSidebarFromOutsidePointer,
  shouldExpandSidebarFromRail,
} from "../lib/sidebar-layout.js"

describe("App settings helpers", () => {
  it("uses a single theme toggle across app bar layouts", () => {
    const source = readFileSync(new URL("../components/theme-switcher-multi-button.tsx", import.meta.url), "utf8")

    assert.match(source, /ml-theme-toggle-button/)
    assert.match(source, /const nextToggledTheme: ThemeMode = resolvedTheme === "dark" \? "light" : "dark"/)
    assert.match(source, /variant=\{resolvedTheme === "dark" \? "glow" : "default"\}/)
    assert.match(source, /data-theme-selected/)
    assert.doesNotMatch(source, /role="radiogroup"/)
    assert.doesNotMatch(source, /suppressCompactActivationRef/)
  })

  it("keeps the global theme control visible in the primary bar on narrow phones", () => {
    const topBarSource = readFileSync(new URL("../components/calendar/calendar-operator-top-bar.tsx", import.meta.url), "utf8")

    assert.match(topBarSource, /<ThemeSwitcherMultiButton\b/)
    assert.match(topBarSource, /gap-1 min-\[361px\]:gap-2/)
    assert.doesNotMatch(topBarSource, /ThemeSwitcherMultiButton className="max-\[360px\]:hidden"/)
  })

  it("shares semantic active tool links across desktop and mobile bars", () => {
    const toolLink = readFileSync(new URL("../components/shell/app-tool-link.tsx", import.meta.url), "utf8")
    const topBar = readFileSync(new URL("../components/calendar/calendar-operator-top-bar.tsx", import.meta.url), "utf8")
    const mobileBar = readFileSync(new URL("../components/shell/mobile-main-bar.tsx", import.meta.url), "utf8")
    assert.match(toolLink, /isNavigationRouteActive/)
    assert.match(toolLink, /aria-current=\{active \? "page" : undefined\}/)
    assert.match(topBar, /ml-calendar-drawer-trigger/)
    assert.match(mobileBar, /AppToolLink/)
  })

  it("forwards tooltip trigger props and refs through the shared tool link", () => {
    const toolLink = readFileSync(new URL("../components/shell/app-tool-link.tsx", import.meta.url), "utf8")

    assert.match(toolLink, /forwardRef<HTMLAnchorElement/)
    assert.match(toolLink, /\.\.\.triggerProps/)
    assert.match(toolLink, /<Link[\s\S]*\{\.\.\.triggerProps\}[\s\S]*ref=\{ref\}/)
  })

  it("uses the shared Metal ring for active tool routes without replacing CTA Blue", () => {
    const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
    const toolLinkSource = readFileSync(new URL("../components/shell/app-tool-link.tsx", import.meta.url), "utf8")
    const activeRule = globalsSource.match(/\.ml-app-tool-link\[data-active="true"\]\s*\{[\s\S]*?\n  \}/)?.[0] ?? ""

    assert.match(toolLinkSource, /function ActiveToolMetalRing[\s\S]*?ResizeObserver[\s\S]*?<MetalAttentionRing className="ml-app-tool-link-active-ring">/)
    assert.doesNotMatch(toolLinkSource, /disableMetalGlow|metalMode="always"|metalRingCssPx=|metalStrength=/)
    assert.match(toolLinkSource, /active \? <ActiveToolMetalRing>\{toolLink\}<\/ActiveToolMetalRing> : toolLink/)
    assert.match(activeRule, /filter:\s*brightness\(1\.08\) saturate\(1\.08\)/)
    assert.doesNotMatch(activeRule, /drop-shadow|box-shadow|--ml-button-shadow/)
  })

  it("keeps the main-bar drawer and actions at 42px with a compact 32px theme toggle", () => {
    const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
    const themeSwitcherSource = readFileSync(new URL("../components/theme-switcher-multi-button.tsx", import.meta.url), "utf8")
    const topBarSource = readFileSync(new URL("../components/calendar/calendar-operator-top-bar.tsx", import.meta.url), "utf8")

    assert.match(globalsSource, /--ml-shell-compact-control-size:\s*2rem/)
    assert.match(globalsSource, /--ml-shell-main-bar-control-size:\s*2\.625rem/)
    assert.match(globalsSource, /\.ml-app-topbar \.ml-shell-compact-control \{[\s\S]*height: var\(--ml-shell-compact-control-size\);[\s\S]*width: var\(--ml-shell-compact-control-size\)/)
    assert.match(globalsSource, /\.ml-shell-main-bar-control \{[\s\S]*height: var\(--ml-shell-main-bar-control-size\);[\s\S]*width: var\(--ml-shell-main-bar-control-size\)/)
    assert.match(globalsSource, /\.ml-app-topbar \.ml-shell-main-bar-control \{[\s\S]*height: var\(--ml-shell-main-bar-control-size\);[\s\S]*width: var\(--ml-shell-main-bar-control-size\)/)
    assert.match(themeSwitcherSource, /ml-shell-compact-control ml-shell-theme-button/)
    assert.match(topBarSource, /className="ml-shell-main-bar-control shrink-0"/)
    assert.match(topBarSource, /<Menu aria-hidden="true" data-icon="menu" \/>/)
    assert.match(topBarSource, /const sidebarOpen = renderMode === "drawer" \? openMobile : state === "expanded"/)
    assert.match(topBarSource, /aria-label=\{sidebarOpen \? "Close navigation" : "Open navigation"\}/)
    assert.match(topBarSource, /aria-expanded=\{sidebarOpen\}/)
    assert.match(globalsSource, /\.ml-mobile-main-bar \.ml-theme-switcher \.ml-shell-theme-button \{[\s\S]*height: var\(--ml-shell-compact-control-size\);[\s\S]*width: var\(--ml-shell-compact-control-size\)/)
  })

  it("keeps one responsive app-bar brand link beside the drawer control", () => {
    const brand = readFileSync(new URL("../components/shell/app-bar-brand-link.tsx", import.meta.url), "utf8")
    const sidebar = readFileSync(new URL("../components/sidebar/app-sidebar-client.tsx", import.meta.url), "utf8")

    assert.match(brand, /aria-label="MassageLab home"/)
    assert.match(brand, /massagelab-wordmark-final-20260622\.png/)
    assert.match(brand, /massagelab-mark-final-20260622\.png/)
    assert.doesNotMatch(sidebar, /function SidebarLogoHomeLink/)
  })

  it("offsets the fixed desktop sidebar frame from the configured app-bar edge", () => {
    const sidebar = readFileSync(new URL("../components/sidebar/app-sidebar-client.tsx", import.meta.url), "utf8")
    const topBar = readFileSync(new URL("../components/calendar/calendar-operator-top-bar.tsx", import.meta.url), "utf8")
    const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")

    assert.match(sidebar, /<Sidebar[\s\S]*className="ml-app-sidebar-frame"/)
    assert.match(globalsSource, /\.ml-app-sidebar-spacer \{[\s\S]*pointer-events:\s*none/)
    assert.match(globalsSource, /html\[data-app-bar-position="top"\][\s\S]*> \.ml-app-sidebar-frame \{[\s\S]*bottom: auto/)
    assert.match(globalsSource, /html\[data-app-bar-position="bottom"\][\s\S]*> \.ml-app-sidebar-frame \{[\s\S]*top: auto/)
    assert.match(topBar, /data-drawer-edge=\{sidebarIsRight \? "right" : "left"\}/)
    assert.match(globalsSource, /\.ml-app-topbar \.ml-app-bar-drawer-brand\[data-drawer-edge="left"\] \{[\s\S]*translateX\(-0\.6875rem\)/)
    assert.match(globalsSource, /\.ml-app-topbar \.ml-app-bar-drawer-brand\[data-drawer-edge="right"\] \{[\s\S]*translateX\(0\.6875rem\)/)
  })

  it("uses the approved shared toggle treatment on representative route settings", () => {
    const accountSource = readFileSync(new URL("../app/account/app-settings-panel.tsx", import.meta.url), "utf8")
    const calendarSource = readFileSync(new URL("../app/calendar/calendar-workspace.tsx", import.meta.url), "utf8")
    const soapSource = readFileSync(new URL("../app/notes/soap/components/objective-entry-form.tsx", import.meta.url), "utf8")

    assert.match(accountSource, /<ToggleControl[\s\S]*label="Haptic feedback"/)
    assert.match(calendarSource, /<ToggleControl[\s\S]*density="dense"[\s\S]*tone="leaf"/)
    assert.match(soapSource, /<Switch[\s\S]*size="compact"[\s\S]*tone="alert"/)
  })

  it("keeps segmented selection independent from tooltip state", () => {
    const segmentedSource = readFileSync(new URL("../components/ui/segmented-toggle-group.tsx", import.meta.url), "utf8")
    const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")

    assert.match(segmentedSource, /data-selected=\{option\.value === value\}/)
    assert.match(segmentedSource, /"--ml-segment-offset": `\$\{selectedIndex \* 100\}%`/)
    assert.match(globalsSource, /\.ml-toggle\[data-selected="true"\]/)
    assert.match(globalsSource, /\.ml-toggle-group-item\[data-selected="true"\]/)
    assert.match(globalsSource, /--ml-toggle-content:\s*222 100% 96%/)
    assert.match(globalsSource, /\.ml-toggle:is\(\[data-state="on"\], \[aria-pressed="true"\], \[data-selected="true"\]\) svg/)
    assert.match(globalsSource, /--ml-choice-slide-duration:\s*420ms/)
    assert.match(globalsSource, /--ml-choice-slide-easing:\s*cubic-bezier\(0\.22, 1, 0\.36, 1\)/)
    assert.match(globalsSource, /\.ml-segmented-toggle-group::before[\s\S]*transform: translateX\(var\(--ml-segment-offset\)\)/)
    assert.match(globalsSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition-duration: 120ms/)
  })

  it("shares the approved route-control styling with production Chimer and drawer routes", () => {
    const gallerySource = readFileSync(new URL("../app/dev/buttons/route-control-gallery.tsx", import.meta.url), "utf8")
    const chimerSource = readFileSync(new URL("../app/chimer/running-timer.tsx", import.meta.url), "utf8")
    const sidebarSource = readFileSync(new URL("../components/sidebar/app-sidebar-client.tsx", import.meta.url), "utf8")
    const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")

    assert.match(gallerySource, /ml-chimer-tabs/)
    assert.match(gallerySource, /ml-time-format-choice/)
    assert.match(gallerySource, /ml-sidebar-route/)
    assert.match(gallerySource, /data-active-tab=\{activeTab\}/)
    assert.match(gallerySource, /data-active-format=\{timeFormat\}/)
    assert.match(chimerSource, /<ImmersivePanelShell[\s\S]*activePanel=\{activePanel\}/)
    assert.match(chimerSource, /ml-time-format-choice[\s\S]*data-active-format=\{timeFormat\}/)
    assert.match(sidebarSource, /ml-sidebar-route/)
    assert.match(globalsSource, /\.ml-chimer-tabs\.ml-chimer-tabs \{[\s\S]*border-radius: 0\.5625rem/)
    assert.match(globalsSource, /\.ml-chimer-tabs \.ml-chimer-tab\[data-state="active"\]/)
    assert.match(globalsSource, /\.ml-time-format-choice \.ml-time-format-option\[aria-pressed="true"\]/)
    assert.match(globalsSource, /\.ml-time-format-choice \.ml-time-format-option:hover:not\(\[aria-pressed="true"\]\)/)
    assert.doesNotMatch(chimerSource, /ml-chimer-tabs/)
    assert.match(globalsSource, /\.ml-time-format-choice\[data-active-format="24h"\]::before/)
    assert.match(globalsSource, /\.ml-sidebar-route\.ml-sidebar-route\[data-active="true"\]/)
  })

  it("defaults the app to dark mode with the portrait sidebar button at bottom left", () => {
    assert.deepEqual(normalizeAppSettings(null), defaultAppSettings)
    assert.equal(defaultAppSettings.sidebarPosition, "left")
    assert.equal(defaultAppSettings.sidebarTriggerPosition, "bottom")
    assert.equal(defaultAppSettings.ambientMotionMode, "system")
  })

  it("preserves valid layout and theme preferences", () => {
    assert.deepEqual(normalizeAppSettings({
      appBarPosition: "bottom",
      sidebarPosition: "right",
      sidebarTriggerPosition: "bottom",
      themeMode: "system",
      ambientMotionMode: "reduced",
      hapticFeedbackEnabled: true,
    }), {
      appBarPosition: "bottom",
      sidebarPosition: "right",
      sidebarTriggerPosition: "bottom",
      themeMode: "system",
      ambientMotionMode: "reduced",
      hapticFeedbackEnabled: true,
    })
  })

  it("rejects invalid theme and sidebar values back to dark defaults", () => {
    assert.deepEqual(normalizeAppSettings({
      sidebarPosition: "center",
      sidebarTriggerPosition: "middle",
      appBarPosition: "middle",
      themeMode: "high-contrast",
      ambientMotionMode: "full-motion",
    }), defaultAppSettings)
  })

  it("defaults to a bottom app bar and keeps the music player on the bottom", () => {
    assert.equal(defaultAppSettings.appBarPosition, "bottom")
    assert.equal(defaultAppSettings.sidebarPosition, "left")
    assert.equal(defaultAppSettings.sidebarTriggerPosition, "bottom")
    assert.equal(getAudioPlayerToolbarPlacement(defaultAppSettings), "bottom")
    assert.equal(getMusicPlayerPlacement(defaultAppSettings), "bottom")
    assert.equal(getMusicPlayerPlacement({ appBarPosition: "top" }), "bottom")
  })

  it("keeps the legacy trigger edge synchronized with the app bar", () => {
    assert.equal(normalizeAppSettings({ appBarPosition: "top", sidebarTriggerPosition: "bottom" }).sidebarTriggerPosition, "top")
    assert.equal(normalizeAppSettings({ appBarPosition: "bottom", sidebarTriggerPosition: "top" }).sidebarTriggerPosition, "bottom")
  })

  it("mirrors the tools when the drawer and brand move to the right edge", () => {
    const appShellSource = readFileSync(new URL("../lib/app-shell.js", import.meta.url), "utf8")
    const topBarSource = readFileSync(new URL("../components/calendar/calendar-operator-top-bar.tsx", import.meta.url), "utf8")
    const leftLayout = resolveMainBarLayout({ sidebarPosition: "left" })
    const rightLayout = resolveMainBarLayout({ sidebarPosition: "right" })

    assert.deepEqual(leftLayout, {
      drawerEdge: "left",
      edgeItemIds: ["more", "brand"],
      toolItemIds: ["quick-create", "music", "clock", "calendar", "theme"],
    })
    assert.deepEqual(rightLayout, {
      drawerEdge: "right",
      edgeItemIds: ["brand", "more"],
      toolItemIds: ["theme", "calendar", "clock", "music", "quick-create"],
    })
    assert.match(appShellSource, /export const MAIN_BAR_TOOL_ITEM_IDS/)
    assert.match(appShellSource, /toolItemIds: \[\.\.\.MAIN_BAR_TOOL_ITEM_IDS\]\.reverse\(\)/)
    assert.match(topBarSource, /resolveMainBarLayout/)
    assert.match(topBarSource, /layout\.toolItemIds\.map/)
  })

  it("renders the mobile main bar and quick-action speed dial from the layout shell", () => {
    const layoutSource = readFileSync(new URL("../components/layout-wrapper.tsx", import.meta.url), "utf8")
    const mainBarSource = readFileSync(new URL("../components/shell/mobile-main-bar.tsx", import.meta.url), "utf8")
    const speedDialSource = readFileSync(new URL("../components/shell/quick-action-speed-dial.tsx", import.meta.url), "utf8")
    const topBarSource = readFileSync(new URL("../components/calendar/calendar-operator-top-bar.tsx", import.meta.url), "utf8")

    assert.match(layoutSource, /<MobileMainBar\b/)
    assert.match(mainBarSource, /resolveMainBarLayout/)
    assert.match(mainBarSource, /aria-label="MassageLab main navigation"/)
    assert.match(mainBarSource, /QuickActionSpeedDial/)
    assert.match(speedDialSource, /aria-label="Quick create actions"/)
    assert.match(speedDialSource, /Escape/)
    assert.match(topBarSource, /QuickActionSpeedDial/)
    assert.match(topBarSource, /aria-label="Open quick actions"/)
  })

  it("clears Chimer-only body classes off non-Chimer routes so app bars stay visible", () => {
    const layoutSource = readFileSync(new URL("../components/layout-wrapper.tsx", import.meta.url), "utf8")
    const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")

    assert.match(layoutSource, /const isChimerRoute = pathname\.startsWith\("\/chimer"\) \|\| pathname\.startsWith\("\/clock"\)/)
    assert.match(layoutSource, /if \(!isChimerRoute\) \{[\s\S]*document\.body\.classList\.remove\("chimer-running", "chimer-alerting"\)/)
    assert.match(layoutSource, /pathname\.startsWith\("\/anatomime"\)/)
    assert.match(globalsSource, /body\.chimer-running \.ml-app-topbar/)
    assert.match(globalsSource, /body\.chimer-running \.ml-mobile-main-bar/)
  })

  it("keeps immersive Chimer offsets stronger and later than responsive app-bar offsets", () => {
    const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
    const responsiveOffsetIndex = globalsSource.indexOf(
      'html[data-app-bar-position="bottom"] .ml-app-shell[data-main-bar-visible="true"]',
    )
    const immersiveReset = globalsSource.match(
      /html\[data-app-bar-position\] body\.chimer-running \.ml-app-shell,\s*html\[data-app-bar-position\] body\.chimer-alerting \.ml-app-shell,\s*html\[data-app-bar-position\] body\.chimer-preview-capture \.ml-app-shell \{[\s\S]*?\n  \}/,
    )

    assert.ok(responsiveOffsetIndex >= 0)
    assert.ok(immersiveReset?.index !== undefined)
    assert.ok(immersiveReset.index > responsiveOffsetIndex)
    assert.match(immersiveReset[0], /--ml-page-top-safe:\s*0px/)
    assert.match(immersiveReset[0], /--ml-page-bottom-safe:\s*0px/)
    assert.match(immersiveReset[0], /--ml-bottom-stack-height:\s*var\(--ml-safe-bottom\)/)
    assert.doesNotMatch(immersiveReset[0], /!important/)
  })

  it("derives mobile bottom-safe spacing from the resolved bottom stack", () => {
    const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
    const topPlacementRule = globalsSource.match(
      /html\[data-app-bar-position="top"\] \.ml-app-shell\[data-main-bar-visible="true"\] \{[\s\S]*?\n    \}/,
    )?.[0] ?? ""
    const bottomPlacementRule = globalsSource.match(
      /html\[data-app-bar-position="bottom"\] \.ml-app-shell\[data-main-bar-visible="true"\] \{[\s\S]*?\n    \}/,
    )?.[0] ?? ""
    const visibleBarRule = globalsSource.match(
      /\n    \.ml-app-shell\[data-main-bar-visible="true"\] \{[\s\S]*?\n    \}/,
    )?.[0] ?? ""
    const activeMusicRules = [...globalsSource.matchAll(
      /body\.ml-music-player-active\.ml-music-player-bottom \.ml-app-shell(?:\[data-main-bar-visible="true"\])? \{[\s\S]*?\n\s*\}/g,
    )].map((match) => match[0])

    assert.match(topPlacementRule, /--ml-bottom-stack-height:\s*var\(--ml-safe-bottom\)/)
    assert.match(bottomPlacementRule, /--ml-bottom-stack-height:\s*calc\(var\(--ml-safe-bottom\) \+ var\(--ml-main-bar-height\)\)/)
    assert.doesNotMatch(topPlacementRule, /--ml-page-bottom-safe/)
    assert.doesNotMatch(bottomPlacementRule, /--ml-page-bottom-safe/)
    assert.match(visibleBarRule, /--ml-page-bottom-safe:\s*calc\(var\(--ml-bottom-stack-height\)/)
    assert.doesNotMatch(visibleBarRule, /--ml-main-bar-height/)
    assert.ok(activeMusicRules.length >= 1)
    for (const rule of activeMusicRules) {
      assert.match(rule, /--ml-page-bottom-safe:\s*calc\(var\(--ml-bottom-stack-height\)/)
      assert.doesNotMatch(rule, /--ml-main-bar-height/)
    }
  })

  it("groups wide-mobile tools opposite the drawer and gives the sidebar frame the bar offset", () => {
    const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
    const toolsRule = globalsSource.match(/\.ml-main-bar-tools \{[\s\S]*?\n  \}/)?.[0] ?? ""
    const leftToolsRule = globalsSource.match(
      /\.ml-main-bar-layout\[data-drawer-edge="left"\] \.ml-main-bar-tools \{[\s\S]*?\n  \}/,
    )?.[0] ?? ""
    const rightToolsRule = globalsSource.match(
      /\.ml-main-bar-layout\[data-drawer-edge="right"\] \.ml-main-bar-tools \{[\s\S]*?\n  \}/,
    )?.[0] ?? ""
    const wideMobileStart = globalsSource.indexOf("@media (min-width: 601px) and (max-width: 767px)")
    const wideMobileEnd = globalsSource.indexOf("@supports selector(:has(*))", wideMobileStart)
    const wideMobileRules = globalsSource.slice(wideMobileStart, wideMobileEnd)

    assert.match(toolsRule, /flex:\s*0 0 auto/)
    assert.match(toolsRule, /gap:\s*0\.25rem/)
    assert.doesNotMatch(toolsRule, /space-around/)
    assert.match(leftToolsRule, /margin-left:\s*auto/)
    assert.match(leftToolsRule, /justify-content:\s*flex-end/)
    assert.match(rightToolsRule, /margin-right:\s*auto/)
    assert.match(rightToolsRule, /justify-content:\s*flex-start/)
    assert.ok(wideMobileStart >= 0)
    assert.ok(wideMobileEnd > wideMobileStart)
    assert.doesNotMatch(globalsSource, /\.ml-mobile-main-bar\[data-sidebar-position="(?:left|right)"\]/)
    assert.match(
      wideMobileRules,
      /html\[data-app-bar-position="top"\] \[data-sidebar-container="true"\] > \.ml-app-sidebar-frame/,
    )
    assert.match(wideMobileRules, /top:\s*calc\(var\(--ml-safe-top\) \+ var\(--ml-main-bar-height\)\)/)
    assert.match(wideMobileRules, /height:\s*calc\(100svh - var\(--ml-safe-top\) - var\(--ml-main-bar-height\)\)/)
    assert.match(
      wideMobileRules,
      /html\[data-app-bar-position="bottom"\] \[data-sidebar-container="true"\] > \.ml-app-sidebar-frame/,
    )
    assert.match(wideMobileRules, /bottom:\s*calc\(var\(--ml-safe-bottom\) \+ var\(--ml-main-bar-height\)\)/)
    assert.match(wideMobileRules, /height:\s*calc\(100svh - var\(--ml-safe-bottom\) - var\(--ml-main-bar-height\)\)/)
    assert.match(wideMobileRules, /\.ml-app-sidebar-spacer \{[\s\S]*width:\s*var\(--sidebar-width-icon\)/)
    assert.match(wideMobileRules, /\.ml-app-sidebar-spacer \{[\s\S]*pointer-events:\s*none/)
  })

  it("keeps the wide-mobile drawer control and overlay on one sidebar state contract", () => {
    const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
    const layoutSource = readFileSync(new URL("../components/layout-wrapper.tsx", import.meta.url), "utf8")
    const mainBarSource = readFileSync(new URL("../components/shell/mobile-main-bar.tsx", import.meta.url), "utf8")
    const sidebarSource = readFileSync(new URL("../components/ui/sidebar.tsx", import.meta.url), "utf8")
    const sheetSource = readFileSync(new URL("../components/ui/sheet.tsx", import.meta.url), "utf8")
    const topBarSource = readFileSync(new URL("../components/calendar/calendar-operator-top-bar.tsx", import.meta.url), "utf8")

    assert.match(mainBarSource, /const \{ isMobile, openMobile, state, toggleSidebar \} = useSidebar\(\)/)
    assert.match(mainBarSource, /const sidebarOpen = isMobile \? openMobile : state === "expanded"/)
    assert.match(mainBarSource, /data-sidebar-control="true"/)
    assert.match(mainBarSource, /aria-expanded=\{sidebarOpen\}/)
    assert.match(mainBarSource, /aria-label=\{sidebarOpen \? "Close navigation" : "Open navigation"\}/)
    assert.match(sidebarSource, /"ml-app-sidebar-spacer duration-200/)
    assert.match(sidebarSource, /data-testid="wide-mobile-sidebar-backdrop"/)
    assert.match(sidebarSource, /aria-hidden="true"/)
    assert.match(sidebarSource, /onClick=\{\(\) => setOpen\(false\)\}/)
    assert.match(sidebarSource, /onPointerDownOutside=\{\(event\) =>/)
    assert.match(sidebarSource, /target\.closest\("\[data-sidebar-control='true'\]"\)/)
    assert.match(sidebarSource, /event\.preventDefault\(\)/)
    assert.match(sidebarSource, /onCloseAutoFocus=\{\(event\) =>/)
    assert.match(sidebarSource, /visibleControl\?\.focus\(\)/)
    assert.match(mainBarSource, /ml-mobile-main-bar pointer-events-auto/)
    assert.match(mainBarSource, /data-sidebar-open=\{isMobile && openMobile \? "true" : "false"\}/)
    assert.match(layoutSource, /<MobileMainBar user=\{user\} \/>\}[\s\S]*<MusicMiniPlayer/)
    assert.match(sheetSource, /overlayClassName\?: string/)
    assert.match(sidebarSource, /ml-mobile-sidebar-overlay pointer-events-none backdrop-blur-sm/)
    assert.match(sidebarSource, /ml-mobile-sidebar-sheet/)
    assert.match(globalsSource, /\.ml-mobile-main-bar\[data-sidebar-open="true"\] \{[\s\S]*pointer-events:\s*none/)
    assert.match(globalsSource, /\.ml-mobile-main-bar\[data-sidebar-open="true"\] \[data-sidebar-control="true"\] \{[\s\S]*pointer-events:\s*auto/)
    assert.match(globalsSource, /html\[data-app-bar-position="bottom"\] \.ml-mobile-sidebar-sheet \{[\s\S]*bottom:\s*calc\(var\(--ml-safe-bottom\) \+ var\(--ml-main-bar-height\)\)/)
    assert.match(sidebarSource, /event\.key !== "Escape"/)
    assert.match(sidebarSource, /event\.defaultPrevented/)
    assert.match(sidebarSource, /document\.querySelector\("\[data-sidebar-floating='true'\]"\)/)
    assert.match(sidebarSource, /window\.addEventListener\("keydown", handleEscape, true\)/)
    assert.match(sidebarSource, /state !== "expanded" \|\| renderMode === "drawer"/)
    assert.match(topBarSource, /typeof ResizeObserver === "undefined" \? null : new ResizeObserver\(publishHeight\)/)
    assert.match(topBarSource, /window\.addEventListener\("resize", publishHeight\)/)
    assert.match(topBarSource, /renderMode === "drawer"[\s\S]*sidebarOpen \? "Close navigation" : "Open navigation"[\s\S]*"Toggle navigation"/)
    assert.match(globalsSource, /\.ml-wide-mobile-sidebar-backdrop \{[\s\S]*display:\s*none/)
    assert.match(globalsSource, /@media \(min-width: 601px\) and \(max-width: 767px\) \{[\s\S]*\.ml-wide-mobile-sidebar-backdrop \{[\s\S]*position:\s*fixed/)
    assert.match(globalsSource, /\.ml-wide-mobile-sidebar-backdrop \{[\s\S]*backdrop-filter:\s*blur\(/)
    assert.match(globalsSource, /\.ml-app-sidebar-frame \{[\s\S]*z-index:\s*10015/)
  })

  it("keeps local Site Settings available from the guest account menu", () => {
    const sidebarSource = readFileSync(new URL("../components/sidebar/app-sidebar-client.tsx", import.meta.url), "utf8")

    assert.match(sidebarSource, /const siteSettingsRoute = accountRoutes\.find\(\(route\) => route\.id === "settings"\)/)
    assert.match(sidebarSource, /<DropdownMenuItem[\s\S]*href=\{siteSettingsRoute\.href\}[\s\S]*Site Settings/)
  })

  it("keeps the mobile main bar controls styled as physical buttons", () => {
    const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
    const mainBarSource = readFileSync(new URL("../components/shell/mobile-main-bar.tsx", import.meta.url), "utf8")
    const toolLinkSource = readFileSync(new URL("../components/shell/app-tool-link.tsx", import.meta.url), "utf8")
    const themeSwitcherSource = readFileSync(new URL("../components/theme-switcher-multi-button.tsx", import.meta.url), "utf8")
    const topBarSource = readFileSync(new URL("../components/calendar/calendar-operator-top-bar.tsx", import.meta.url), "utf8")
    const settingsProviderSource = readFileSync(new URL("../components/providers/settings-provider.tsx", import.meta.url), "utf8")

    assert.match(globalsSource, /--ml-site-blue:\s*225 73% 57%/)
    assert.match(globalsSource, /--ml-main-bar-height:\s*3\.25rem/)
    assert.match(mainBarSource, /pb-\[var\(--ml-safe-bottom\)\]/)
    assert.match(mainBarSource, /pt-0/)
    assert.match(
      globalsSource,
      /\.ml-main-bar-layout \{[\s\S]*min-height:\s*calc\(var\(--ml-main-bar-height\) - 1px\)/,
    )
    assert.match(globalsSource, /\.ml-main-bar-layout \{[\s\S]*align-items: center/)
    assert.match(globalsSource, /\.ml-main-bar-drawer-brand \{[\s\S]*align-items: center/)
    assert.match(globalsSource, /\.ml-main-bar-drawer-brand \{[\s\S]*container-name:\s*ml-main-bar-brand/)
    assert.match(globalsSource, /\.ml-main-bar-drawer-brand \{[\s\S]*container-type:\s*inline-size/)
    assert.match(globalsSource, /\.ml-main-bar-drawer-brand \{[\s\S]*flex:\s*0 1 11\.875rem/)
    assert.match(
      globalsSource,
      /@container ml-main-bar-brand \(max-width: 11\.75rem\) \{[\s\S]*\.ml-app-bar-brand-wordmark \{[\s\S]*display:\s*none[\s\S]*\.ml-app-bar-brand-mark \{[\s\S]*display:\s*block/,
    )
    assert.doesNotMatch(
      globalsSource,
      /@media \(max-width: 1023px\) \{[\s\S]*?\.ml-app-bar-brand-(?:wordmark|mark)/,
    )
    assert.match(globalsSource, /\.ml-main-bar-button \{[\s\S]*align-items: center/)
    assert.match(globalsSource, /\.ml-main-bar-button \{[\s\S]*justify-content: center/)
    assert.equal((mainBarSource.match(/<AppToolLink\b/g) ?? []).length, 3)
    assert.equal((topBarSource.match(/<AppToolLink\b/g) ?? []).length, 2)
    assert.match(toolLinkSource, /variant="ctaBlue"/)
    assert.equal((mainBarSource.match(/variant="ctaBlue"/g) ?? []).length, 0)
    assert.match(mainBarSource, /variant="default"[\s\S]*className=\{cn\("ml-main-bar-plus rounded-full"/)
    assert.equal((topBarSource.match(/variant="ctaBlue"/g) ?? []).length, 1)
    assert.match(topBarSource, /const quickActionControl = \([\s\S]*?variant="default"[\s\S]*?aria-label="Open quick actions"/)
    assert.match(topBarSource, /className="ml-main-bar-tools flex/)
    assert.match(topBarSource, /layout\.toolItemIds\.map/)
    assert.match(mainBarSource, /variant=\{resolvedTheme === "dark" \? "glow" : "default"\}/)
    assert.match(topBarSource, /variant=\{resolvedTheme === "dark" \? "glow" : "default"\}/)
    assert.match(settingsProviderSource, /export function useResolvedTheme\(\): ResolvedThemeMode/)
    assert.match(settingsProviderSource, /applyAppBarPositionAttribute\(settings\.appBarPosition\)/)
    assert.match(settingsProviderSource, /document\.documentElement\.dataset\.appBarPosition = appBarPosition/)
    assert.match(settingsProviderSource, /mediaQuery\.addEventListener\("change", updateSystemTheme\)/)
    assert.doesNotMatch(globalsSource, /\.ml-button-press-motion\.ml-button-ghost\.ml-main-bar-button/)
    assert.match(globalsSource, /\.ml-main-bar-button span:not\(\.sr-only\) \{[\s\S]*display: none/)
    assert.match(globalsSource, /\.ml-mobile-main-bar \.ml-main-bar-plus \{[\s\S]*width: 2\.625rem/)
    assert.match(globalsSource, /\.ml-mobile-main-bar \.ml-main-bar-plus-open \{[\s\S]*border-bottom-width: 2px/)
    assert.match(themeSwitcherSource, /data-theme-value=\{currentTheme\.value\}/)
    assert.match(themeSwitcherSource, /ml-theme-switcher/)
    assert.match(themeSwitcherSource, /ml-theme-toggle-button/)
    assert.match(themeSwitcherSource, /resolvedTheme === "dark" \? "glow" : "default"/)
    assert.doesNotMatch(themeSwitcherSource, /className="hidden gap-1 md:flex"/)
    assert.match(themeSwitcherSource, /resolvedTheme === "light" && "ml-button-default"/)
    assert.match(themeSwitcherSource, /resolvedTheme === "dark" && "ml-button-glow"/)
  })

  it("uses a drawer only in narrow portrait phone layouts", () => {
    assert.equal(getSidebarRenderMode({ width: 390, height: 844 }), "drawer")
    assert.equal(getSidebarRenderMode({ width: 655, height: 681 }), "desktop")
    assert.equal(getSidebarRenderMode({ width: 768, height: 1024 }), "desktop")
    assert.equal(getSidebarRenderMode({ width: 1024, height: 768 }), "desktop")
  })

  it("uses an icon rail in compact landscape phone layouts", () => {
    assert.equal(getSidebarRenderMode({ width: 667, height: 375 }), "compact-rail")
    assert.equal(getSidebarRenderMode({ width: 844, height: 390 }), "compact-rail")
  })

  it("expands when a collapsed non-phone rail control is selected", () => {
    assert.equal(shouldExpandSidebarFromRail({ renderMode: "desktop", state: "collapsed" }), true)
    assert.equal(shouldExpandSidebarFromRail({ renderMode: "compact-rail", state: "collapsed" }), true)
    assert.equal(shouldExpandSidebarFromRail({ renderMode: "desktop", state: "expanded" }), false)
    assert.equal(shouldExpandSidebarFromRail({ renderMode: "drawer", state: "collapsed" }), false)
  })

  it("collapses an expanded non-phone sidebar only from outside sidebar clicks", () => {
    assert.equal(shouldCollapseSidebarFromOutsidePointer({
      renderMode: "desktop",
      state: "expanded",
      targetInsideSidebar: false,
      targetInsideSidebarPortal: false,
    }), true)
    assert.equal(shouldCollapseSidebarFromOutsidePointer({
      renderMode: "compact-rail",
      state: "expanded",
      targetInsideSidebar: false,
      targetInsideSidebarPortal: false,
    }), true)
    assert.equal(shouldCollapseSidebarFromOutsidePointer({
      renderMode: "desktop",
      state: "collapsed",
      targetInsideSidebar: false,
      targetInsideSidebarPortal: false,
    }), false)
    assert.equal(shouldCollapseSidebarFromOutsidePointer({
      renderMode: "drawer",
      state: "expanded",
      targetInsideSidebar: false,
      targetInsideSidebarPortal: false,
    }), false)
    assert.equal(shouldCollapseSidebarFromOutsidePointer({
      renderMode: "desktop",
      state: "expanded",
      targetInsideSidebar: true,
      targetInsideSidebarPortal: false,
    }), false)
    assert.equal(shouldCollapseSidebarFromOutsidePointer({
      renderMode: "desktop",
      state: "expanded",
      targetInsideSidebar: false,
      targetInsideSidebarPortal: true,
    }), false)
  })
})
