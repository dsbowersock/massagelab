# Technical SEO Foundation Plan

## Goal

Make MassageLab ready for public-alpha discovery by replacing the global private-alpha `noindex` posture with production-safe public metadata, sitemap, robots, and schema foundations while preserving noindex protection for private, auth, booking, API, shared-code, and local clinical subroutes.

## Scope

- Add one shared SEO route contract for public indexable pages.
- Generate `robots.txt` and `sitemap.xml` from that contract.
- Keep Vercel preview and local development deployments blocked from indexing.
- Add canonical, Open Graph, Twitter, and robots metadata to public pages.
- Add noindex metadata layouts for private route families and local clinical subroutes.
- Add site-level Organization, WebSite, and WebApplication JSON-LD.
- Add a focused test that guards the indexing contract.

## Non-Goals

- Do not add a blog, CMS, long-form content program, paid keyword strategy, or Search Console automation in this branch.
- Do not index user-created flashcard decks, public booking URLs, shared Anatomime room codes, auth flows, account surfaces, admin routes, APIs, or PHI-bearing local-record subroutes.
- Do not change PHI storage, account data, Neon usage, billing, or route behavior.

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `git diff --check`
