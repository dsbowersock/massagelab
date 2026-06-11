export type AccountRole = "USER" | "STUDENT" | "LICENSED_THERAPIST" | "CLIENT" | "EDITOR" | "ANATOMY_ADMIN" | "ADMIN"

export type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "EXPIRED" | "REJECTED" | "REVOKED"

export type CredentialKind = "MASSAGE_LICENSE" | "STUDENT_ENROLLMENT" | "INTERSTATE_MASSAGE_COMPACT" | "MANUAL_REVIEW"

export type AccountCapabilities = {
  canAdministerAccounts: boolean
  canManageAnatomyContent: boolean
  canManageClients: boolean
  canRequestCredentials: boolean
  canUseLocalClinicalTools: boolean
  canUseChimerCustomColors: boolean
  hostedClinicalSyncEnabled: boolean
}

export type AuthAttemptPurpose = "LOGIN" | "REGISTER" | "PASSWORD_RESET" | "TWO_FACTOR"

export type AnatomyKind =
  | "SYSTEM"
  | "ORGAN"
  | "TISSUE"
  | "BONE"
  | "MUSCLE"
  | "JOINT"
  | "NERVE"
  | "VESSEL"
  | "LIGAMENT"
  | "TENDON"
  | "CELL"
  | "OTHER"

export type AnatomyDifficulty = "EASY" | "MEDIUM" | "HARD"

export type AnatomyStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED"

export type AnatomyMediaReviewStatus = "APPROVED" | "NEEDS_REVIEW" | "REJECTED"

export type CorrectionFlagStatus = "OPEN" | "RESOLVED" | "REJECTED"
