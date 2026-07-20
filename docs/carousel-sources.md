# Carousel Prototype Sources

Verified: 2026-07-20

This ledger covers the third-party presentation ideas adapted only for MassageLab's development-only Carousel Lab. Public CodePens are MIT licensed under CodePen's public-Pen licensing policy: https://blog.codepen.io/documentation/licensing/

## Cover Flow

- Source: https://codepen.io/jh3y/pen/ZEqNVxx
- Source title: CSS Scroll Driven Animation Cover Flow - Infinite Edition
- Author: jh3y / Jhey
- License: MIT through CodePen's public-Pen policy
- Retained ideas: center emphasis, side-card Y rotation, scale falloff, stacking, optional artwork reflection
- MassageLab adaptation: React, existing Embla, scoped CSS Module, real Background and Music Station cards
- Omitted: source images, demo controls, global styles, automatic animation, and text/action reflection

## 3D Carousel

- Source: https://codepen.io/jh3y/pen/PovoorJ
- Source title: CSS Scroll-Driven Image Carousel
- Author: jh3y / Jhey
- License: MIT through CodePen's public-Pen policy
- Retained ideas: perspective arc, depth, center emphasis, edge falloff, and scroll-linked transforms
- MassageLab adaptation: React, existing Embla, bounded nearby cards, scoped CSS Module, and imperative CSS variables
- Omitted: source images, GSAP, ScrollTrigger, Tweakpane, global styles, vertical mode, backface demo behavior, and automatic animation

## Runtime Boundary

- No iframe or runtime source fetch is used.
- No new runtime dependency is added.
- Track 3A is review-only on `/dev/buttons`.
- Production use requires a separate Track 3B design after two explicit winner decisions.
