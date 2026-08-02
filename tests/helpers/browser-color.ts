import type { Page } from "@playwright/test"

/** Normalizes CSS colors through the browser parser used by the renderers. */
export function normalizeBrowserColors(page: Page, values: readonly string[]) {
  return page.evaluate((colors) => colors.map((color) => {
    const probe = document.createElement("span")
    try {
      probe.style.color = color
      document.body.append(probe)
      return getComputedStyle(probe).color
    } finally {
      probe.remove()
    }
  }), values)
}

/** Normalizes one CSS color while preserving a convenient scalar result. */
export async function normalizeBrowserColor(page: Page, value: string) {
  const [normalized] = await normalizeBrowserColors(page, [value])
  if (!normalized) throw new Error(`The browser did not normalize CSS color: ${value}`)
  return normalized
}
