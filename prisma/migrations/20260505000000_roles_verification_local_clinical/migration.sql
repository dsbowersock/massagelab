-- Extend account roles beyond the original alpha content-admin hierarchy.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'STUDENT';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'LICENSED_THERAPIST';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CLIENT';

CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED', 'REVOKED');
CREATE TYPE "CredentialKind" AS ENUM ('MASSAGE_LICENSE', 'STUDENT_ENROLLMENT', 'INTERSTATE_MASSAGE_COMPACT', 'MANUAL_REVIEW');
CREATE TYPE "VerificationSourceType" AS ENUM ('SELF_ATTESTATION', 'STATE_LICENSE_LOOKUP', 'DOCUMENT_REVIEW', 'MANUAL_REVIEW', 'COMPACT_REGISTRY');
CREATE TYPE "JurisdictionSupportStatus" AS ENUM ('ADAPTER_AVAILABLE', 'PUBLIC_LOOKUP_AVAILABLE', 'MANUAL_REVIEW_REQUIRED', 'PLANNED', 'UNSUPPORTED');
CREATE TYPE "TherapistClientStatus" AS ENUM ('INVITED', 'ACTIVE', 'PAUSED', 'REVOKED');
CREATE TYPE "ClinicalArtifactKind" AS ENUM ('SOAP_NOTE', 'INTAKE_FORM', 'PAIN_JOURNAL', 'SENSATION_JOURNAL', 'INCIDENT_JOURNAL', 'ROM_MEASUREMENT', 'MOVEMENT_SESSION');
CREATE TYPE "ClinicalArtifactStatus" AS ENUM ('LOCAL_ONLY', 'DRAFT', 'FINALIZED', 'RELEASE_REQUESTED', 'RELEASED', 'ARCHIVED');

ALTER TABLE "UserRole"
  ADD COLUMN "status" "VerificationStatus" NOT NULL DEFAULT 'VERIFIED',
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "grantedById" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "UserRole"
SET "verifiedAt" = COALESCE("verifiedAt", "createdAt");

