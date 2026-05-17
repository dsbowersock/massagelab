const CACHE_NAME = "massagelab-shell-v2026-05-17"
const OFFLINE_URL = "/offline.html"
const SHELL_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.ico",
  "/brand/massagelab-mark-square-tight.png",
  "/brand/massagelab-wordmark-uppercase-tight.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-icon-192.png",
  "/icons/maskable-icon-512.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
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

function isSensitiveRequest(requestUrl) {
  const { pathname } = requestUrl

  return (
    pathname.startsWith("/api/")
    || pathname.startsWith("/api/clinical/sync")
    || pathname.startsWith("/api/billing/")
    || pathname.startsWith("/api/auth/")
    || pathname.startsWith("/api/account/")
    || pathname.startsWith("/api/clients/")
    || pathname.startsWith("/account")
    || pathname.startsWith("/login")
    || pathname.startsWith("/register")
    || pathname.startsWith("/reset-password")
    || pathname.startsWith("/forgot-password")
  )
}

function isStaticShellAsset(requestUrl) {
  const { pathname } = requestUrl

  return (
    pathname.startsWith("/_next/static/")
    || pathname.startsWith("/brand/")
    || pathname.startsWith("/icons/")
    || pathname === "/favicon.ico"
    || pathname === "/manifest.webmanifest"
    || pathname === OFFLINE_URL
  )
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  const requestUrl = new URL(request.url)

  if (
    request.method !== "GET"
    || requestUrl.origin !== self.location.origin
    || isSensitiveRequest(requestUrl)
  ) {
    return
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    )
    return
  }

  if (isStaticShellAsset(requestUrl)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => (
        cachedResponse
        || fetch(request).then((networkResponse) => {
          const responseCopy = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseCopy)
          })
          return networkResponse
        })
      )),
    )
  }
})
