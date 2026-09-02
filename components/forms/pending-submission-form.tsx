"use client"

import * as React from "react"
import { flushSync, useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import { Loader } from "@/components/ui/loader"
import { MetalAttentionButton } from "@/components/ui/metal-attention-button"
import { cn } from "@/lib/utils"

/**
 * `null` means no native form owns pending state; function-action buttons use
 * `useFormStatus` instead, while booleans represent native-form ownership.
 */
const NativeSubmissionPendingContext = React.createContext<boolean | null>(null)

type PendingSubmissionErrorBoundaryState = {
  failed: boolean
  recoveryKey: number
}

type PendingSubmissionErrorBoundaryProps = {
  children: React.ReactElement<React.ComponentPropsWithoutRef<"form">>
}

/** Remounts a rejected Server Action form and clears its alert when an explicit retry begins. */
class PendingSubmissionErrorBoundary extends React.Component<PendingSubmissionErrorBoundaryProps, PendingSubmissionErrorBoundaryState> {
  state: PendingSubmissionErrorBoundaryState = { failed: false, recoveryKey: 0 }

  static getDerivedStateFromError(): Pick<PendingSubmissionErrorBoundaryState, "failed"> {
    return { failed: true }
  }

  componentDidCatch() {
    this.setState((state) => ({ recoveryKey: state.recoveryKey + 1 }))
  }

  render() {
    const { children } = this.props
    const originalOnSubmitCapture = children.props.onSubmitCapture
    const form = React.cloneElement(children, {
      key: this.state.recoveryKey,
      onSubmitCapture: (event: React.SubmitEvent<HTMLFormElement>) => {
        originalOnSubmitCapture?.(event)
        if (!event.defaultPrevented && this.state.failed) {
          this.setState({ failed: false })
        }
      },
    })

    return (
      <>
        {this.state.failed ? (
          <p role="alert" aria-live="assertive">Something went wrong. Please try again.</p>
        ) : null}
        {form}
      </>
    )
  }
}

export type PendingSubmissionFormProps = Omit<
  React.ComponentPropsWithoutRef<"form">,
  "onSubmit" | "aria-busy"
> & { pendingLabel: string }

type FrameworkFormAction = Exclude<
  NonNullable<React.ComponentPropsWithoutRef<"form">["action"]>,
  string
>

type FrameworkPendingSubmissionFormProps = Omit<
  PendingSubmissionFormProps,
  "action" | "pendingLabel"
> & {
  action: FrameworkFormAction
  pendingLabel?: string
}

/**
 * Preserves framework Server Action identity while giving native POST forms a
 * synchronous first-valid-submit claim before their document navigation.
 */
export function PendingSubmissionForm(props: PendingSubmissionFormProps): React.ReactElement
export function PendingSubmissionForm(props: FrameworkPendingSubmissionFormProps): React.ReactElement
export function PendingSubmissionForm({
  action,
  method,
  pendingLabel,
  children,
  ...formProps
}: PendingSubmissionFormProps | FrameworkPendingSubmissionFormProps) {
  const [nativePending, setNativePending] = React.useState(false)
  const pendingRef = React.useRef(false)

  React.useEffect(() => {
    const resetRestoredSubmission = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      // A restored native navigation can retain its claimed UI; release both the
      // synchronous duplicate guard and rendered pending state after bfcache.
      pendingRef.current = false
      setNativePending(false)
    }
    window.addEventListener("pageshow", resetRestoredSubmission)
    return () => window.removeEventListener("pageshow", resetRestoredSubmission)
  }, [])

  // Function actions settle through React without document navigation, so native
  // claiming would not observe settlement; `useFormStatus` owns their lifecycle.
  if (typeof action === "function") {
    return (
      <NativeSubmissionPendingContext.Provider value={null}>
        <PendingSubmissionErrorBoundary>
          <form {...formProps} action={action} method={method}>
            {children}
          </form>
        </PendingSubmissionErrorBoundary>
      </NativeSubmissionPendingContext.Provider>
    )
  }

  function claimNativeSubmission(event: React.SubmitEvent<HTMLFormElement>) {
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
        <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {nativePending ? pendingLabel : ""}
        </span>
      </form>
    </NativeSubmissionPendingContext.Provider>
  )
}

export type PendingSubmitButtonProps =
  Omit<React.ComponentProps<typeof Button>, "children" | "aria-busy"> & {
    children: React.ReactNode
    pendingLabel: string
    presentation?: "button" | "metal-attention"
    metalFullWidth?: boolean
  }

type FrameworkPendingSubmitButtonProps = Omit<
  PendingSubmitButtonProps,
  "children"
> & {
  idleLabel: string
}

type PendingSubmitButtonImplementationProps = Omit<
  PendingSubmitButtonProps,
  "children"
> & {
  children?: React.ReactNode
  idleLabel?: string
}

/**
 * Shares one pending lifecycle with its form while preserving the caller's
 * Button presentation; native form status remains owned by the parent form.
 * The private `idleLabel` overload keeps existing framework-action consumers
 * source-compatible while native billing callers use the child-based contract.
 */
export function PendingSubmitButton(props: PendingSubmitButtonProps): React.ReactElement
export function PendingSubmitButton(props: FrameworkPendingSubmitButtonProps): React.ReactElement
export function PendingSubmitButton({
  children,
  idleLabel,
  pendingLabel,
  presentation = "button",
  metalFullWidth,
  className,
  disabled = false,
  ...buttonProps
}: PendingSubmitButtonImplementationProps) {
  const { pending: frameworkPending } = useFormStatus()
  const nativeSubmissionPending = React.useContext(NativeSubmissionPendingContext)
  const nativeFormOwnsStatus = nativeSubmissionPending !== null
  const nativePending = nativeSubmissionPending === true
  const pending = frameworkPending || nativePending
  const content = (
    <span className="grid place-items-center">
      <span
        aria-hidden={pending}
        className={cn("col-start-1 row-start-1 inline-flex items-center gap-2", pending && "invisible")}
      >
        {children ?? idleLabel}
      </span>
      <span
        aria-hidden={!pending}
        className={cn("col-start-1 row-start-1 inline-flex items-center gap-2", !pending && "invisible")}
      >
        <Loader size={18} color="currentColor" aria-hidden="true" />
        {pendingLabel}
      </span>
    </span>
  )

  return (
    <>
      {presentation === "metal-attention" ? (
        <MetalAttentionButton
          {...buttonProps}
          className={cn("inline-flex", className)}
          disabled={pending || disabled}
          aria-busy={pending}
          metalFullWidth={metalFullWidth}
        >
          {content}
        </MetalAttentionButton>
      ) : (
        <Button
          {...buttonProps}
          className={cn("inline-flex", className)}
          disabled={pending || disabled}
          aria-busy={pending}
        >
          {content}
        </Button>
      )}
      {!nativeFormOwnsStatus ? (
        <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {frameworkPending ? pendingLabel : ""}
        </span>
      ) : null}
    </>
  )
}
