import { expect, test, type Page } from "@playwright/test"

const requiredIcons = [
  { src: "/icons/icon-192.png", sizes: "192x192" },
  { src: "/icons/icon-512.png", sizes: "512x512" },
  { src: "/icons/maskable-icon-192.png", sizes: "192x192", purpose: "maskable" },
  { src: "/icons/maskable-icon-512.png", sizes: "512x512", purpose: "maskable" },
] as const

const installIconPaths = [
  "/favicon.ico",
  "/icons/apple-touch-icon.png",
  ...requiredIcons.map((icon) => icon.src),
] as const

async function waitForControlledServiceWorker(page: Page) {
  await page.waitForFunction(
    () => "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller),
    { timeout: 15_000 },
  )
}

async function waitForOfflineRouteCache(page: Page, routePath: string) {
  await expect.poll(
    async () => page.evaluate(async (path) => {
      const cachePath = path === "/"
        ? "/__massagelab-offline-route/index.html"
        : `/__massagelab-offline-route${path}`
      const cacheNames = await caches.keys()
      const cacheMatches = await Promise.all(cacheNames.map(async (cacheName) => {
        const cache = await caches.open(cacheName)
        return Boolean(await cache.match(new URL(cachePath, window.location.origin).href))
      }))

      return cacheMatches.some(Boolean)
    }, routePath),
    { timeout: 15_000 },
  ).toBe(true)
}

test("PWA manifest exposes install metadata and resolvable icons", async ({ request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest")
  expect(manifestResponse.ok()).toBe(true)
  expect(manifestResponse.headers()["content-type"]).toContain("application/manifest+json")

  const manifest = await manifestResponse.json()

  expect(manifest).toMatchObject({
    id: "/",
    name: "MassageLab",
    short_name: "MassageLab",
    start_url: "/",
    scope: "/",
    display: "standalone",
  })

  for (const requiredIcon of requiredIcons) {
    expect(manifest.icons).toContainEqual(expect.objectContaining(requiredIcon))
  }

  for (const iconPath of installIconPaths) {
    const iconResponse = await request.get(iconPath)
    expect(iconResponse.ok(), `${iconPath} should resolve`).toBe(true)
    expect(iconResponse.headers()["content-type"]).toMatch(/image\/|application\/octet-stream/)
    expect((await iconResponse.body()).length).toBeGreaterThan(0)
  }
})

test("service worker keeps selected public tools reloadable offline and excludes calendar", async ({ context, page }) => {
  await page.goto("/chimer", { waitUntil: "networkidle" })
  await waitForControlledServiceWorker(page)
  await page.reload({ waitUntil: "networkidle" })
  await expect(page.getByRole("heading", { name: /Chimer/i })).toBeVisible()
  await waitForOfflineRouteCache(page, "/chimer")

  await context.setOffline(true)

  try {
    await page.reload({ waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: /Chimer/i })).toBeVisible()
    await expect(page.getByText(/MassageLab is offline/i)).toHaveCount(0)

    await page.goto("/calendar", { waitUntil: "domcontentloaded" })
    await expect(page.getByRole("heading", { name: /MassageLab is offline/i })).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})
