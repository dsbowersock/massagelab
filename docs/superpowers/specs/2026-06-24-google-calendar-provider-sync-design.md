# Google Calendar Provider Sync Design

## Goal

Implement Google Calendar sync for provider-side practice scheduling so therapists, owners, and staff can see provider Google busy time inside MassageLab, avoid booking conflicts, and publish MassageLab-originated scheduling events to a dedicated MassageLab Google calendar.

## Approved Scope

- Provider: Google Calendar first.
- User side: provider-side only. Clients do not connect calendars in this version.
- Outbound calendar: create or reuse a dedicated Google calendar named `MassageLab`.
- Sync posture: availability-first, not full personal event mirroring.
- Privacy posture: scheduling metadata only. No SOAP notes, intake content, pain maps, transcripts, diagnosis, treatment notes, client email, phone, address, or other PHI-bearing detail is imported from Google or exported to Google.

## Source Context

MassageLab already has a cloud-backed practice calendar centered on `CalendarEvent` with specialized detail rows for appointments, personal blocks, classes, reminders, services, resources, availability, audit logs, and notification intents. `docs/wiki/calendar-creation-flows.md` records that external Google, Apple, and Outlook sync is a future integration track and that calendar sync must store scheduling metadata only. `docs/project-state.md` and `docs/project-log.md` preserve the local-first PHI boundary.

Google Calendar API docs current during design review:

- Scopes: https://developers.google.com/workspace/calendar/api/auth
- Incremental sync: https://developers.google.com/workspace/calendar/api/guides/sync
- Push notifications: https://developers.google.com/workspace/calendar/api/guides/push
- Event insert: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- Calendar insert: https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert

## Product Behavior

### Connection

Providers connect Google from a calendar sync settings surface. The connection flow is separate from Google sign-in so users explicitly consent to calendar access. If the user already signs in with Google, the calendar connection still requests calendar scopes through a dedicated connect action rather than silently expanding sign-in privileges.

The connection belongs to the MassageLab user account, not to a practice. A connected provider can use the same Google connection across practices where they are a therapist, owner, or staff member, but each practice calendar view only uses the provider's busy blocks when the provider is part of that practice.

### Inbound Sync

MassageLab reads selected Google calendars as busy context. Imported Google events appear as external busy blocks on the provider calendar and block MassageLab scheduling for that provider.

Stored inbound fields are intentionally minimal:

- connection id
- source calendar id
- external event id and etag or updated marker
- starts at
- ends at
- timezone or all-day date metadata needed to reconstruct the busy range
- busy/free transparency
- cancelled/deleted state
- raw provider status needed for sync logic
- timestamps for sync health

MassageLab does not persist Google event summary, description, location, attendee list, organizer, conference link, reminders, attachments, or recurrence detail text. Recurring events are expanded into concrete busy windows inside the sync horizon instead of storing full recurrence content.

### Outbound Sync

On connect, MassageLab creates or finds a secondary Google calendar named `MassageLab` owned by the connected Google account. MassageLab-created appointment, class, and personal block events write to that dedicated calendar. Reminder events do not write to Google in this version because they do not block availability and are operational inside MassageLab.

Outbound Google event text is deliberately generic:

- title: `MassageLab appointment`, `MassageLab class`, or `MassageLab blocked time`
- time range and timezone
- optional service-level label only when it is not client-specific
- no client name, client contact information, clinical notes, intake references, pain-map detail, treatment notes, SOAP data, diagnosis, or private operational notes

The outbound event stores an app-owned extended property or description marker only if it contains non-sensitive identifiers. MassageLab keeps the authoritative link in its own database through `ExternalCalendarEventLink`.

### Display

The `/calendar` workspace includes Google busy blocks in the same date window it already loads for internal events. Busy blocks render as read-only items with a neutral label such as `Google busy`. Connected providers may see the source calendar label if it is safe and configured, but practice-wide views should default to the generic label to avoid exposing personal calendar names.

External busy blocks are not draggable or resizable. Users edit the original event in Google or disconnect the source calendar if it should no longer affect MassageLab availability.

### Scheduling And Conflicts

Conflict checks include both internal blocking `CalendarEvent` rows and active external busy blocks for the target provider. Staff-created appointments, public booking requests, appointment request confirmation, classes, and personal blocks must all reject overlapping provider Google busy time unless a privileged override is added in a later design.

The initial behavior should be strict: external busy time blocks scheduling. This avoids silently double-booking a provider when Google says they are unavailable.

## Architecture

### Database Models

Add provider-neutral models now so Outlook, Apple, or CalDAV can be added later without rewriting the MassageLab scheduling core.

#### `CalendarConnection`

Represents one external calendar provider connection for a MassageLab user.

Fields:

