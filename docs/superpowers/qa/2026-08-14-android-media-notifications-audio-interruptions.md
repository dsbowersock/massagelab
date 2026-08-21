# Android media notifications and audio interruptions acceptance

Date opened: 2026-08-15

Branch candidate: `codex/media-notifications-audio-interruptions`

Latest physically tested candidate commit: `ca429f7f4c3cc1c40bac2a850be73a8226981c2e`

Status: **Round 4 affected behavior physically accepted; broader platform matrix remains pending**

## Evidence boundary

This report is the execution record for the physical Android acceptance matrix. It is intentionally not a waiver and does not claim notification-drawer, lock-screen, hardware-control, background, call, meeting-app, or audible-recovery behavior without observations from real hardware.

The Task 10 preflight found no Android Debug Bridge executable, no configured `ANDROID_HOME` or `ANDROID_SDK_ROOT`, and no connected or authorized Android device interface. Repository documentation identifies Vercel preview deployments as HTTPS, noindex candidates, but does not define an approved local HTTPS/LAN/tunnel workflow. No deployment, public tunnel, firewall change, or externally exposed development server was created during preflight.

The local production build for the candidate completed successfully and generated all 104 pages. That build is automated evidence only; it is not the HTTPS device-test URL.

## Required device and candidate record

Complete every field before starting the matrix. Do not place credentials, tokens, private account data, or private device identifiers in this report.

| Field | Value |
| --- | --- |
| Tester | User-operated physical device; name not recorded |
| Execution date and local time | 2026-08-15 initial pass; 2026-08-16 Round 2/3 retests; 2026-08-17 Round 4-trigger and final affected-behavior retests; local times not recorded |
| Device manufacturer and model | Samsung Galaxy S24 Ultra (`SM-S928U1`) |
| Android version and security patch | Android 16 / One UI 8.5; Android security patch not recorded; Google Play system update 2026-07-01 |
| Browser name and version | Google Chrome `151.0.7922.137` |
| Browser-tab mode supported | Yes |
| Installed-PWA mode supported | Pending |
| PWA install source/version | Pending |
| Candidate commit | `ca429f7f4c3cc1c40bac2a850be73a8226981c2e` |
| Authorized HTTPS candidate URL | `https://massagelab-1ia9a0227-dsbteam.vercel.app/music` |
| Candidate-to-commit provenance check | Vercel deployment status and HTTP 200 were confirmed for the exact candidate before device execution |
| Tested station | MassageLab Proof Drone (`mlab-proof-drone`) |
| Secondary station for Previous/Next | Pending |
| Carrier failure method | Pending; use a controlled, reversible failure that does not alter production data |
| Call source/second device | Pending |
| Meeting/media app and version | Pending |
| Bluetooth/headset model | Pending |
| Notification and media permissions/state | Chrome exposed notification-drawer and lock-screen media surfaces; notification permission state not recorded |
| Battery/background restrictions | Pending |
| Device silent/DND/ringer state | Pending |

## Execution rules

1. Start each row from the recorded initial state. Record the saved device default and the current-session override independently.
2. For notification and lock-screen assertions, record only what the operating system actually displays and exposes. Mark an optional control `Not exposed` rather than treating its absence as application success.
3. For call/meeting rows, record OS mute/duck, provider state, generator teardown, and audible recovery separately. Do not infer one column from another.
4. A system-only duck or mute without an observable interruption signal must not be rewritten as a MassageLab state transition.
5. Explicit user Pause or Stop remains authoritative over later recovery signals. Play always starts a fresh generator session rather than resuming the previous musical position.
6. Capture sanitized screenshots or screen recordings only when they contain no personal call, account, notification, or device-identifying data.
7. A failed physical row requires the smallest reproducible automated RED before changing production code, followed by focused GREEN validation and a repeat of the physical row.

## Historical core media matrix — candidates through `4c187f9f`

This versioned table preserves the initial and Round 2 device history. It is not
the authoritative status for latest tested head `4ef5804b`. Rows record only
the behavior observed on those earlier candidates; untested rows remain
`Pending / Not run`.

