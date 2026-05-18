# PWA Offline Strategy

MassageLab is offline-capable for anonymous public tools during private alpha. It is not an offline sync product for account, billing, calendar, booking, admin, or hosted clinical workflows.

## Offline-Capable Routes

The service worker may cache anonymous route documents for:

- `/`
- `/notes`
- `/notes/soap`
- `/notes/intake`
- `/notes/journal`
- `/notes/rom`
- `/chimer`
- `/anatomime`

These routes are either public product surfaces or browser-local tools. SOAP, intake, journal, and ROM drafts still live in browser storage under the keys listed in [Privacy and PHI posture](privacy-and-phi.md). The service worker does not add a second PHI storage or sync layer.

## Online-Only Routes

The service worker must not cache app data, request bodies, authenticated responses, or route documents for:

- `/api/*`, including auth, account, billing, calendar, clinical sync, and clients endpoints
- `/account`
- `/admin`
- `/book`
- `/calendar`
- `/forgot-password`
- `/login`
- `/pricing`
- `/register`
- `/reset-password`
- `/settings`
- `/verify-email`

When the browser reports offline, non-allowlisted navigations fall back to `/offline.html` instead of replaying previously prefetched dynamic app HTML.

## Implementation Rules

- `public/sw.js` owns the strategy through `PUBLIC_OFFLINE_ROUTES`, `SENSITIVE_PREFIXES`, `CACHE_NAME`, and `OFFLINE_URL`.
- Public route warming uses `credentials: "omit"` so cached route documents are anonymous.
- Live navigation responses are not written to the public route cache because a signed-in user may be navigating.
- Runtime caching is limited to `/_next/static/*` and `/offline.html`.
- Versionless brand and icon files are not runtime-cached by the service worker; browser cache headers remain responsible for those files.
- The service worker is registered only in production over HTTPS or local loopback hosts.

## Verification

Run the standard alpha gate plus browser PWA checks:

```text
node --test tests/pwa-service-worker.test.mjs
npm run build
npx playwright test tests/browser/pwa.spec.ts --project=desktop-chromium
```

The full branch gate remains:

```text
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:browser
```

## References

- [ChromeOS Powerful PWAs](https://developers.google.com/chromeos/app-development/learn/powerful-pwas)
- [MDN Progressive web apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
