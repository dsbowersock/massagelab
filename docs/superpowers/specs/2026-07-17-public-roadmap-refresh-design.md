# Public Roadmap Refresh Design

**Date:** 2026-07-17  
**Status:** Approved for implementation planning  
**Surface:** Public `/roadmap` page

## Summary

Replace the current date- and status-heavy public Roadmap with a durable product-vision page. The new page presents MassageLab as an equal portfolio of five long-term product tracks, distinguishes what is available now from the long-term direction of each track, and treats privacy, accessibility, consent, and user control as a shared foundation.

The page must not act as a changelog, sprint board, prioritized backlog, or delivery schedule. It will retain membership and donation calls to action, but it will explain that support funds the overall mission rather than buying influence over feature order.

## Problem

The existing `/roadmap` page mixes several different jobs:

- recent release notes with dates;
- current alpha and regression work;
- longer-term product areas;
- compliance prerequisites; and
- fundraising calls to action.

That structure becomes stale quickly and exposes tactical work that belongs in the canonical internal project state and log. It also makes section order look like delivery priority even when no such commitment exists.

The public Roadmap should instead explain the larger goals of MassageLab in language that remains useful as individual implementation projects change.

## Goals

- Present the larger MassageLab product vision without dates or priority order.
- Give five product tracks equal visual and editorial weight.
- Show both current value and long-term intent for every track.
- Keep claims about available capabilities grounded in current product state.
- Make privacy, accessibility, informed consent, and user control foundations across the whole portfolio.
- State honestly that hosted sensitive-data capabilities depend on security, compliance, legal, and operational readiness.
- Retain clear routes to explore tools, view memberships, and donate.
- Preserve the stable public URL at `/roadmap`.

## Non-goals

- Publishing the current feature backlog, sprint, branch order, or tactical work from the six-track planning initiative.
- Adding dates, phases, percentages, delivery windows, or priority rankings.
- Promising that long-term capabilities will ship.
- Creating a changelog or recently shipped section.
- Building an interactive voting, request, or feature-status system.
- Adding a data model, API, CMS, or account-specific Roadmap state.
- Rewriting the internal `docs/roadmap.md` evidence document as part of this public-page change.

## Information Architecture

### 1. Vision hero

The hero introduces MassageLab as a connected platform for learning, wellness, therapeutic practice, professional records, and focused ambient experiences.

It must explicitly say that the tracks are an equal portfolio and are not shown in release order. It must avoid the existing phrases "Current alpha direction," "Recently shipped," and "Current alpha focus."

Primary and supporting actions:

- **Explore tools** links to the current public tools discovery surface.
- **View memberships** links to pricing/memberships.
- **Donate** links to the existing donation path.

### 2. Shared foundation

A prominent callout before the portfolio establishes principles that apply to every track:

- privacy and user control;
- accessible experiences;
- informed consent for sharing;
- local-first handling of sensitive professional records; and
- security, compliance, legal, and operational gates before hosted sensitive-data capabilities launch.

The copy must distinguish direction from commitment. Hosted sensitive-data features are possibilities that depend on the documented gates, not scheduled promises.

### 3. Product portfolio

The portfolio contains five equally weighted cards. Card order supports reading flow only and does not convey priority.

Every card follows the same content contract:

1. Track name and icon.
2. One-sentence purpose.
3. **Available now** with a concise, verified summary.
4. **Long-term direction** with outcome-oriented intent.
5. Two or three representative capability labels.

The two status sections use headings and prose rather than progress badges, completion colors, or phase markers.

### 4. Closing invitation

The closing section invites visitors to explore the existing tools and support the larger mission through memberships or donations.

It must not imply that financial support determines Roadmap priority or guarantees delivery of a particular capability.

## Product Tracks

### Education & Anatomy

**Purpose:** Help massage students and professionals build durable anatomy knowledge through active study.

**Available now:** Sourced anatomy flashcards, individual Anatomime practice, shared classroom games, and saved mastery progress.

**Long-term direction:** Broader learning pathways, more reviewed anatomical media, stronger instructor tools, and carefully chosen spatial learning experiences.

**Representative capabilities:** Adaptive study, anatomy games, classroom sessions.

### Wellness Tools

**Purpose:** Give people approachable tools for relaxation, body awareness, and consistent wellness routines.