| # | Mode | Saved preference | Current-session preference | Expected result | Actual result | Pass/fail |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Browser tab | Not recorded | Not recorded | Starting the station publishes notification-drawer station title, `Massage Lab` source, and artwork while generator audio plays. | On the exact-preview retest, the media card appeared and Previous, Play/Pause, and Next worked, but no artwork appeared. The earlier 10-second carrier duration/timeline was no longer present. | Fail |
| 2 | Installed PWA, where supported | Record | Record | Starting the same station publishes the same truthful metadata and artwork in installed-PWA mode. | Not run | Pending |
| 3 | Browser tab; screen locked | Not recorded | Not recorded | The lock-screen media card shows the current station metadata and artwork without fabricated seek position or duration. | The exact-preview retest no longer showed the fabricated 10-second timeline, but no station artwork appeared. | Fail |
| 4 | Notification Pause | Not recorded | Not recorded | Pause tears down audible generator sources, changes MassageLab to Paused, retains station/metadata/carrier source, and leaves a resumable media card. | Pause stopped the audible generator and retained the media card. | Pass |
| 5 | Notification Play after row 4 | Not recorded | Not recorded | Play starts a fresh generator session for the retained station, returns to Playing, and does not show the new-session preference notice. | Play restarted the generator from the retained card. | Pass |
| 6 | Notification Stop | Not recorded | Not recorded | Stop tears down the generator, changes MassageLab to Stopped, clears media ownership/metadata, and dismisses the operating-system media card. | Chrome did not expose a Stop control; only Previous, Pause/Play, and Next were visible. The Stop action was not executed, so this is not evidence of a handler failure. | Not exposed |
| 7 | Bluetooth/headset Play/Pause | Record | Record | Hardware Pause has the same retained-card/fresh-session semantics as Media Session Pause, and hardware Play starts fresh when the operating system exposes the actions. | Not run | Pending |
| 8 | Notification Previous and Next | Not recorded | Not recorded | Each exposed action changes station, replaces the generator without duplicate media ownership, publishes the new metadata, and preserves the current-session preference. | Chrome/One UI exposed both actions and each changed the station/generator, title, and attempted artwork together. No artwork rendered, so the required title/artwork pairing could not pass. Current-session preference preservation was not separately observed. | Fail |
| 9 | In-app Stop | Record | Record | Stop dismisses the operating-system card and tears down playback while retaining the selected station identity in MassageLab. | Not run | Pending |
| 10 | Lock screen, background, then return | Record | Record | The returned app reflects the authoritative active, Paused, or Stopped intent; it does not publish a stale Playing transition or create duplicate carrier/generator ownership. | Not run | Pending |
| 16 | Forced carrier failure | Record | Record | Ordinary in-app generator playback still works; the UI does not promise interruption control, and no unsupported media card/setting claim is shown. | Not run | Pending |

## Calls and external-media interruptions

For rows 11-15, write `None observed`, `Muted`, or `Ducked` in the OS column; an exact provider state (`Playing`, `Interrupted`, `Paused`, `Stopped`, or `No observable change`) in the provider column; `Yes`, `No`, or `Unknown` in the teardown column; and an observed audible outcome in the recovery column. If the platform emits no observable interruption, record that result directly rather than forcing the intended policy.

