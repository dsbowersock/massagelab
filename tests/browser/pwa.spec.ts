import { expect, test } from "@playwright/test"

const requiredIcons = [
  { src: "/icons/icon-192.png", sizes: "192x192" },
  { src: "/icons/icon-512.png", sizes: "512x512" },
  { src: "/icons/maskable-icon-192.png", sizes: "192x192", purpose: "maskable" },
  { src: "/icons/maskable-icon-512.png", sizes: "512x512", purpose: "maskable" },
] as const

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

    const iconResponse = await request.get(requiredIcon.src)
    expect(iconResponse.ok(), `${requiredIcon.src} should resolve`).toBe(true)
    expect(iconResponse.headers()["content-type"]).toContain("image/png")
    expect((await iconResponse.body()).length).toBeGreaterThan(0)
  }
})
