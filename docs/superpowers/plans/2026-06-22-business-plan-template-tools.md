# Business Plan Template Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the student business-plan template into practical public tools under `/tools/business-planner`.

**Architecture:** Add small, browser-local tools that complement the existing income planner without creating new database tables or storing clinical/client data. Keep calculator math in a shared JS module with Node tests, keep typed worksheet state in `localStorage`, and wire every public route through the existing SEO, navigation, and browser-route contracts.

**Tech Stack:** Next.js App Router, React client components, existing `AppSurface` UI primitives, localStorage, Node test runner, Playwright route smoke tests.

---

## Scope

- [ ] Add `/tools/business-planner/break-even` for startup costs, expenses, funding, tax set-aside, and session break-even.
- [ ] Add `/tools/business-planner/launch-checklist` for legal, license, location, management, policy, and presentation tasks.
- [ ] Add `/tools/business-planner/service-menu` for services, pricing, cancellation/no-show policies, and privacy steps.
- [ ] Add `/tools/business-planner/plan-outline` for mission, purpose, operations, marketing, finances, profile, and resume notes.
- [ ] Add `/tools/business-planner/add-on-profit` for retail/product/add-on profit estimates.
- [ ] Update `/tools/business-planner`, `/tools`, public SEO route metadata, navigation, source guards, and public browser smoke coverage.

## Boundaries

- No new Prisma model or migration.
- No hosted clinical, intake, SOAP, client, or wellness payloads.
- Anonymous users can use all tools.
- Typed or checked worksheet state persists in the current browser only for this branch.
- Signed-in account sync can be added later after the tool set stabilizes.

## Validation

- Run focused Node tests for business-plan calculations and route/source contracts.
- Run `npm run typecheck`, `npm run lint`, and `git diff --check`.
- Run focused Playwright public-route smoke coverage for the business planner routes.
- Run `npm run build` before opening a PR or merging this branch.