| # | Scenario | Saved preference | Current-session preference | Expected result when an interruption and recovery signal are observable | OS muted/ducked | Provider state | Generator torn down | Audible recovery | Actual result/notes | Pass/fail |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 11 | Incoming call ignored/declined | Record | Enabled | MassageLab enters Interrupted, tears down the generator, and starts a fresh generator after recovery unless explicit Pause/Stop superseded it. | Not run | Not run | Not run | Not run | Not run | Pending |
| 12 | Incoming call ignored/declined | Record | Disabled | MassageLab enters Interrupted, tears down the generator, then settles Paused after recovery and remains silent until explicit Play. | Not run | Not run | Not run | Not run | Not run | Pending |
| 13 | Incoming call answered, then ended | Record | Enabled | For observable interruption/recovery, MassageLab enters Interrupted, tears down the generator, and starts a fresh generator after recovery unless explicit Pause/Stop superseded it. | Not run | Not run | Not run | Not run | Not run | Pending |
| 14 | Incoming call answered, then ended | Record | Disabled | For observable interruption/recovery, MassageLab enters Interrupted, tears down the generator, then settles Paused and remains silent until explicit Play. | Not run | Not run | Not run | Not run | Not run | Pending |
| 15 | Zoom, Google Meet, or another available calling/media app | Record | Test enabled and disabled separately | When the browser exposes interruption/recovery, behavior follows the current-session preference. If the OS only ducks/mutes or exposes no signal, record no observable MassageLab transition and make no auto-resume guarantee. | Not run | Not run | Not run | Not run | Not run | Pending |

## Historical physical result summary — candidates through `4c187f9f`

| Result | Count |
| --- | ---: |
| Passed | 2 |
| Failed | 3 |
| Not exposed/not applicable | 1 |
| Pending/not run | 10 |

Physical Android acceptance remains open. Rows 4 and 5 passed on the recorded device. Rows 1 and 3 fail because artwork is absent, while the prior fabricated 10-second timeline is now gone. Row 8 proves Previous and Next switch the station/generator and update the title, but fails its complete contract because artwork is absent. Row 6 could not be executed because Chrome did not expose Stop. Rows 2, 7, and 9-16 remain pending.

## Historical exact-preview application UI retest — `4c187f9f`

The 2026-08-16 retest of exact commit `4c187f9fdd1bee793634e9840786ed74057ae8f2` also produced the following application-level evidence:

| Surface or behavior | Observation | Result |
| --- | --- | --- |
| First centered carousel Play activation | Still required two touch/click activations before playback started. | Fail |
| Carousel artwork | Every observed card rendered the accessible fallback text `MassageLab station artwork unavailable`. | Fail |
| Expanded vinyl/player artwork | The decorative record was present but had no station image. The expanded controls otherwise appeared in the approved order and style. | Fail for artwork; control hierarchy observed |
| Minimized vinyl/player | Minimized behavior was otherwise acceptable, but station artwork remained absent. | Fail for artwork; compact behavior observed |
| Timeline | The former 10-second duration/timeline was absent. | Pass |
| Reduced motion | Tester believed motion behavior was correct but did not make a definitive observation. | Inconclusive; retest |
| Phone fit | The bottom expanded player consumed too much vertical space and required scrolling around the station carousel. Tester requested a right-side player on small phone viewports, with a compact rail exposing vinyl plus Play/Stop and Expand, an expanded relative layout, and a carousel that sizes to the remaining viewport without page scrolling. | Fail; design amendment required |
| Other route/overlay behavior | Scrollable non-Music pages should not have their content squeezed. Menus, drawers, popups, and modals must account for an exposed player so they are not hidden. | New acceptance requirement |

## Authoritative current physical status — Samsung Round 3

The user physically retested immutable deployment
`https://massagelab-p9472ovhv-dsbteam.vercel.app/music` at exact commit
`4ef5804bcb7bc96e34a5b6bb731ee685af8e1883` on the recorded S24 Ultra and
Chrome 151. Four sanitized screenshots were supplied for portrait and
constrained-landscape visual evidence. Their raster dimensions are not treated
as the browser's CSS or visual-viewport dimensions.

This section is authoritative for the latest tested head. It supersedes earlier
application-UI observations only where a Round 3 behavior was actually rerun.
It does not rewrite unexecuted lock-screen, session-preference, PWA, hardware,
call, or meeting rows as passing.

### Current exact-head core matrix reconciliation