- `id`
- `userId`
- `provider` enum value, initially `GOOGLE`
- `providerAccountId`
- `accountEmail`
- encrypted refresh token
- encrypted access token, if stored
- token expiry
- granted scopes
- connection status: `ACTIVE`, `NEEDS_REAUTH`, `DISCONNECTED`, `ERROR`
- sync status summary
- `lastSyncedAt`
- `createdAt`
- `updatedAt`

Constraints:

- unique provider and provider account per user
- index user and status for calendar settings and background sync

#### `ExternalCalendarSource`

Represents one selected Google calendar to read as busy context.

Fields:

- `id`
- `connectionId`
- `providerCalendarId`
- `label`
- `timezone`
- `selectedForBusySync`
- `syncToken`
- `lastFullSyncAt`
- `lastIncrementalSyncAt`
- `lastErrorCode`
- `lastErrorMessage`
- `createdAt`
- `updatedAt`

The label is operational metadata. It must not be exposed in practice-wide views unless the connected user is viewing their own settings or event details.

#### `ExternalCalendarBusyBlock`

Normalized busy windows used by display and conflict checks.

Fields:

- `id`
- `connectionId`
- `sourceId`
- `ownerUserId`
- `provider`
- `providerCalendarId`
- `providerEventId`
- `providerEventEtag`
- `startsAt`
- `endsAt`
- `timezone`
- `allDay`
- `transparency`
- `status`
- `cancelledAt`
- `createdAt`
- `updatedAt`

Indexes:

- owner user, start, end, active status
- source id and provider event id
- connection id and updated timestamp

#### `ExternalCalendarEventLink`

Maps MassageLab-originated `CalendarEvent` rows to outbound Google events on the dedicated MassageLab calendar.

Fields:

- `id`
- `connectionId`
- `calendarEventId`
- `provider`
- `providerCalendarId`
- `providerEventId`
- `providerEventEtag`
- `lastPushedAt`
- `lastErrorCode`
- `lastErrorMessage`
- `createdAt`
- `updatedAt`

Constraints:

- unique `calendarEventId` plus connection
- unique provider calendar id plus provider event id

#### `CalendarSyncRun`

Records sync attempts and health without storing raw provider payloads.

Fields:

- `id`
- `connectionId`
- `sourceId`
- `direction`: `INBOUND`, `OUTBOUND`, `WEBHOOK_REFRESH`
- `status`: `STARTED`, `SUCCEEDED`, `FAILED`, `PARTIAL`
- `startedAt`
- `finishedAt`
- `windowStart`
- `windowEnd`
- `itemsSeen`
- `itemsChanged`
- `errorCode`
- `errorMessage`

Error text must be sanitized and must not include provider event payloads.

### Auth And Tokens

Use a dedicated Google calendar connect route instead of modifying baseline Google sign-in. The connect route requests the narrowest scopes that support the selected design.

Preferred scope direction:

- `calendar.app.created` for the dedicated MassageLab calendar and app-created events, if it covers all create/update/delete requirements in implementation.
- `calendar.calendarlist.readonly` or equivalent minimal calendar-list access so the provider can choose calendars for busy sync.
- `calendar.events.freebusy`, `calendar.freebusy`, or a narrowly scoped event-read option for selected source calendars, depending on implementation feasibility.

If implementation proves Google requires broader event scope for a necessary operation, the implementation plan must name the exact scope, why the narrower scope failed, and where the product copy explains it to users.

Tokens are secrets and must be encrypted using the repo's existing secret-encryption patterns. Do not log tokens, raw Google responses, or authorization headers.

### Sync Jobs

V1 can run sync on demand and on app-triggered refresh without requiring a separate durable worker. Minimum triggers:

- immediately after connection
- when the provider opens `/calendar`
- after selected source calendars change
- after MassageLab creates, reschedules, cancels, or confirms a provider-owned scheduling event

Initial sync window:

- 30 days back
- 180 days forward

This matches the current calendar workspace data window and keeps first sync bounded.

Incremental sync:

- Store Google sync tokens per source calendar after a successful full sync.
- Use incremental sync tokens for later refreshes.
- If Google returns an invalid-token response, clear only that source's busy blocks and perform a new bounded full sync.

Push notifications:

- Treat Google push notification support as an optional optimization after polling/on-demand sync works.
- If implemented in the first branch, webhook handlers must only enqueue or trigger a sanitized refresh for the relevant connection/source. They must not trust webhook payloads as event data.

### Outbound Event Lifecycle

Create:

- When a MassageLab appointment, class, or personal block is created for a provider with an active connection, create or update the paired event in the provider's dedicated MassageLab Google calendar.
- Store the provider event id and etag in `ExternalCalendarEventLink`.

Update:

- When a MassageLab event is rescheduled or materially renamed in MassageLab, update the paired Google event.
- If Google update fails because the event was manually deleted, recreate it and update the link.

