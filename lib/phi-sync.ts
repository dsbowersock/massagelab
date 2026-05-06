export type ClinicalSyncReadiness = {
  enabled: boolean
  enableFlagSet: boolean
  baaConfirmed: boolean
  riskReviewConfirmed: boolean
  reason: string
}

export function getClinicalSyncReadiness(): ClinicalSyncReadiness {
  const enableFlagSet = process.env.MASSAGELAB_ENABLE_HOSTED_PHI_SYNC === "true"
  const baaConfirmed = process.env.MASSAGELAB_HIPAA_BAA_CONFIRMED === "true"
  const riskReviewConfirmed = process.env.MASSAGELAB_HIPAA_RISK_REVIEW_CONFIRMED === "true"
  const enabled = enableFlagSet && baaConfirmed && riskReviewConfirmed

  if (enabled) {
    return {
      enabled,
      enableFlagSet,
      baaConfirmed,
      riskReviewConfirmed,
      reason: "Hosted clinical sync is enabled by explicit compliance flags.",
    }
  }

  return {
    enabled,
    enableFlagSet,
    baaConfirmed,
    riskReviewConfirmed,
    reason:
      "Hosted clinical sync is disabled until compliant hosting, BAAs, risk review, audit controls, and PHI-safe operations are confirmed.",
  }
}

export function isHostedClinicalSyncEnabled() {
  return getClinicalSyncReadiness().enabled
}
