# Carousel Prototype Sources

Verified: 2026-07-20

This ledger covers the third-party presentation ideas adapted only for MassageLab's development-only Carousel Lab. Public CodePens are MIT licensed under CodePen's public-Pen licensing policy: https://blog.codepen.io/documentation/licensing/

## Cover Flow

- Source: https://codepen.io/jh3y/pen/ZEqNVxx
- Source title: CSS Scroll Driven Animation Cover Flow [Infinite Edition ]
- Author: jh3y / Jhey
- License: MIT through CodePen's public-Pen policy
- Retained mechanics: center lift, piecewise horizontal sweep, inner-edge Y rotation, scale/opacity falloff, animated stacking, source-reference side rotation, and optional artwork reflection
- MassageLab adaptation: React lifecycle, existing Embla input/controller, scoped CSS Module, real Background and Music Station cards, described app-native tuning controls, and artwork-only reflection
- Omitted: source images, demo checkboxes, global styles, automatic advancement, and text/action reflection

## 3D Carousel

- Source: https://codepen.io/jh3y/pen/PovoorJ
- Source title: CSS Scroll-Driven Image Carousel
- Author: jh3y / Jhey
- License: MIT through CodePen's public-Pen policy
- Retained mechanics: one shared rotating cylinder, source-derived radius, configurable ring slots and perspective, card-width masks, and scroll-linked ring transforms
- MassageLab adaptation: React lifecycle, existing Embla input/controller, bounded nearby mounts, scoped CSS Module, imperative CSS variables, and a requestAnimationFrame-coalesced transform fallback
- Omitted: source images, GSAP, ScrollTrigger, Tweakpane, global styles, vertical mode, backface demo behavior, and automatic advancement

## Runtime Boundary

- No iframe or runtime source fetch is used.
- No new runtime dependency is added.
- Nearby Background cards may play their real muted preview videos inside the bounded mount window; reduced motion and document visibility still stop playback.
- Tuning storage uses the review-reset key `massagelab-carousel-lab-v3` so the user's screenshot-derived defaults are shown instead of stale earlier tuning.
- Music Stations now includes a fourth, station-only Background Picker sample that reuses the production Clock/Chimer radial presentation without copying another external source.
- Station loop eligibility depends on having at least three real items rather than the nearby render radius; station identities, categories, playback, and favorites remain unchanged.
- Background card Select and Favorite actions occupy the upper preview corners in all three Background samples. Cover Flow reflections fade from the card edge and side-card reflections end after 32% of the reflected artwork height.
- Track 3A is review-only on `/dev/buttons`.
- Production use requires a separate Track 3B design after two explicit winner decisions.
