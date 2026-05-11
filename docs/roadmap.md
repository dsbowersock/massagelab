# MassageLab Roadmap

This file captures the branch-ready post-Sentry work so it can be resumed without re-reading planning chat history.

## Sentry Completed

Sentry error and trace monitoring is complete and deployed. Keep Session Replay, User Feedback, and Logs disabled until MassageLab has route-by-route privacy review, Sentry project scrubbing rules, and a written policy for clinical/local-first pages.

## Branch Order

1. `codex/navigation-ia`
2. `codex/chimer-animation-polish`
3. `codex/generative-music-spike`
4. `codex/refactor-*` only when a targeted cleanup directly supports a feature branch

## Navigation IA

Goal: make the app menu leaner and easier to scan without building full role-specific product modes yet.

- Use the shadcn `SidebarProvider`/`Sidebar` composition as the app shell.
- Group primary navigation into Home, Tools, Documentation, and Games.
- Keep Education and News as model-only placeholders until they have visible routes.
- Keep User Support and Roadmap as secondary sidebar links.
- Keep Account, Security, Settings, and sign-in/sign-out actions in the account menu.
- Keep sidebar placement to left/right only.
- Add route/audience metadata for future Therapist, Practice, and Client views.
- Do not build a Therapist/Practice/Client switcher in this branch.
- Verify expanded, collapsed, mobile sheet, left/right, keyboard, active-route, mini-calendar, and Chimer hide states.

## Calendar Creation Flows

The current sidebar only exposes calendar navigation affordances. Future calendar work needs separate creation flows by user type:

- Appointment flow: therapists and practice staff create or confirm service appointments with client, therapist, service, location/timezone, start/end, status, and reminder policy.
- Client request flow: clients request available appointment slots without seeing staff-only practice calendar details.
- Personal event flow: therapists block non-clinical time that affects availability without creating clinical appointment records.
- Class flow: practice users create group classes with capacity, enrollment status, instructor, room/resource, and client-facing visibility.
- Reminder flow: practice users create operational reminders tied to appointments, clients, classes, or personal tasks without storing clinical note content in reminder payloads.

These flows remain roadmap-only until the calendar product defines role permissions, audit expectations, and notification behavior.

## Chimer Animation Polish

Goal: improve the clock/timer switch and surrounding Chimer polish while preserving treatment-room calm and readability.

- Start with the existing CSS/keyframe swap animation in Chimer.
- Keep `prefers-reduced-motion` support.
- Polish state changes that already exist: timer/current-time swap, controls fade, settings panel open/close, completion/alert state, and moving background transitions.
- Add `motion` only if CSS becomes awkward for state-driven layout animation.
- Do not add GSAP, Theatre.js, Anime.js, Animate.css, or Animista output unless a later interaction needs timeline-level control.
- Verify desktop and mobile screenshots, reduced-motion behavior, and no text overlap at large font sizes.

## Generative Music Spike

Goal: prove whether Alex Bainter's Generative.fm pieces can run reliably inside MassageLab before exposing a real music product.

- Keep the first implementation hidden from main navigation.
- Use `/browse`, `components/providers/music-provider.tsx`, `lib/generators.ts`, and `types/music.ts` as the likely spike surface.
- Verify package viability for `@generative-music/*`, `@generative-music/web-library`, `@generative-music/web-provider`, Tone.js, and sample access.
- Confirm sample hosting and origin constraints before relying on `samples.generative.fm`.
- Confirm MIT licensing, bundle size, browser autoplay restrictions, start/stop cleanup, and audio context lifecycle.
- Build only a minimal proof of concept before planning library, favorites, recently played, or persistent player-bar UI.

## Refactoring Rule

Refactor only when it preserves current behavior and makes the next branch safer, clearer, or easier to test.

Good refactor branches:

- `codex/refactor-nav-model` before navigation work if route definitions are duplicated.
- `codex/refactor-chimer-display` if animation work needs smaller Chimer display boundaries.
- `codex/refactor-music-types` if the spike reveals unclear generator/player interfaces.

Avoid broad branches like `codex/refactor-app` or `codex/cleanup`. They are hard to review and likely to mix unrelated behavior changes.
