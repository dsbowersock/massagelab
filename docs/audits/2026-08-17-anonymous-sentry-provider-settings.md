# Anonymous Sentry Provider And Runtime Audit

## Scope

This audit covers anonymous operational monitoring only. It does not authorize or add product analytics, pageviews, background impressions, user journeys, retention analysis, Replay, standard Sentry User Feedback, screenshots, attachments, Logs, or identity profiles. Provider names, event identifiers, account identifiers, project identifiers, credentials, and payload screenshots are intentionally omitted.

## SDK head

The exact preview runtime proof used commit `77ec81e2db77faaa3fd6694ce62075761e4513db`.

The SDK is deny-by-default: `sendDefaultPii` is false, user information collection is disabled, supplied user values are removed, and the anonymous `ip_address: null` marker prevents server-side IP inference. Browser sessions, automatic breadcrumbs, Replay, standard feedback, attachments, Logs, and Application Metrics are not enabled. Requests, operations, tags, contexts, and spans are reduced to bounded operational values and coarse route families.

## Provider controls

| Control | Verified state |
| --- | --- |
| Server-side data scrubbing | Enabled and saved |
| Default scrubbers | Enabled and saved |
| Prevent Storing of IP Addresses | Enabled and saved |
| Additional sensitive fields | Empty |
| Advanced data scrubbing | Removes geographic user fields and server-name tags from new events |
| Public issue sharing | Disabled by settings readback |
| Session Replay | Disabled in the SDK; no Replay integration or replay data is emitted |
| Standard User Feedback | Disabled in the SDK; the app uses its own enum-only diagnostic route |
| Attachments | Unused; the inspected diagnostic stored no attachment |
| Logs | Disabled in the SDK |
| Application Metrics | Disabled in the SDK |
| Retention period | Unverified: the connected organization/project settings readback exposed no retention field, and the account UI did not show a duration. No duration is guessed. |

The unavailable retention readback is a provider-visibility limitation, not evidence of a different duration and not permission to weaken any other privacy control.

## Synthetic diagnostic

One authorized enum-only diagnostic was submitted to the exact preview. The initial unauthenticated request was rejected by deployment protection before reaching MassageLab; the authenticated preview request produced the only application route execution, recorded as one `POST /api/support/problem-report` response with status `200`.

| Acceptance check | Result |
| --- | --- |
| Exact release and preview environment | PASS |
| Coarse route grouping | PASS: `/timer` report context and `/api/[route]` request family |
| Bounded report context | PASS: predefined category, area, privacy, browser, display, network, and viewport values only |
| Identity and location | PASS: no user, account, session, IP, country, city, region, or server-name value; provider geo was empty and affected-user count was zero |
| Request data | PASS: no full URL, query string, request body, header, or cookie stored |
| Behavioral history | PASS: no breadcrumbs or Replay |
| Uploaded data | PASS: no attachment or screenshot |
| Message | PASS with safer over-filtering: the provider stored `[Filtered]` |

Focused source and fixture tests independently cover removal of query strings, request/response bodies, headers, cookies, supplied identity, non-allowlisted context, and freeform values. The hosted proof confirms that the final SDK and provider combination also prevents transport-IP location inference.
