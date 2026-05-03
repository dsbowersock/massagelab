export type AccountRole = "USER" | "EDITOR" | "ADMIN"

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

export type CorrectionFlagStatus = "OPEN" | "RESOLVED" | "REJECTED"
