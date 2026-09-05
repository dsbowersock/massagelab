export type PublicBookingActionState =
  | { status: "IDLE" }
  | { status: "SUCCESS"; redirectTo: string }
  | { status: "VALIDATION_ERROR"; message: string }
  | { status: "CONFLICT"; message: string }
  | { status: "RATE_LIMITED"; message: string; retryAfterSeconds: number }
  | { status: "UNAVAILABLE"; message: string }

export const INITIAL_PUBLIC_BOOKING_ACTION_STATE: PublicBookingActionState = { status: "IDLE" }
export const PUBLIC_BOOKING_AVAILABILITY_DEBOUNCE_MS = 350
export const PUBLIC_BOOKING_RETRY_READY_MESSAGE = "You can try again now."

/** Schedules one availability request and returns cleanup for superseding renders. */
export function schedulePublicAvailabilityRequest(
  run: (signal: AbortSignal) => void | Promise<void>,
): () => void {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => {
    void run(controller.signal)
  }, PUBLIC_BOOKING_AVAILABILITY_DEBOUNCE_MS)
  return () => {
    window.clearTimeout(timeoutId)
    controller.abort()
  }
}

/** Accepts only the positive integer Retry-After form emitted by the route. */
export function publicBookingRetryAfterSeconds(value: string | null): number | null {
  const normalized = value?.trim() ?? ""
  if (!/^[1-9]\d*$/.test(normalized)) return null
  const seconds = Number(normalized)
  return Number.isSafeInteger(seconds) ? seconds : null
}

/** Calculates a countdown without permitting negative or fractional seconds. */
export function publicBookingRemainingRetrySeconds(deadlineMs: number, nowMs: number): number {
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs)) return 0
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1_000))
}

/** Formats one visible retry delay with a grammatically correct time unit. */
export function publicBookingRetryDelayLabel(seconds: number): string {
  const normalized = Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0
  return `Try again in ${normalized} ${normalized === 1 ? "second" : "seconds"}.`
}

/** Generates request IDs only in a mounted browser with Web Crypto support. */
export function createBrowserPublicBookingRequestId(): string {
  if (typeof window === "undefined" || typeof window.crypto?.randomUUID !== "function") return ""
  return window.crypto.randomUUID()
}

/** Returns a definitive success whose trusted local path is navigated by the client. */
export function publicBookingSuccess(redirectTo: string): PublicBookingActionState {
  return { status: "SUCCESS", redirectTo }
}

/** Uses fixed copy so invalid public forms cannot disclose server-side details. */
export function publicBookingValidationError(): PublicBookingActionState {
  return {
    status: "VALIDATION_ERROR",
    message: "Review your booking details and try again.",
  }
}

/** Uses one generic conflict result for stale or changed public submissions. */
export function publicBookingConflict(): PublicBookingActionState {
  return {
    status: "CONFLICT",
    message: "This request could not be completed. Start a new request and try again.",
  }
}

/** Normalizes a limiter delay into the positive integer consumed by client UI. */
export function publicBookingRateLimited(retryAfterSeconds: number): PublicBookingActionState {
  return {
    status: "RATE_LIMITED",
    message: "Too many requests. Please wait before trying again.",
    retryAfterSeconds: Number.isFinite(retryAfterSeconds)
      ? Math.max(1, Math.ceil(retryAfterSeconds))
      : 1,
  }
}

/** Returns fixed retry guidance for ambiguous or temporarily failed work. */
export function publicBookingUnavailable(): PublicBookingActionState {
  return {
    status: "UNAVAILABLE",
    message: "Booking is temporarily unavailable. Please try again.",
  }
}

/**
 * Converts an ambiguous Server Action transport failure into the same fixed,
 * retryable state without changing or regenerating the browser request ID.
 */
export async function runPublicBookingActionWithRecovery(
  action: (
    previousState: PublicBookingActionState,
    formData: FormData,
  ) => Promise<PublicBookingActionState>,
  previousState: PublicBookingActionState,
  formData: FormData,
): Promise<PublicBookingActionState> {
  try {
    return await action(previousState, formData)
  } catch {
    return publicBookingUnavailable()
  }
}

/** Hides late or dismissed results that belong to a different browser attempt. */
export function publicBookingActionStateForAttempt(
  state: PublicBookingActionState,
  resultRequestId: string,
  currentRequestId: string,
): PublicBookingActionState {
  return resultRequestId && resultRequestId === currentRequestId
    ? state
    : INITIAL_PUBLIC_BOOKING_ACTION_STATE
}

/** Formats the fixed action result into one accessible client status message. */
export function publicBookingActionStatusMessage(
  state: PublicBookingActionState,
  retrySeconds: number,
): string {
  if (state.status === "IDLE" || state.status === "SUCCESS") return ""
  if (state.status === "RATE_LIMITED" && retrySeconds > 0) {
    return `${state.message} ${publicBookingRetryDelayLabel(retrySeconds)}`
  }
  if (state.status === "UNAVAILABLE") {
    return `${state.message} Try again when you're ready.`
  }
  return state.message
}

/** Announces a rate limit once while waiting and once again when retry opens. */
export function publicBookingActionAnnouncement(
  state: PublicBookingActionState,
  retrySeconds: number,
): string {
  if (state.status === "RATE_LIMITED" && retrySeconds <= 0) {
    return PUBLIC_BOOKING_RETRY_READY_MESSAGE
  }
  return publicBookingActionStatusMessage(state, 0)
}
