# Carousel Presentation Sources

Verified: 2026-07-20

This ledger covers the third-party presentation ideas reviewed in MassageLab's development-only Carousel Lab and records the boundary between those references and the internally owned production presentations. Public CodePens are MIT licensed under CodePen's public-Pen licensing policy: https://blog.codepen.io/documentation/licensing/

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
- Tuning storage uses `massagelab-carousel-lab-v4`. Background Existing resolves five approved available-width profiles without writing on resize and keeps a persisted manual fallback; Music Station sizing is fixed across devices.
- User review selected the production-style Existing presentation for Backgrounds and the production Clock/Chimer Background Picker geometry for Music Stations. Cover Flow and 3D Carousel are no longer exposed for either surface.
- Station loop eligibility depends on having at least three real items rather than the nearby render radius; station identities, categories, playback, and favorites remain unchanged.
- Background Existing exposes responsive sizing plus a manual card-width/card-height fallback. Music Stations remain 192×224 with 193-pixel surrounding previews on every screen. Distant layout shells remain geometry-only and visually transparent.
- Background Select and Favorite actions occupy the upper preview corners; Select uses the shared Glow treatment and Favorite uses the same Glow material with the CTA purple palette. A selected Favorite fills its glyph purple and animates a chromatic-metal trace on the icon path rather than around the button.
- The retained Station sample mirrors that Glow treatment for Play/Stop and Favorite over the artwork's upper corners. Its title and clamped summary occupy a deeper lower-artwork overlay and open an accessible dialog containing the complete description and source/license details.
- Lab Background preview copy omits the exact `MassageLab` provider label and the implementation-oriented Shader/Video tags; catalog metadata remains unchanged.
- Track 3A remains available for review and tuning on `/dev/buttons`; Track 3B ships the accepted Background Existing and Music Background Picker-style presentations through shared internal production components.
- Cover Flow and 3D Carousel remain unexposed reference adaptations. Their third-party mechanics and source assets are not imported into the production runtime.