| Historical row(s) | Round 3 observation at `4ef5804b` | Authoritative current status |
| --- | --- | --- |
| 1 — Browser-tab notification ownership | After the second in-app Play touch started the generator, the notification showed matching station art and no fabricated timeline. The image remained subjectively soft. | Pass for published metadata/artwork/no-timeline; artwork clarity follow-up remains open. The separate first-touch activation failure remains open below. |
| 2 — Installed PWA | Not run. | Pending |
| 3 — Lock screen | Matching lock-screen artwork and return behavior were not separately rerun or recorded at this exact head. | Pending; no current-head pass claimed |
| 4–5 — Notification Pause/Play | Passed on an earlier candidate but not rerun at this exact head. | Current-head confirmation pending; historical pass retained above |
| 6 — Notification Stop | Previously not exposed by Chrome/One UI and not rerun. | Not established at current head; historical `Not exposed` retained above |
| 7 — Bluetooth/headset | Not run. | Pending |
| 8 — Notification Previous/Next | Exposed controls changed title and matching artwork together. Preservation of the current-session interruption preference was not separately observed. | Partial; identity/art pairing passes, full row remains pending |
| 9–16 — In-app Stop, return/background, calls/meetings, carrier failure | Not run at this exact head. | Pending |

Current-head core-row counts are therefore: 1 fully passed, 1 partially
observed with its full contract pending, 14 pending/not established, and 0
fully failed core rows. The first-touch failure is an application interaction
row, not silently folded into core row 1.

### Confirmed accepted behavior

| Surface or behavior | Physical observation | Result |
| --- | --- | --- |
| Inline artwork loading | Carousel and vinyl artwork appeared immediately and matched the active station. | Pass |
| Previous/Next identity | Title and artwork changed together. | Pass |
| Timeline | The notification exposed no fabricated 10-second duration/timeline. | Pass |
| Vinyl speed | Normal motion completed the approved slower revolution rather than the prior four-second spin. | Pass |
| Portrait workspace | The portrait `/music` carousel and bottom player remained fitted and available without the earlier page-scroll failure. | Pass |
| Expanded rail controls | The constrained-landscape rail used the approved top transport row and bottom Settings/Favorite/Background/Minimize row. | Pass |
| Overlay clearance | Tested menus/dialog-like surfaces were not observed hidden behind the exposed rail. | Pass for observed surfaces |
| Reduced motion | Enabling Samsung's reduced-animation preference stopped the vinyl animation. | Pass |

### Still-open affected behavior

| Surface or behavior | Physical observation | Required acceptance |
| --- | --- | --- |
| First centered Play touch | After Play was stable and enabled for at least five seconds, the first touch visibly depressed the button and produced haptic feedback, but Play remained visible and no player/loading state appeared. A second touch started playback. | One same-target touch/pen pointerup with no movement/cancel starts exactly one session; a following synthesized click must not double-start. Mouse and keyboard remain unchanged. |
| Notification artwork sharpness | The notification used matching station artwork but still looked low resolution. | Publish one cache-revisioned 512×512 Media Session candidate and physically recheck. If still soft, tune only the platform 512 derivative; do not add 1024 without new evidence. |
| Expanded/collapsed rail vinyl | Rail controls were correct, but the vinyl was too small. | Expanded vinyl diameter fills the expanded rail width, stays top/left aligned behind identity/actions, and retains that diameter when collapsed so only the clipped left arc is visible. |
| Station side controls | Previous and Next were beneath the correct side previews but noticeably too far below them. | Each control begins `16px` below and remains horizontally centered under its corresponding side card in portrait and landscape. |
| Non-Music constrained landscape | Some routes still rendered the active player as a bottom bar. | Every active player uses the rail in constrained landscape. Non-Music pages retain ordinary full-width vertical scrolling; overlays still clear the rail. |
| Landscape station stage | The station cards remained vertically compressed. | The stage uses the allocation from beneath the category pills to the usable bottom edge and removes the constrained-landscape 224px center-card cap while retaining controls in bounds. |
| Station looping | The Music station carousels stopped at their collection edges. | Previous/Next, keyboard, and carousel navigation wrap first↔last in normal and reduced-motion modes. Reduced motion remains static/zero-duration. Background behavior is unchanged. |
| Category-pill halo | A hard top/bottom edge clipped the Glow halo just outside the pill faces. | Provide internal vertical paint clearance with equal negative exterior margin so the full halo paints without increasing net layout height. |

