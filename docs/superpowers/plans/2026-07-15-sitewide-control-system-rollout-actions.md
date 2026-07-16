# Sitewide Control System Rollout — Ordinary Actions

**Status:** Ready for visual review on `codex/sitewide-control-system-rollout-actions`
**Approved review checkpoint:** `38146ec`
**Scope:** S6 ordinary action buttons only

## Approval Boundary

The complete `/dev/buttons` review matrix is approved for production rollout except for the Wellness anatomical map. The map remains a review-only prototype and is excluded from S6 through S9 until its artwork, region geometry, and interaction model receive separate approval.

## Frozen Consumer Manifest

| Route | Included ordinary actions | Excluded from this batch |
| --- | --- | --- |
| Chimer setup | Apply/use preset, save preset, test alert, start actions, Back, Continue | Quick-duration presets, sync controls, timer face, ranges, selects, and color internals |
| Anatomime | Primary, secondary, and destructive actions in the landing, local game, host, and player clients | Region buttons, term cards, choice groups, order controls, and gameplay cards |
| Pricing | Donation glow/flicker composition | Membership structure and non-action surfaces already using shared primitives |
| Account | Audit only; existing ordinary actions already use shared `Button` | Fields, toggles, and surfaces belong to later family batches |

## Implementation Contract

- Route code chooses `variant`, `tone`, `size`, and `effect`.
- `components/ui/button.tsx` owns height, radius, padding, depth, focus, disabled state, press motion, and haptics.
- Route classes may retain layout responsibility such as width or flex participation, but not button construction.
- Chimer Continue remains the shared default orange face inside the approved always-on metal ring.
- Chimer setup actions use the shared setup tone.
- Anatomime ordinary actions use a thin semantic alias over shared Button; card-like and choice controls remain untouched.
- Pricing donation actions use shared `tone="pricing"` plus `effect="glowFlicker"`.

## Validation

Run `npm run typecheck`, `npm run lint`, `npm run test`, and `git diff --check`. Review `/chimer`, `/anatomime`, `/anatomime/join`, and `/pricing` at desktop and mobile widths in light and dark themes. Do not include the Wellness map in the rollout approval evidence.