**Available now:** Chimer, Clock, guided breathing, Quick Log, body-sensation tracking, range-of-motion activities, and personal reminders.

**Long-term direction:** More connected routines, clearer personal patterns, and user-controlled ways to carry useful context between wellness experiences.

**Representative capabilities:** Timed sessions, breathing exercises, self-reflection and pattern tracking.

### Therapist & Practice Tools

**Purpose:** Reduce the administrative load of running an independent massage practice or small team.

**Available now:** Practice scheduling, public booking, services and providers, calendar workflows, team roles, and business-planning tools.

**Long-term direction:** A more connected workspace for practice operations, client relationships, team coordination, and sustainable business growth.

**Representative capabilities:** Scheduling and booking, practice planning, team coordination.

### Local-First Records

**Purpose:** Help therapists manage sensitive professional records while keeping control close to the practitioner.

**Available now:** An encrypted browser vault for intake forms, SOAP notes, journals, and range-of-motion records, including local intake-to-SOAP continuity.

**Long-term direction:** Stronger cross-device continuity, optional consent-based sharing, and therapist-reviewed assistance such as transcription or drafting, but only when the required safeguards are ready.

**Representative capabilities:** Encrypted records, therapist-reviewed documentation, user-controlled transfer and sharing.

### Audio & Ambient Experiences

**Purpose:** Create calm, focused environments that can accompany sessions, study, rest, or other MassageLab tools.

**Available now:** A generative music catalog, persistent sitewide playback, clocks and timers, and customizable animated backgrounds.

**Long-term direction:** More expressive ambient environments, deeper playback and visual customization, and smoother connections between audio, timing, and wellness experiences.

**Representative capabilities:** Generative audio, ambient visuals, cross-tool playback.

## Visual and Responsive Design

- Reuse the existing MassageLab page shell, surface, typography, button, and callout systems.
- Give every product card the same component structure and visual emphasis.
- Use a distinct, relevant icon for each track without turning icons into status signals.
- Render one column on narrow phones, two columns where space supports them, and a balanced multi-column layout on wide screens.
- Avoid a layout that leaves one card looking subordinate. On wide screens, the fifth card may span or center deliberately so it retains equal weight.
- Keep section order, heading hierarchy, and card reading order coherent at every breakpoint.
- Do not use timelines, progress meters, numbered phases, or roadmap lanes.

## Accessibility and Content Semantics

- Keep one page-level `h1`, followed by ordered section headings and one heading per product track.
- Do not communicate "available" versus "direction" through color alone.
- Ensure icon treatments are decorative or have appropriate accessible names without duplicating visible headings.
- Preserve visible keyboard focus and existing shared-button interaction behavior.
- Keep line lengths and card copy concise enough for phone reading and zoomed layouts.
- Use plain language for compliance boundaries; avoid implying certifications or hosted protections that do not exist.

## SEO and Public Messaging

Update the Roadmap metadata from "current product direction" wording to a timeless description of MassageLab's product vision across education, wellness, practice support, local-first records, and ambient experiences.

The metadata must not include dates, phases, or claims of scheduled delivery.

## Implementation Surface

Expected implementation changes are narrow:

- replace the content model and composition in `app/roadmap/page.tsx`;
- update Roadmap metadata in `lib/seo.js`;
- add or revise focused public-route/content assertions in the existing test suite; and
- record the completed public-page change in the canonical project log/state as appropriate.

No backend, database, entitlement, or client-state work is required.

## Validation Contract

Automated checks should confirm:

- all five approved product-track headings render;
- every track exposes both "Available now" and "Long-term direction";
- the page says track order does not indicate priority or delivery sequence;
- the shared privacy and compliance foundation is present;
- Explore tools, View memberships, and Donate use the existing destinations;
- the old "Recently shipped" and "Current alpha focus" sections are absent;
- the old dated copy is absent; and
- Roadmap metadata uses the approved timeless positioning.

Implementation validation should include focused tests plus the repository's standard lint, typecheck, test, and build commands in proportion to the final diff.

## Approved Decisions

- Use per-track current and future summaries rather than a pure-vision page or one page-level status summary.
- Retain both memberships and donations as secondary support paths.
- Use outcome-focused cards with representative capabilities.
- Treat privacy and compliance as a foundation across every track, not a separate product track.
- Use the product portfolio grid rather than audience journeys or a long-form narrative.
- Use five equally weighted tracks with no dates or priority order.
