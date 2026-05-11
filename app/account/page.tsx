import Link from "next/link"
import { BadgeCheck, Shield, ShieldAlert, UserRound } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { requestCredentialVerificationAction, saveProfileAction } from "@/app/account/actions"
import { PreferenceSync } from "@/app/account/preference-sync"
import { SignOutButton } from "@/app/account/sign-out-button"
import { canManageAnatomyContent } from "@/lib/account-permissions"
import { getClinicalSyncReadiness } from "@/lib/phi-sync"
import { US_MASSAGE_JURISDICTIONS } from "@/lib/license-verification"
import type { AccountRole, VerificationStatus } from "@/lib/domain-types"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"

export default async function AccountPage() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return (
      <AccountShell>
        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle>Sign in to sync your account</CardTitle>
            <CardDescription>
              Anonymous use still works. Accounts sync preferences, progress, templates, and profile defaults only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-primary hover:bg-brand-orange-glow">
              <Link href="/login">Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      </AccountShell>
    )
  }

  const [profile, roles, credentialVerifications, preferences, progressCount, achievementCount, templateCount] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: session.user.id } }),
    prisma.userRole.findMany({ where: { userId: session.user.id }, select: { role: true, status: true } }),
    prisma.credentialVerification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.userPreference.findUnique({ where: { userId: session.user.id }, select: { updatedAt: true } }),
    prisma.learningProgress.count({ where: { userId: session.user.id } }),
    prisma.achievement.count({ where: { userId: session.user.id } }),
    prisma.noteTemplate.count({ where: { userId: session.user.id } }),
  ])

  const clinicalSyncReadiness = getClinicalSyncReadiness()
  const roleRows = roles as Array<{ role: AccountRole; status: VerificationStatus }>
  const roleLabels: AccountRole[] =
    roleRows.length > 0 ? roleRows.map((roleRow) => roleRow.role).sort() : [session.user.role as AccountRole]
  const canManageAnatomy = canManageAnatomyContent(roleLabels)

  return (
    <AccountShell>
      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-brand-orange" />
            Account
          </CardTitle>
          <CardDescription>
            Signed in as {session.user.email}. Cloud sync is limited to non-PHI account data in this alpha.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <StatusTile label="Roles" value={roleLabels.join(", ")} />
            <StatusTile label="Preferences" value={preferences?.updatedAt ? "Synced" : "Not synced yet"} />
            <StatusTile label="Security" value={session.user.twoFactorEnabled ? "2FA enabled" : "2FA available"} />
            <StatusTile label="Clinical sync" value={clinicalSyncReadiness.enabled ? "Enabled" : "Local-first only"} />
            <StatusTile label="Progress items" value={String(progressCount)} />
            <StatusTile label="Achievements" value={String(achievementCount)} />
            <StatusTile label="Templates" value={String(templateCount)} />
          </div>

          <PreferenceSync hasCloudPreferences={Boolean(preferences)} />

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/account/security">Security settings</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/anatomy/corrections">Flag anatomy content</Link>
            </Button>
            <SignOutButton />
          </div>
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-brand-orange" />
            Role verification
          </CardTitle>
          <CardDescription>
            Ohio massage licenses can verify automatically. Student enrollment and other jurisdictions stay pending until MassageLab can review the credential.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            {roleRows.map((roleRow) => (
              <StatusTile key={roleRow.role} label={formatRole(roleRow.role)} value={formatStatus(roleRow.status)} />
            ))}
          </div>

          {credentialVerifications.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Recent verification requests</h3>
              <div className="space-y-2">
                {credentialVerifications.map((verification) => {
                  const reasonLabel = verificationReasonLabel(verification.verificationPayload)
                  const proofSummary = verificationProofSummary(verification.verificationPayload)

                  return (
                    <div key={verification.id} className="rounded-md border border-neutral-800 bg-background/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{formatCredentialKind(verification.kind)}</p>
                        <span className="rounded-sm border border-brand-orange/40 px-2 py-1 text-xs text-brand-orange">
                          {formatStatus(verification.status as VerificationStatus)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[verification.jurisdictionCode, verification.issuingAuthority, verification.credentialNumber]
                          .filter(Boolean)
                          .join(" · ") || "Pending review"}
                      </p>
                      {reasonLabel ? <p className="mt-2 text-xs text-muted-foreground">Result: {reasonLabel}</p> : null}
                      {proofSummary ? <p className="mt-1 text-xs text-muted-foreground">{proofSummary}</p> : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          <form action={requestCredentialVerificationAction} className="grid gap-4 border-t pt-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="credential_kind">Credential type</Label>
              <select
                id="credential_kind"
                name="credential_kind"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue="MASSAGE_LICENSE"
              >
                <option value="MASSAGE_LICENSE">Massage license</option>
                <option value="STUDENT_ENROLLMENT">Student enrollment</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jurisdiction_code">State or jurisdiction</Label>
              <select
                id="jurisdiction_code"
                name="jurisdiction_code"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue="OH"
              >
                {US_MASSAGE_JURISDICTIONS.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="credential_number">License or enrollment identifier</Label>
              <Input id="credential_number" name="credential_number" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issuing_authority">Issuing school, board, or agency</Label>
              <Input id="issuing_authority" name="issuing_authority" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal_first_name">Legal first name</Label>
              <Input id="legal_first_name" name="legal_first_name" autoComplete="given-name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal_middle_name">Legal middle name or initial</Label>
              <Input id="legal_middle_name" name="legal_middle_name" autoComplete="additional-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal_last_name">Legal last name</Label>
              <Input id="legal_last_name" name="legal_last_name" autoComplete="family-name" required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="evidence_description">Evidence notes</Label>
              <Input
                id="evidence_description"
                name="evidence_description"
                placeholder="Example: enrollment letter dated 2026-05-01, or Ohio eLicense lookup available"
              />
            </div>
            <p className="text-xs text-muted-foreground md:col-span-2">
              Ohio massage license requests run an automatic eLicense check. Other jurisdictions and student enrollment remain pending for review.
            </p>
            <div className="md:col-span-2">
              <Button type="submit" variant="outline">
                Request verification
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-brand-orange/40 bg-primary/10 backdrop-blur">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <ShieldAlert className="mt-1 h-5 w-5 text-brand-orange" />
          <div>
            <CardTitle>Clinical sync is not hosted yet</CardTitle>
            <CardDescription>
              Notes, intake forms, journals, and range-of-motion data stay on the user&apos;s device. MassageLab is structured for future compliant sync, but it will stay off until BAAs, risk review, audit controls, and sustainable funding are in place.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/roadmap">Support the clinical sync roadmap</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle>Profile defaults</CardTitle>
          <CardDescription>
            These fields can pre-fill your own profile and documentation defaults. Do not enter client-identifying information here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveProfileAction} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="display_name">Display name</Label>
                <Input id="display_name" name="display_name" defaultValue={profile?.displayName ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="therapist_name">Therapist name</Label>
                <Input id="therapist_name" name="therapist_name" defaultValue={profile?.therapistName ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="therapist_location">Practice location</Label>
              <Input id="therapist_location" name="therapist_location" defaultValue={profile?.therapistLocation ?? ""} />
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="license_number">License number</Label>
                <Input id="license_number" name="license_number" defaultValue={profile?.licenseNumber ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="license_organization">Licensing organization</Label>
                <Input id="license_organization" name="license_organization" defaultValue={profile?.licenseOrganization ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npi_number">NPI number</Label>
                <Input id="npi_number" name="npi_number" defaultValue={profile?.npiNumber ?? ""} />
              </div>
            </div>
            <Button type="submit" className="bg-primary hover:bg-brand-orange-glow">
              Save profile
            </Button>
          </form>
        </CardContent>
      </Card>

      {canManageAnatomy ? (
        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-brand-orange" />
              Content tools
            </CardTitle>
            <CardDescription>Admin and editor roles can manage the anatomy content database.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/admin/anatomy">Open anatomy admin</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </AccountShell>
  )
}

function AccountShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeading>Account</PageHeading>
        {children}
      </div>
    </div>
  )
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-background/70 p-3">
      <p className="text-xs uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  )
}

function formatRole(role: AccountRole) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatStatus(status: VerificationStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

function formatCredentialKind(kind: string) {
  return kind
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function verificationReasonLabel(value: unknown) {
  const payload = jsonRecord(value)
  const reasonCode = payload.reasonCode

  return typeof reasonCode === "string" ? formatReasonCode(reasonCode) : null
}

function verificationProofSummary(value: unknown) {
  const payload = jsonRecord(value)
  const proof = jsonRecord(payload.proof)
  const sourceName = typeof proof.sourceName === "string" ? proof.sourceName : "Verifier"
  const status = typeof proof.status === "string" ? proof.status : null
  const expirationDate = typeof proof.expirationDate === "string" ? proof.expirationDate : null
  const boardAction = typeof proof.boardAction === "string" ? proof.boardAction : null
  const pieces = [
    status ? `${sourceName} status: ${status}` : null,
    expirationDate ? `Expires: ${expirationDate}` : null,
    boardAction ? `Board action: ${boardAction}` : null,
  ].filter(Boolean)

  return pieces.length > 0 ? pieces.join(" · ") : null
}

function formatReasonCode(reasonCode: string) {
  return reasonCode
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}