### Deferred or not established by Round 3

- Installed-PWA, Bluetooth/headset, in-app Stop, background/lock-return,
  carrier-failure, real call, meeting-app, and Apple physical rows remain pending
  unless separately recorded in the core matrix.
- The Round 3 screenshots establish visual layout only; they do not establish
  CSS viewport, `visualViewport`, DPR, safe-area values, or notification bitmap
  decode dimensions. Capture those values in the next exact-preview pass.
- The physical first-touch evidence establishes a received press without a
  resulting application click/action on this Samsung configuration. It does not
  establish a generic Chrome/Chromium root cause. Deterministic
  pointerup-without-click coverage and another S24 pass remain required.

### Authoritative affected-UI summary

| Result | Count | Inventory |
| --- | ---: | --- |
| Accepted | 8 | Immediate inline art, Previous/Next identity, no timeline, slower vinyl, portrait fit, rail row order, observed overlay clearance, and reduced motion |
| Open/failed | 8 | First touch, notification sharpness, rail vinyl geometry, exact side-control spacing, global non-Music rail, landscape stage height, station loop, and pill glow clipping |

Physical Android acceptance remains open at `4ef5804b`. The exact-head first
touch is a confirmed failure. Matching notification art/no timeline and the
accepted controls/layout/reduced-motion rows are current truth. Lock-screen and
session-preference contracts remain pending rather than inferred from adjacent
observations.

## Authoritative current physical status — Samsung Round 4 trigger

The user physically retested immutable deployment
`https://massagelab-ghs8jf2mt-dsbteam.vercel.app/music` at exact commit
`c905db0458152659ef0ea2c0598a902c9631049e` on the recorded S24 Ultra and
Chrome 151. This section supersedes Round 3 only for behavior explicitly rerun
on this head. Nine screenshots were supplied:

- `Screenshot_20260817_061519_One UI Home.png`
- `Screenshot_20260817_061425_Chrome.png`
- `Screenshot_20260817_061403_One UI Home.png`
- `Screenshot_20260817_060431_Chrome.png`
- `Screenshot_20260817_060424_Chrome.png`
- `Screenshot_20260817_060414_Chrome.png`
- `Screenshot_20260817_060404_Chrome.png`
- `Screenshot_20260817_060349_Chrome.png`
- `Screenshot_20260817_060335_Chrome.png`

The shared attachment mount was unavailable when this evidence was written, so
their exact source-file raster dimensions were not independently extracted.
The screenshots are visual evidence only. CSS viewport, `visualViewport`, DPR,
screen dimensions, and safe-area values were not captured and remain required
on the next immutable candidate; they must not be inferred from attachment
pixels.

### Current exact-head core matrix reconciliation

| Historical row(s) | Round 4-trigger observation at `c905db04` | Authoritative current status |
| --- | --- | --- |
| 1 — Browser-tab notification ownership | One in-app Play touch started playback. The notification showed matching station artwork and no fabricated timeline. The user called the image acceptable but still softer than other audio notifications. | Pass for ownership, matching identity, and no timeline; platform-only clarity follow-up is triggered. |
| 2 — Installed PWA | Not run. | Pending |
| 3 — Lock-screen/system artwork | The supplied One UI media surface showed the active station artwork; the user's combined matching-art answer was affirmative but retained the same sharpness concern. | Pass for observed matching artwork; broader background/return behavior remains pending. |
| 4–5 — Notification Pause/Play | Controls were visible, but a complete current-head Pause→Play lifecycle row was not separately recorded. | Pending at current head; historical pass retained above. |
| 6 — Notification Stop | The One UI card exposed Previous, Pause/Play, and Next; no Stop control was shown. | Not exposed on the observed system card. |
| 7 — Bluetooth/headset | Not run. | Pending |
| 8 — Notification Previous/Next | Exposed controls changed title and artwork together, and no timeline appeared. Current-session interruption preference was not separately observed. | Partial: title/art/no-timeline passes; full preference contract remains pending. |
| 9 — In-app Stop | In-app Stop reached Stopped and retained station identity/player. The system-card dismissal timing was not separately recorded. | Partial: explicit in-app stop state observed; 60-second in-app retirement and immediate system dismissal require the next pass. |
| 10–16 — return/background, calls/meetings, carrier failure | Not run as complete rows. | Pending |

