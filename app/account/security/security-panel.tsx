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

/** Coordinates one shared action lock while each security panel owns its state. */
export function SecurityPanel({
  twoFactorEnabled,
  hasPasswordCredential,
  googleLinked,
  googlePrimaryProofReady,
}: SecurityPanelProps) {
  const [pendingAction, setPendingAction] = useState<PendingSecurityAction>(null)
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

  return (
    <div className="space-y-6">
      <SignInMethodsPanel
        hasPasswordCredential={hasPasswordCredential}
        googleLinked={googleLinked}
        pendingAction={pendingAction}
        beginAction={beginAction}
        finishAction={finishAction}
      />
      <TwoFactorManagementPanel
        twoFactorEnabled={twoFactorEnabled}
        hasPasswordCredential={hasPasswordCredential}
        googleLinked={googleLinked}
        googlePrimaryProofReady={googlePrimaryProofReady}
        pendingAction={pendingAction}
        beginAction={beginAction}
        finishAction={finishAction}
      />
    </div>
  )
}
