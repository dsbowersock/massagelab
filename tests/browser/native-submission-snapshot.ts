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

/** Records pending and duplicate prevention out of band while native navigation remains unresolved. */
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
  let resolveDuplicatePrevented: (prevented: boolean) => void = () => {}
  const duplicatePrevented = new Promise<boolean>((resolve) => {
    resolveDuplicatePrevented = resolve
  })
  await page.exposeFunction("__recordNativeBillingPending", (value: NativePendingSnapshot) => {
    resolveSnapshot(value)
  })
  await page.exposeFunction("__recordNativeBillingDuplicatePrevented", (value: boolean) => {
    resolveDuplicatePrevented(value)
  })
  await form.evaluate((element, label) => {
    let attempts = 0
    const observeDuplicatePrevention = (event: SubmitEvent) => {
      if (event.target !== element) return
      attempts += 1
      if (attempts !== 2) return
      document.removeEventListener("submit", observeDuplicatePrevention)
      const recordDuplicatePrevented = Reflect.get(
        window,
        "__recordNativeBillingDuplicatePrevented",
      ) as (prevented: boolean) => void
      recordDuplicatePrevented(event.defaultPrevented)
    }
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
      // Reentrant requestSubmit() is ignored during active submit dispatch; defer
      // the duplicate so React's pending guard receives and blocks the next event.
      setTimeout(() => submittedForm.requestSubmit(), 0)
    }
    document.addEventListener("submit", observePending)
    document.addEventListener("submit", observeDuplicatePrevention)
  }, pendingLabel)
  return { snapshot, duplicatePrevented }
}