ALTER TABLE "UserRole"
  ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE TABLE "CredentialVerification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "CredentialKind" NOT NULL,
  "role" "Role",
  "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  "jurisdictionCode" TEXT,
  "credentialNumber" TEXT,
  "issuingAuthority" TEXT,
  "displayLabel" TEXT,
  "sourceType" "VerificationSourceType" NOT NULL DEFAULT 'SELF_ATTESTATION',
  "sourceUrl" TEXT,
  "evidenceDescription" TEXT,
  "verificationPayload" JSONB NOT NULL DEFAULT '{}',
  "checkedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CredentialVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JurisdictionVerifier" (
  "id" TEXT NOT NULL,
  "jurisdictionCode" TEXT NOT NULL,
  "jurisdictionName" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL DEFAULT 'US',
  "massageBoardName" TEXT,
  "lookupUrl" TEXT,
  "supportStatus" "JurisdictionSupportStatus" NOT NULL DEFAULT 'MANUAL_REVIEW_REQUIRED',
  "compactEligible" BOOLEAN NOT NULL DEFAULT false,
  "compactStatus" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JurisdictionVerifier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TherapistClientRelationship" (
  "id" TEXT NOT NULL,
  "therapistUserId" TEXT NOT NULL,
  "clientUserId" TEXT,
  "clientEmail" TEXT,
  "status" "TherapistClientStatus" NOT NULL DEFAULT 'INVITED',
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TherapistClientRelationship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClinicalArtifactManifest" (
  "id" TEXT NOT NULL,
  "kind" "ClinicalArtifactKind" NOT NULL,
  "status" "ClinicalArtifactStatus" NOT NULL DEFAULT 'LOCAL_ONLY',
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "localDocumentId" TEXT NOT NULL,
  "authorUserId" TEXT,
  "subjectUserId" TEXT,
  "therapistUserId" TEXT,
  "relationshipId" TEXT,
  "finalizedAt" TIMESTAMP(3),
  "releaseRequestedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicalArtifactManifest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClinicalAccessAuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "targetUserId" TEXT,
  "clinicalArtifactId" TEXT,
  "action" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClinicalAccessAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CredentialVerification_userId_kind_jurisdictionCode_credentialNumber_key" ON "CredentialVerification"("userId", "kind", "jurisdictionCode", "credentialNumber");
CREATE INDEX "CredentialVerification_userId_kind_status_idx" ON "CredentialVerification"("userId", "kind", "status");
CREATE INDEX "CredentialVerification_jurisdictionCode_status_idx" ON "CredentialVerification"("jurisdictionCode", "status");
CREATE INDEX "CredentialVerification_role_status_idx" ON "CredentialVerification"("role", "status");

CREATE UNIQUE INDEX "JurisdictionVerifier_jurisdictionCode_key" ON "JurisdictionVerifier"("jurisdictionCode");
CREATE INDEX "JurisdictionVerifier_countryCode_supportStatus_idx" ON "JurisdictionVerifier"("countryCode", "supportStatus");

CREATE UNIQUE INDEX "TherapistClientRelationship_therapistUserId_clientUserId_key" ON "TherapistClientRelationship"("therapistUserId", "clientUserId");
CREATE INDEX "TherapistClientRelationship_therapistUserId_status_idx" ON "TherapistClientRelationship"("therapistUserId", "status");
CREATE INDEX "TherapistClientRelationship_clientUserId_status_idx" ON "TherapistClientRelationship"("clientUserId", "status");
CREATE INDEX "TherapistClientRelationship_clientEmail_idx" ON "TherapistClientRelationship"("clientEmail");

CREATE UNIQUE INDEX "ClinicalArtifactManifest_localDocumentId_key" ON "ClinicalArtifactManifest"("localDocumentId");
CREATE INDEX "ClinicalArtifactManifest_authorUserId_kind_idx" ON "ClinicalArtifactManifest"("authorUserId", "kind");
CREATE INDEX "ClinicalArtifactManifest_subjectUserId_kind_idx" ON "ClinicalArtifactManifest"("subjectUserId", "kind");
CREATE INDEX "ClinicalArtifactManifest_therapistUserId_status_idx" ON "ClinicalArtifactManifest"("therapistUserId", "status");
CREATE INDEX "ClinicalArtifactManifest_relationshipId_status_idx" ON "ClinicalArtifactManifest"("relationshipId", "status");

CREATE INDEX "ClinicalAccessAuditLog_actorUserId_createdAt_idx" ON "ClinicalAccessAuditLog"("actorUserId", "createdAt");
CREATE INDEX "ClinicalAccessAuditLog_targetUserId_createdAt_idx" ON "ClinicalAccessAuditLog"("targetUserId", "createdAt");
CREATE INDEX "ClinicalAccessAuditLog_clinicalArtifactId_createdAt_idx" ON "ClinicalAccessAuditLog"("clinicalArtifactId", "createdAt");
CREATE INDEX "ClinicalAccessAuditLog_action_createdAt_idx" ON "ClinicalAccessAuditLog"("action", "createdAt");

CREATE INDEX "UserRole_role_status_idx" ON "UserRole"("role", "status");
CREATE INDEX "UserRole_userId_status_idx" ON "UserRole"("userId", "status");

ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CredentialVerification" ADD CONSTRAINT "CredentialVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CredentialVerification" ADD CONSTRAINT "CredentialVerification_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TherapistClientRelationship" ADD CONSTRAINT "TherapistClientRelationship_therapistUserId_fkey" FOREIGN KEY ("therapistUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TherapistClientRelationship" ADD CONSTRAINT "TherapistClientRelationship_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalArtifactManifest" ADD CONSTRAINT "ClinicalArtifactManifest_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalArtifactManifest" ADD CONSTRAINT "ClinicalArtifactManifest_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalArtifactManifest" ADD CONSTRAINT "ClinicalArtifactManifest_therapistUserId_fkey" FOREIGN KEY ("therapistUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalArtifactManifest" ADD CONSTRAINT "ClinicalArtifactManifest_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "TherapistClientRelationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalAccessAuditLog" ADD CONSTRAINT "ClinicalAccessAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalAccessAuditLog" ADD CONSTRAINT "ClinicalAccessAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalAccessAuditLog" ADD CONSTRAINT "ClinicalAccessAuditLog_clinicalArtifactId_fkey" FOREIGN KEY ("clinicalArtifactId") REFERENCES "ClinicalArtifactManifest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
