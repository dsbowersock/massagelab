"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { flushSync } from "react-dom"
import {
  DONATION_CHECKOUT_ATTEMPT_STORAGE_KEY,
  donationCheckoutAttemptForAmount,
  readDonationCheckoutAttempt,
  shouldClearDonationCheckoutAttempt,
} from "@/lib/donation-checkout-attempt"

type DonationOption = {
  amountCents: number
  label: string
  description: string
}

type DonationCheckoutFormProps = {
  options: readonly DonationOption[]
  initialAttemptId: string
  returnCode?: string
}

/**
 * Owns one native donation form and its first-party retry identity. No client
 * request is replayed automatically: persistence only lets the user's next
 * explicit submit reuse the same provider attempt after an ambiguous result.
 */
export function DonationCheckoutForm({
  options,
  initialAttemptId,
  returnCode,
}: DonationCheckoutFormProps) {
  const amountInputRef = useRef<HTMLInputElement>(null)
  const attemptInputRef = useRef<HTMLInputElement>(null)
  const unusedInitialIdRef = useRef<string | null>(initialAttemptId)
  const [pending, setPending] = useState(false)
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [storageError, setStorageError] = useState(false)

  useEffect(() => {
    const resetPending = () => setPending(false)
    window.addEventListener("pageshow", resetPending)

    try {
      if (shouldClearDonationCheckoutAttempt(returnCode)) {
        sessionStorage.removeItem(DONATION_CHECKOUT_ATTEMPT_STORAGE_KEY)
      } else {
        const storedValue = sessionStorage.getItem(DONATION_CHECKOUT_ATTEMPT_STORAGE_KEY)
        const stored = readDonationCheckoutAttempt(storedValue)
        if (!stored) {
          if (storedValue !== null) {
            sessionStorage.removeItem(DONATION_CHECKOUT_ATTEMPT_STORAGE_KEY)
          }
        } else {
          unusedInitialIdRef.current = null
          if (amountInputRef.current) amountInputRef.current.value = String(stored.amountCents)
          if (attemptInputRef.current) attemptInputRef.current.value = stored.attemptId
          setSelectedAmount(stored.amountCents)
        }
      }
    } catch {
      // Browser storage may be unavailable. The server-issued hidden UUID still
      // supports one no-JavaScript-style submission, but enhanced submission
      // remains stopped until its retry record can be persisted.
      setStorageError(true)
    }

    return () => window.removeEventListener("pageshow", resetPending)
  }, [returnCode])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const amountCents = Number((submitter as HTMLButtonElement | null)?.value)
    const amountAllowed = options.some((option) => option.amountCents === amountCents)
    if (!amountAllowed || !amountInputRef.current || !attemptInputRef.current) {
      event.preventDefault()
      return
    }

    try {
      const current = readDonationCheckoutAttempt(
        sessionStorage.getItem(DONATION_CHECKOUT_ATTEMPT_STORAGE_KEY),
      )
      if (current) unusedInitialIdRef.current = null
      const attempt = donationCheckoutAttemptForAmount({
        current,
        amountCents,
        createId: () => {
          const initialId = unusedInitialIdRef.current
          unusedInitialIdRef.current = null
          return initialId ?? crypto.randomUUID()
        },
      })

      amountInputRef.current.value = String(attempt.amountCents)
      attemptInputRef.current.value = attempt.attemptId
      sessionStorage.setItem(
        DONATION_CHECKOUT_ATTEMPT_STORAGE_KEY,
        JSON.stringify(attempt),
      )
      event.preventDefault()
      flushSync(() => {
        setSelectedAmount(amountCents)
        setStorageError(false)
        setPending(true)
      })
      // The synchronous React commit may reconcile uncontrolled defaults, so
      // restore the already-persisted canonical fields before serialization.
      amountInputRef.current.value = String(attempt.amountCents)
      attemptInputRef.current.value = attempt.attemptId

      // Native navigation begins before React would ordinarily paint updates
      // queued by this submit event. Commit the pending owner first, then use
      // the platform submission so retries remain explicit page navigations.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          HTMLFormElement.prototype.submit.call(form)
        })
      })
    } catch {
      event.preventDefault()
      setPending(false)
      setStorageError(true)
    }
  }

  function startNewAttempt() {
    try {
      sessionStorage.removeItem(DONATION_CHECKOUT_ATTEMPT_STORAGE_KEY)
      const nextAttemptId = crypto.randomUUID()
      unusedInitialIdRef.current = nextAttemptId
      if (amountInputRef.current) amountInputRef.current.value = ""
      if (attemptInputRef.current) attemptInputRef.current.value = nextAttemptId
      setSelectedAmount(null)
      setPending(false)
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }

  return (
    <form
      action="/api/billing/donation"
      method="post"
      onSubmitCapture={handleSubmit}
      aria-busy={pending}
      className="space-y-3"
    >
      <input ref={amountInputRef} type="hidden" name="amountCents" defaultValue="" />
      <input ref={attemptInputRef} type="hidden" name="checkoutAttemptId" defaultValue={initialAttemptId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {options.map((option) => (
          <button
            key={option.amountCents}
            type="submit"
            name="amountCents"
            value={option.amountCents}
            disabled={pending}
            aria-pressed={selectedAmount === option.amountCents}
            aria-label={`${option.label} ${option.description}`}
            className="min-h-12 rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-lg font-semibold text-foreground shadow-sm transition hover:border-primary hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          disabled={pending}
          onClick={startNewAttempt}
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60"
        >
          Start a new checkout attempt
        </button>
        {pending ? <span role="status">Opening secure checkout…</span> : null}
        {storageError ? (
          <span role="alert" className="text-destructive">
            Checkout could not start in this browser. Please try again.
          </span>
        ) : null}
      </div>
    </form>
  )
}
