import { expect, type Page } from "@playwright/test"

/** Detects App Router's streamed production 404 without hiding the development fixture. */
export async function isDevelopmentReviewUnavailable(
  page: Page,
  responseStatus: number | undefined,
) {
  if (responseStatus === 404) return true

  const reviewHeading = page.getByRole("heading", { name: "Control system review", level: 1 })
  const notFoundHeading = page.getByRole("heading", {
    name: "This page could not be found.",
    exact: true,
    level: 2,
  })
  await expect(reviewHeading.or(notFoundHeading)).toBeVisible()
  return notFoundHeading.isVisible()
}
