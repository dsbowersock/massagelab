# Calendar Creation Flows

MassageLab calendar creation uses a shared `CalendarEvent` index with specialized detail records for appointments, personal blocks, classes, and reminders.

## Flow Rules

| Flow | Route | Roles | Blocks availability | Detail record |
| --- | --- | --- | --- | --- |
| Staff appointment | `/calendar/new/appointment` | Owner, staff, or therapist creating on their own schedule | Yes | `Appointment` |
| Client request | `/book/[practiceSlug]` | Signed-in client for their own request | Yes while requested or confirmed | `Appointment` |
| Personal event | `/calendar/new/personal` | Owner for any therapist, therapist for self | Yes | `CalendarBlock` |
| Class | `/calendar/new/class` | Owner or staff | Yes | `CalendarClass` |
| Reminder | `/calendar/new/reminder` | Owner, staff, or therapist for self | No | `CalendarReminder` |
| Services | `/calendar/services` | Owner, staff, or therapist provider | N/A | `ServiceType`, `ServiceVariant`, resources |

Appointment requests are reviewed at `/calendar/requests`. Confirming or declining a request updates both `CalendarEvent.status` and the linked `Appointment.status`.

## Data Model

- `CalendarEvent` is the agenda and conflict source of truth: kind, title, owner, start/end, timezone, visibility, status, blocking behavior, creator, and practice.
- `Appointment`, `CalendarBlock`, `CalendarClass`, and `CalendarReminder` store flow-specific details through required one-to-one `eventId` links.
- `ServiceType` is the provider-managed service template. `ServiceVariant` stores bookable duration, processing time, before/after buffers, displayed price/currency, client visibility, and sort order.
- Appointments and classes store service snapshots from the selected variant so later service edits do not rewrite existing bookings.
- `CalendarResource`, `ServiceVariantResource`, and `CalendarResourceBooking` model rooms/equipment required by service variants and prevent overlapping active bookings for those resources.
- Active blocking statuses are `REQUESTED`, `CONFIRMED`, and `ACTIVE`; cancelled, completed, and no-show records do not block availability.
- Reminders are operational only and do not block availability.

## Service Catalog

- Service management lives at `/calendar/services`, `/calendar/services/new`, and `/calendar/services/[serviceId]`.
- Provider-editable attributes include category, description, modality, body-region focus, service color, provider eligibility, client visibility, class eligibility, up to three v1 variants, required resources, reusable documentation/intake template references, contraindication prompts, supplies/setup fields, intake requirements, contraindication notices, cancellation/no-show/deposit/tax/package policy text, and active state.
- Scheduling enforces service variant duration, processing time, buffers, provider availability, provider event conflicts, and resource conflicts.
- Multi-service staff appointments store one appointment plus `AppointmentServiceItem` snapshot rows so combined bookings keep their original service names, durations, buffers, prices, and resources after later service edits.
- Payment/policy fields are stored for future operations, but v1 calendar creation does not collect payments, charge deposits, calculate taxes, redeem packages, or enforce cancellation fees.
- Public booking stays path-first at `/book/[practiceSlug]`; subdomains and custom domains are deferred.

## Operator Workspace

- `/calendar` is the provider scheduling workspace. It uses FullCalendar open-source plugins for day, week, 5-day, and month views, date navigation, click-to-create, drag/drop, and resize.
- Provider view modes are per-user preferences: only me, combined, and split provider panels. Service color is the default event color mode; status coloring remains available as a user preference.
- Drag/drop and resize call server-side reschedule checks before saving. Permissions, provider availability, event conflicts, resource conflicts, and blocking status are revalidated; reminders remain non-resizable.
- Calendar display preferences live in `UserPreference.calendarPreferences`, not browser-only state.

## Advanced Availability

- `TherapistAvailabilityRule` remains the weekly fallback model.
- Named schedules and one-time overrides add provider-specific date-ranged availability without deleting fallback rules.
- Resolution order is: closed/blackout/holiday override, one-time open override, active named schedule, weekly fallback.
- Public booking and staff scheduling both use the resolved availability model.

## Audit And Notifications

- Calendar mutations create `CalendarAuditLog` rows with sanitized metadata.
- Notification behavior is v1 intent-only. `CalendarNotificationIntent` records internal pending notification intent rows; no email, SMS, or push delivery is sent by these flows.
- Audit and notification payloads must not include SOAP notes, pain maps, transcripts, client email/phone/address, diagnosis, treatment notes, or other clinical/identifying detail.

## Entitlements And Labels

- Code checks feature keys, not plan names. Free users receive `calendar_basic_scheduling`; Therapist and Practice receive full service/scheduling access; Practice additionally receives team scheduling.
- Frontend copy uses `Team/Practice` for the paid team tier while the internal Prisma enum remains `PRACTICE`.
- External Google/Apple/Outlook calendar sync is designed as a future integration track and is not implemented by this branch.
- Stripe Connect marketplace payouts and booking payment collection are deferred; existing Stripe Billing memberships only gate access.

## Privacy Boundary

Calendar sync stores scheduling metadata only. PHI-bearing documentation, intake, journal, transcript, pain-map, ROM, and SOAP content remain local-first unless future hosted clinical storage passes the compliance gates documented in the privacy wiki.

Reusable clinical template references on services are allowed only as non-PHI IDs/labels and generic prompts. Client-specific clinical content must stay in local-first documentation, not calendar events, appointment notes, reminders, service records, audit payloads, or notification payloads.