Cancel:

- When a MassageLab event becomes cancelled, completed, or no-show, update or delete the paired Google event according to the least surprising behavior chosen in implementation.
- Default: cancel/delete the outbound Google event for cancelled appointments and classes; leave completed historical events unchanged.

Disconnect:

- Disconnect stops future sync and marks the connection disconnected.
- Busy blocks from the disconnected connection stop blocking scheduling.
- Existing outbound Google events remain in the user's Google calendar unless the disconnect flow explicitly offers to remove them and the user chooses that action.

## UI Surfaces

### Calendar Settings

Add a sync section to the calendar management area, likely under `/calendar/booking` or a new `/calendar/sync` route if the settings become dense. It should show:

- Google connection status
- connected account email
- token/sync health
- selected calendars for busy import
- dedicated MassageLab calendar status
- last sync timestamp
- reconnect and disconnect actions

Provider calendar selection should default to primary calendar selected for busy import when that can be safely detected, with explicit checkboxes for additional calendars.

### Calendar Workspace

The calendar workspace receives external busy blocks alongside internal events. Display rules:

- read-only
- neutral color
- title `Google busy`
- no client or Google personal detail
- non-reschedulable

### Error States

User-facing sync errors should be specific enough to act on:

- reconnect Google
- selected calendar unavailable
- sync temporarily failed
- dedicated calendar missing and could not be recreated

Errors must not expose provider response bodies.

## Security And Privacy Rules

- Separate calendar OAuth from sign-in OAuth.
- Encrypt provider tokens.
- Never document or log tokens, raw Google rows, authorization headers, or environment variables.
- Do not persist Google event description, location, attendees, or organizer fields.
- Do not export client names or contact information to Google by default.
- Do not export SOAP, intake, journal, transcript, ROM, pain-map, diagnosis, treatment, or clinical note content.
- Calendar audit metadata continues through `sanitizeCalendarAuditMetadata`.
- Sentry payloads must continue to scrub auth, token, client, patient, PHI, note, intake, journal, pain, ROM, diagnosis, treatment, and response body fields.

## Implementation Boundaries

This design should be implemented as a branch-sized integration, not a broad calendar rewrite. Keep existing internal calendar creation, availability, resource, waitlist, and public booking behavior intact.

Expected implementation areas:

- Prisma schema and migration for provider-neutral sync models.
- Google OAuth connect, callback, reconnect, and disconnect routes.
- Google Calendar adapter for calendar list, dedicated calendar creation/find, busy sync, and outbound event create/update/delete.
- Sync service that converts provider events into busy blocks.
- Conflict checks in calendar actions and public booking actions.
- Calendar workspace display mapping for external busy blocks.
- Calendar sync settings UI.
- Focused Node tests for adapters and conflict logic.
- Focused route/component tests for privacy-safe display and settings states.
- Docs updates to `docs/project-state.md`, `docs/project-log.md`, and `docs/wiki/calendar-creation-flows.md` after implementation lands.

## Non-Goals

- Client-side calendar connection.
- Outlook or Microsoft Graph.
- Apple/iCloud.
- CalDAV.
- ICS import/export.
- Full two-way mirroring of personal event details.
- Editing Google personal events from MassageLab.
- Attendee invites from synced Google events.
- External reminder delivery.
- Booking payment collection or Stripe Connect.
- Hosted clinical storage.

## Test Strategy

Unit and integration tests should cover:

- Scope and token state normalization without logging secrets.
- Calendar source selection and sync-token state transitions.
- Google event-to-busy-block normalization, including all-day, transparent/free, cancelled, and recurring-expanded instances.
- Conflict checks that reject overlaps with active external busy blocks.
- Conflict checks that ignore disconnected or cancelled external blocks.
- Outbound payload builder excludes client and clinical detail.
- Calendar workspace maps external busy blocks to read-only `Google busy` display events.
- Disconnect prevents future blocking from that connection.
- Sanitized sync run and audit metadata excludes sensitive keys.

Manual verification should cover:

- Connect Google.
- Select calendars.
- Initial sync imports busy blocks.
- Creating a MassageLab appointment creates an event on the dedicated Google calendar.
- Rescheduling in MassageLab updates Google.
- A Google busy event blocks MassageLab booking.
- Disconnect stops busy blocking.
- Calendar UI never shows imported Google event titles in practice-wide views.

## Rollout Notes

Keep the feature behind environment readiness checks so calendar sync settings can render a clear unavailable state when Google calendar OAuth configuration is missing. The app should continue to work normally without calendar sync configured.

The first production rollout should use one internal test Google account before inviting alpha providers to connect real calendars. Record only high-level smoke evidence in docs; do not record real event data, calendar ids, tokens, emails, or database rows.
