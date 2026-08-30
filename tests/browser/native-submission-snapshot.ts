import type { Locator, Page } from "@playwright/test"

export type NativePendingSnapshot = {
  buttonAriaBusy: string | null
  buttonAriaLabel: string | null
  buttonDisabled: boolean | undefined
  formAriaBusy: string | null
  pendingCopyVisible: boolean
  statusCount: number
  statusText: string | undefined
}

/** Records native pending after React's delegated submit handler, then triggers one duplicate submit. */
export async function installNativeSubmitSnapshotRecorder({
  page,
  form,
  pendingLabel,
}: {
  page: Page
  form: Locator
  pendingLabel: string
}) {
  let resolveSnapshot: (snapshot: NativePendingSnapshot) => void = () => {}
  const snapshot = new Promise<NativePendingSnapshot>((resolve) => {
    resolveSnapshot = resolve
  })
  await page.exposeFunction("__recordNativeBillingPending", (value: NativePendingSnapshot) => {
    resolveSnapshot(value)
  })
  await form.evaluate((element, label) => {
    const observePending = (event: SubmitEvent) => {
      const submittedForm = event.target
      if (!(submittedForm instanceof HTMLFormElement) || submittedForm !== element) return
      document.removeEventListener("submit", observePending)
      const button = submittedForm.querySelector<HTMLButtonElement>('button[type="submit"]')
      const pendingCopy = [...submittedForm.querySelectorAll<HTMLElement>('span[aria-hidden="false"]')]
        .find((candidate) => candidate.textContent === label)
      const statuses = [...submittedForm.querySelectorAll<HTMLElement>('[role="status"]')]
      const recordSnapshot = Reflect.get(window, "__recordNativeBillingPending") as (
        pendingSnapshot: NativePendingSnapshot,
      ) => void
      recordSnapshot({
        buttonAriaBusy: button?.getAttribute("aria-busy") ?? null,
        buttonAriaLabel: button?.getAttribute("aria-label") ?? null,
        buttonDisabled: button?.disabled,
        formAriaBusy: submittedForm.getAttribute("aria-busy"),
        pendingCopyVisible: pendingCopy ? getComputedStyle(pendingCopy).visibility !== "hidden" : false,
        statusCount: statuses.length,
        statusText: statuses[0]?.textContent ?? undefined,
      })
      setTimeout(() => submittedForm.requestSubmit(), 0)
    }
    document.addEventListener("submit", observePending)
  }, pendingLabel)
  return { snapshot }
}
