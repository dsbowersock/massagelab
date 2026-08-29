"use client"

import * as React from "react"
import { flushSync, useFormStatus } from "react-dom"

import {
  AsyncActionButton,
  type AsyncActionButtonProps,
} from "@/components/forms/async-action-button"

const NativeSubmissionPendingContext = React.createContext(false)

export type PendingSubmissionFormProps = React.ComponentProps<"form">

/**
 * Preserves framework Server Action identity while giving native POST forms a
 * synchronous first-valid-submit claim before their document navigation.
 */
export function PendingSubmissionForm({
  action,
  method,
  onSubmit,
  children,
  ...formProps
}: PendingSubmissionFormProps) {
  const [nativePending, setNativePending] = React.useState(false)
  const pendingRef = React.useRef(false)

  if (typeof action === "function") {
    return (
      <NativeSubmissionPendingContext.Provider value={false}>
        <form {...formProps} action={action} onSubmit={onSubmit}>
          {children}
        </form>
      </NativeSubmissionPendingContext.Provider>
    )
  }

  function claimNativeSubmission(event: React.SubmitEvent<HTMLFormElement>) {
    onSubmit?.(event)
    if (event.defaultPrevented) return
    if (pendingRef.current) {
      event.preventDefault()
      return
    }
    if (!event.currentTarget.checkValidity()) return

    pendingRef.current = true
    flushSync(() => setNativePending(true))
  }

  return (
    <NativeSubmissionPendingContext.Provider value={nativePending}>
      <form
        {...formProps}
        action={action}
        method={method}
        onSubmit={claimNativeSubmission}
        aria-busy={nativePending}
      >
        {children}
      </form>
    </NativeSubmissionPendingContext.Provider>
  )
}

export type PendingSubmitButtonProps = Omit<AsyncActionButtonProps, "pending">

/** Reads framework settlement or the native form claim from the nearest owner. */
export function PendingSubmitButton(props: PendingSubmitButtonProps) {
  const { pending: frameworkPending } = useFormStatus()
  const nativePending = React.useContext(NativeSubmissionPendingContext)
  const pending = frameworkPending || nativePending

  return (
    <AsyncActionButton {...props} pending={pending} />
  )
}
