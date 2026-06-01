# Role-Aware Module Surfaces and Sidebar

## Goal

Create the next-branch handoff for role-aware module surfaces and sidebar behavior.

MassageLab should have a basic public interface for non-logged-in users, a signed-in account surface for authenticated users, and a sidebar/navigation model that reflects the user's verified roles, practice roles, and feature entitlements. This plan captures the structure we discussed without inventing full role dashboards before the product details are ready.

Suggested branch: `codex/role-aware-module-surfaces`.

## Current State

- The privacy-first records branch implements the local professional-record vault and therapist documentation gate.
- `/account` already has signed-out and signed-in surfaces.
- `/notes` keeps documentation tools visible but gates actual clinical record use behind `therapist_documentation_tools`.
- Account roles exist: `USER`, `STUDENT`, `LICENSED_THERAPIST`, `CLIENT`, `EDITOR`, `ANATOMY_ADMIN`, and `ADMIN`.
- Practice roles exist: `OWNER`, `THERAPIST`, and `STAFF`.
- Membership/feature entitlements exist and should remain feature-key driven, for example `chimer_custom_colors`, `therapist_documentation_tools`, `calendar_full_scheduling`, and `calendar_team_scheduling`.
- `lib/navigation.js` already has future-facing audience metadata, but the app sidebar currently renders the same primary navigation for every user.
- `components/sidebar/sidebar.tsx` passes only basic user identity to the sidebar client; it does not yet pass role, entitlement, or practice membership context.

## Product Direction

Every major module should be able to expose at least these layers:

1. Anonymous/public surface.
2. Signed-in base-user surface.
3. Role/capability-aware surface.

This branch should build the structural layer and honest empty/planned states. It should not invent detailed dashboards for roles whose workflows are still undecided.

## Role and Permission Dimensions

Use these dimensions together rather than treating one enum as the whole access model:

- Auth state: anonymous vs signed in.
- Account roles: global account-level roles and verification status.
- Membership entitlements: feature keys derived from Free, Student, Supporter, Therapist, and Team/Practice access.
- Practice roles: per-practice roles such as owner, therapist, and staff.
- Local privacy state: clinical/professional-record tools may be available, but their record contents still stay local-first and passphrase-gated.

Do not branch behavior on displayed plan names. Use feature keys and verified roles.

## Desired Surface Baseline

### Anonymous

- See public site pages, support, pricing, roadmap, about pages, public booking, Chimer basic mode, and public/local education or anatomy tools that are intentionally public.
- See the `/notes` dashboard as a preview of available documentation tools, but direct clinical tools should route to sign-in or membership-required gates.
- Use local-only account settings where currently supported.
- Never trigger account preference sync or clinical sync.

### Signed-In Base User

- See account home, profile, security, app settings, membership/billing, support, and safe non-PHI preference sync.
- See available public tools and any features unlocked by entitlements.
- Do not see therapist documentation as usable unless `therapist_documentation_tools` is present.
- Do not see admin or practice-management navigation without the matching role/capability.

### Student

- Keep student access as an internal access state, not a Stripe-backed paid plan.
- Surface credential/student verification, education/anatomy learning paths when those modules are ready, and upgrade path context for future therapist access.
- Do not unlock professional-record tools solely from student status.

### Client

- Future client surfaces should focus on booking status, profile/contact controls, client-owned wellness records, and consent-managed sharing.
- Do not expose therapist professional records to clients.
- Keep client-owned wellness data separate from therapist professional-record vault data and from any future therapist remote viewing bridge.

### Licensed Therapist / Therapist Membership

- Surface local-first SOAP, intake, journal, and ROM tools through the professional-record vault.
- Surface therapist defaults, own calendar/schedule workflows, intake handoff continuity, and local backup/export guidance.
- Keep professional records browser-local unless hosted clinical storage passes the documented compliance gates.

### Team/Practice

- Surface practice management, people/team, service catalog, availability, booking settings, requests, waitlist, provider capacity, and team scheduling.
- Practice owner/staff/therapist differences should come from practice role permissions, not global plan labels.
- A solo therapist with a Team/Practice membership may see both therapist and practice-management entry points where permitted.

### Admin and Content Roles

- `ANATOMY_ADMIN` and `ADMIN` may see anatomy administration.
- `ADMIN` may see account/platform administration when those routes exist.
- `EDITOR` should remain scoped to future content workflows until explicit permissions are defined.

## Sidebar and Navigation Implementation Shape

Add a role-aware navigation resolver instead of hard-coding role checks inside the sidebar components.

Recommended direction:

- Extend `getAppSidebarData()` to include non-PHI session context: account roles, role verification statuses, capabilities, membership feature keys, and a summarized practice role context if needed.
- Replace static `primaryNavigationGroups` consumption with a resolver such as `resolveNavigationGroups({ authState, accountRoles, capabilities, practiceRoles })`.
- Keep route descriptors in one model with metadata for auth requirement, feature requirement, account-role requirement, practice-role requirement, and planned/hidden status.
- Filter primary sidebar groups, calendar quick actions, account menu actions, and admin links through the same resolver.
- Keep public navigation stable for anonymous users.
- Preserve visible previews only where product copy intentionally says a tool exists but is gated, such as `/notes`.
- Avoid showing placeholder modules in the sidebar unless the destination has a useful planned-state surface.

## Module Contract

Each module should eventually declare:

- Public route/surface behavior.
- Signed-in route/surface behavior.
- Required account role or feature entitlement, if any.
- Required practice role, if practice-scoped.
- Sidebar group and icon.
- Planned-state copy when the destination is intentionally visible before the full workflow exists.
- Privacy boundary: local-only, account-safe cloud data, booking/contact data, future client-owned wellness data, or prohibited hosted professional-record data.

## Non-Goals

- Do not add hosted clinical storage or clinical sync.
- Do not move professional-record vault data into account preferences, Prisma, API routes, or URLs.
- Do not create full dashboards for every role before the workflows are defined.
- Do not add a broad database migration unless a specific role-surface requirement truly needs it.
- Do not rename existing membership levels or practice roles just to support navigation.

## Tests

Add focused tests for:

- Anonymous sidebar/navigation.
- Signed-in base `USER` sidebar/navigation.
- `SUPPORTER` feature access without therapist documentation.
- `STUDENT` access without therapist documentation.
- `CLIENT` access without therapist professional-record tools.
- Therapist documentation visibility when `therapist_documentation_tools` is present.
- Team/Practice scheduling and practice-management entries when team scheduling/practice roles allow them.
- Practice `OWNER`, `THERAPIST`, and `STAFF` differences for calendar actions.
- `ANATOMY_ADMIN` and `ADMIN` admin navigation.
- Source guards that prevent clinical records from being written to account preferences, API sync, Prisma, or legacy plaintext localStorage keys.

## Acceptance Criteria

- The app has a documented and tested navigation resolver for anonymous, signed-in, and role/capability-aware states.
- The sidebar changes based on verified roles, feature entitlements, and practice roles.
- Every visible module route has an appropriate public, signed-in, gated, or planned-state surface.
- `/notes` continues to show tools while gating use through `therapist_documentation_tools` and the local professional-record vault.
- Clinical/professional-record data remains local-first and out of hosted sync paths.
- Project docs note which role surfaces are structural placeholders versus implemented workflows.