### Confirmed accepted affected behavior at `c905db04`

| Surface or behavior | Physical observation | Result |
| --- | --- | --- |
| First centered Play touch | One press started the station; the prior two-press failure did not recur. | Pass |
| Artwork identity | Carousel, vinyl, system notification, and observed One UI media artwork matched the active station. | Pass |
| Previous/Next identity | Title and artwork changed together. | Pass |
| Timeline | No fabricated duration/timeline appeared. | Pass |
| Reduced motion | Samsung reduced motion stopped the vinyl animation. | Pass |
| Global constrained-landscape rail | Active-player constrained landscape used the side rail on the tested Music and non-Music surfaces. | Pass |
| Rail action composition | Expanded controls remained in the approved two rows and action order. | Pass |
| Station loop | The Music station carousel wrapped rather than stopping at collection edges. | Pass |
| Landscape station fit and pill glow | The previously reopened landscape fill and category glow issues were not reported as failures in this pass. | Pass for observed presentation |
| Overlay clearance | Tested dialogs/menus/drawers/notices/popovers/tooltips were not observed hidden behind the rail. | Pass for observed surfaces |

### Open Round 4 affected behavior

| Surface or behavior | Physical observation | Approved acceptance |
| --- | --- | --- |
| Notification sharpness | Matching 512 artwork is acceptable but remains subjectively softer than comparable audio notifications. | Use only the exact revisioned 512 platform derivative: native SVG density `153.6`, exact 512 guard, mild default Sharp sharpening, and a fresh revision. Legacy routes and inline SVG remain unchanged. Recheck system art and Previous/Next; no contrast or 1024 without a new decision. |
| Notification favorite | The user requested the in-app heart on the system media card, analogous to a native music-app rating action. | Explicitly deferred to a future native Android wrapper. Do not map another Media Session action or publish a duplicate generic web notification. |
| Vinyl timing | The 16-second revolution remains uncomfortable. | One normal playing revolution takes 52 seconds; pause/stop freezes and reduced motion removes animation. |
| Rail vinyl clearance | Expanded/collapsed rail art visually touches the rail edge. | Use a 7px top/side inset; diameter is expanded rail width minus 14px and remains identical when collapsed, showing the clipped left arc. Portrait/bottom vinyl is unchanged. |
| Portrait center-card stability | The center card changes relative height when the bottom player expands versus collapses. | Use the current 192×224 (`7:6`) width-driven portrait ratio/clamps, independent of player state. Constrained landscape still fills its stage. |
| Touch-only station buttons | Visible Previous/Next consume side-card height on ordinary touch-only portrait. | Hide them in normal motion unless `(any-hover: hover) and (any-pointer: fine)` matches; always show under reduced motion. Listen for query changes. Hidden controls reserve no side-card height; swipe/drag/keyboard/loop remain available. |
| Stopped-player retention | The in-app player remains indefinitely after Stop. | Stop immediately clears generator/carrier/Media Session. Retain Stopped identity for 60,000ms, then clear identity and player/body markers. Any same/adjacent station restart cancels synchronously; unrelated UI/route actions do not cancel or extend. |

### Current affected-UI summary

| Result | Count | Inventory |
| --- | ---: | --- |
| Accepted | 10 | First touch, matching art, Previous/Next identity, no timeline, reduced motion, global rail, rail rows, station loop, observed landscape/glow fit, and observed overlay clearance |
| Open implementation/physical follow-up | 6 | Platform sharpness, 52-second motion, 7px rail inset, stable portrait ratio, conditional station buttons, and 60-second stopped retirement |
| Explicitly deferred | 1 | Native-only notification favorite action |

