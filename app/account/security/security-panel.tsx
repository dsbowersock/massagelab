"use client"

import { useRef, useState } from "react"

import { SignInMethodsPanel } from "@/app/account/security/sign-in-methods-panel"
import { TwoFactorManagementPanel } from "@/app/account/security/two-factor-management-panel"

type SecurityPanelProps = {
  twoFactorEnabled: boolean
  hasPasswordCredential: boolean
  googleLinked: boolean
  googlePrimaryProofReady: boolean
}

export type PendingSecurityAction =
  | "google-proof"
  | "password"
  | "unlink-google"
  | "disable-password"
  | "setup"
  | "enable"
  | "disable"
  | "backup-codes"
  | "backup-codes-sign-out"
  | "two-factor-sign-out"
  | null

export type SignInMethodAvailability = {
  hasPasswordCredential: boolean
  googleLinked: boolean
}

/** Coordinates one shared action lock and the method availability consumed by both panels. */
export function SecurityPanel({
  twoFactorEnabled,
  hasPasswordCredential,
  googleLinked,
  googlePrimaryProofReady,
}: SecurityPanelProps) {
  const [pendingAction, setPendingAction] = useState<PendingSecurityAction>(null)
  const [methodAvailability, setMethodAvailability] = useState<SignInMethodAvailability>({
    hasPasswordCredential,
    googleLinked,
  })
  const actionLock = useRef<PendingSecurityAction>(null)

  function beginAction(action: Exclude<PendingSecurityAction, null>) {
    if (actionLock.current !== null) return false
    actionLock.current = action
    setPendingAction(action)
    return true
  }

  function finishAction(action: Exclude<PendingSecurityAction, null>) {
    if (actionLock.current !== action) return
    actionLock.current = null
    setPendingAction(null)
  }

  /** Applies only fields returned by a successful method mutation. */
  function updateMethodAvailability(update: Partial<SignInMethodAvailability>) {
    setMethodAvailability((current) => ({
      hasPasswordCredential: update.hasPasswordCredential ?? current.hasPasswordCredential,
      googleLinked: update.googleLinked ?? current.googleLinked,
    }))
  }

  return (
    <div className="space-y-6">
      <SignInMethodsPanel
        hasPasswordCredential={methodAvailability.hasPasswordCredential}
        googleLinked={methodAvailability.googleLinked}
        pendingAction={pendingAction}
        beginAction={beginAction}
        finishAction={finishAction}
        onMethodAvailabilityChange={updateMethodAvailability}
      />
      <TwoFactorManagementPanel
        twoFactorEnabled={twoFactorEnabled}
        hasPasswordCredential={methodAvailability.hasPasswordCredential}
        googleLinked={methodAvailability.googleLinked}
        googlePrimaryProofReady={googlePrimaryProofReady}
        pendingAction={pendingAction}
        beginAction={beginAction}
        finishAction={finishAction}
      />
    </div>
  )
}
