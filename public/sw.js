const CACHE_NAME = "massagelab-shell-v2026-05-18"
const OFFLINE_URL = "/offline.html"
const PUBLIC_OFFLINE_ROUTES = [
  "/",
  "/notes",
  "/notes/soap",
  "/notes/intake",
  "/notes/journal",
  "/notes/rom",
  "/chimer",
  "/clock",
  "/anatomime",
]
const SENSITIVE_PREFIXES = [
  "/api/",
  "/api/auth/",
  "/api/billing/",
  "/api/clinical/sync",
  "/account",
  "/admin",
  "/book",
  "/calendar",
  "/forgot-password",
  "/login",
  "/pricing",
  "/register",
  "/reset-password",
  "/settings",
  "/verify-email",
]
const SHELL_ASSETS = [
  OFFLINE_URL,
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => warmPublicOfflineRoutes())
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ))
      .then(() => self.clients.claim()),
  )
})

function normalizePublicRoutePath(pathname) {
  if (pathname === "/") return pathname
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname
}

function publicOfflineCacheKey(pathname) {
  const normalizedPathname = normalizePublicRoutePath(pathname)
  const cachePath = normalizedPathname === "/"
    ? "/__massagelab-offline-route/index.html"
    : `/__massagelab-offline-route${normalizedPathname}`

  return new Request(new URL(cachePath, self.location.origin).href)
}

function isPublicOfflineRoute(requestUrl) {
  return PUBLIC_OFFLINE_ROUTES.includes(normalizePublicRoutePath(requestUrl.pathname))
}

function isSensitiveRequest(requestUrl) {
  const { pathname } = requestUrl
  return SENSITIVE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function isStaticShellAsset(requestUrl) {
  const { pathname } = requestUrl

  return (
    pathname.startsWith("/_next/static/")
    || pathname === OFFLINE_URL
  )
}

function isHtmlResponse(response) {
  return response.headers.get("content-type")?.includes("text/html")
}

async function warmPublicOfflineRoute(pathname) {
  const normalizedPathname = normalizePublicRoutePath(pathname)
  const url = new URL(normalizedPathname, self.location.origin)
  const request = new Request(url.href, {
    credentials: "omit",
    headers: {
      Accept: "text/html",
    },
  })

  try {
    const response = await fetch(request)
    if (!response.ok || !isHtmlResponse(response)) {
      return
    }

    const cache = await caches.open(CACHE_NAME)
    await cache.put(publicOfflineCacheKey(normalizedPathname), response.clone())
  } catch {
    // Warming is opportunistic. Existing offline fallbacks should stay usable.
  }
}

async function warmPublicOfflineRoutes() {
  await Promise.all(PUBLIC_OFFLINE_ROUTES.map((route) => warmPublicOfflineRoute(route)))
}

async function offlineFallbackForNavigation(requestUrl) {
  if (isPublicOfflineRoute(requestUrl)) {
    const cachedPublicRoute = await caches.match(publicOfflineCacheKey(requestUrl.pathname))
    if (cachedPublicRoute) {
      return cachedPublicRoute
    }
  }

  return caches.match(OFFLINE_URL)
}

async function handleNavigation(request, requestUrl) {
  if (!self.navigator.onLine) {
    return await offlineFallbackForNavigation(requestUrl)
      || new Response("MassageLab is offline", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      })
  }

  try {
    return await fetch(request, { cache: "no-store" })
  } catch {
    return await offlineFallbackForNavigation(requestUrl)
      || new Response("MassageLab is offline", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      })
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  const requestUrl = new URL(request.url)

  if (
    request.method !== "GET"
    || requestUrl.origin !== self.location.origin
  ) {
    return
  }

  if (request.mode === "navigate") {
    if (isPublicOfflineRoute(requestUrl)) {
      event.waitUntil(warmPublicOfflineRoute(requestUrl.pathname))
    }

    event.respondWith(handleNavigation(request, requestUrl))
    return
  }

  if (isSensitiveRequest(requestUrl)) {
    return
  }

  if (isStaticShellAsset(requestUrl)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => (
        cachedResponse
        || fetch(request).then((networkResponse) => {
          if (!networkResponse.ok) {
            return networkResponse
          }

          const responseCopy = networkResponse.clone()
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy)),
          )
          return networkResponse
        })
      )),
    )
  }
})