Physical Android acceptance remains open at `c905db04` only for the six Round
4 implementation rows and their regressions. Earlier unexecuted PWA,
Bluetooth/headset, call, meeting, carrier-failure, and Apple rows remain pending
and are not converted to passes by this affected UI retest.

## Authoritative current physical status — Samsung Round 4 final

The user physically accepted the affected Round 4 behavior on immutable
deployment `https://massagelab-1ia9a0227-dsbteam.vercel.app/music`, built from
exact merge commit `ca429f7f4c3cc1c40bac2a850be73a8226981c2e`, on the recorded
Samsung Galaxy S24 Ultra and Chrome `151.0.7922.137`. This section supersedes
the Round 4-trigger section for the behaviors explicitly listed below. It does
not convert unexecuted PWA, Bluetooth/headset, call, meeting, carrier-failure,
current-session preference, or Apple rows into passes.

Three new screenshot filenames were supplied as visual evidence:

- `Screenshot_20260817_185214_Chrome.png`
- `Screenshot_20260817_183852_Chrome.png`
- `Screenshot_20260817_183833_Chrome.png`

The shared `\\tsclient\Local Storage` attachment path initially returned
operating-system error 67, but the user then supplied the images directly in
the conversation. Their source rasters are `1492×667`, `1492×667`, and
`720×1452` in the filename order above. Android Chrome treated the requested
`javascript:` address-bar diagnostic as a Google search, so no CSS viewport,
`visualViewport`, screen-size, DPR, or safe-area values are recorded or
inferred from those attachment pixels. That evidence-only omission does not
override the user's explicit physical observations.

### Final affected-behavior acceptance

| Surface or behavior | Physical observation at `ca429f7f` | Result |
| --- | --- | --- |
| First centered Play touch | The first touch starts playback. | Pass |
| Notification artwork and Previous/Next identity | Artwork sharpness looks good; notification artwork remains paired with the correct station through Previous and Next. | Pass |
| Vinyl timing and reduced motion | Normal motion completes one revolution in 52 seconds; reduced motion remains static. | Pass |
| Rail vinyl clearance | The vinyl has approximately 7px clearance from the rail edge. | Pass |
| Portrait center-card stability | The center-card height remains unchanged when the player rail expands or collapses. | Pass |
| Touch-only station controls | Previous/Next buttons are hidden on touch-only normal-motion devices and remain available when reduced motion or a fine pointer applies. | Pass |
| Station looping | The station carousel loops in both directions. | Pass |
| Global constrained-landscape rail | Constrained landscape uses the side rail on the tested Music and non-Music surfaces. | Pass |
| Stopped-player retirement | After explicit Stop, the rail disappears at 60 seconds; restarting before the deadline cancels removal. | Pass |

The six implementation/physical follow-ups opened by the Round 4 trigger are
therefore closed: notification sharpness, 52-second motion, 7px inset, stable
portrait card height, conditional touch controls, and 60-second stopped-player
retirement. The earlier accepted first-touch, identity pairing, loop, global
rail, no-timeline, and reduced-motion behavior also remains accepted on this
exact candidate.

The requested notification Favorite/heart remains explicitly deferred to a
future native Android wrapper. Chrome/One UI did not expose a web Media Session
surface that can truthfully add that native rating action, so no substitute web
notification or unrelated action mapping is claimed.

### Remaining platform scope

- Installed-PWA behavior, Bluetooth/headset controls, real calls, meeting apps,
  controlled carrier failure, and physical Apple behavior remain pending.
- Notification Stop was not exposed on the observed One UI media card.
- Lock-screen/background-return lifecycle and current-session interruption
  preference preservation were not separately rerun as complete rows.
- The screenshot rasters are recorded above. The browser viewport/DPR receipt
  remains unavailable because the address-bar diagnostic became a search; no
  CSS viewport or device metrics are inferred from the raster dimensions.

## Apple boundary

The branch contains a portable WebKit implementation and focused engine smoke coverage. Physical iPhone/iPad notification, lock-screen, background, and real-call behavior remain pending until Apple hardware or an authorized remote-device service is available. This report does not certify iOS, iPadOS, or Safari physical-device behavior.
