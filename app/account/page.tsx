import Link from "next/link"
import { BadgeCheck, CreditCard, GraduationCap, Palette, Shield, ShieldAlert, UserRound } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { requestCredentialVerificationAction, saveProfileAction } from "@/app/account/actions"
import { PreferenceSync } from "@/app/account/preference-sync"
import { SignOutButton } from "@/app/account/sign-out-button"
import { canManageAnatomyContent } from "@/lib/account-permissions"
import { getClinicalSyncReadiness } from "@/lib/phi-sync"
import { US_MASSAGE_JURISDICTIONS } from "@/lib/license-verification"
import { FEATURE_KEYS, getUserMembershipSummary } from "@/lib/membership"
import type { AccountRole, VerificationStatus } from "@/lib/domain-types"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeading } from "@/components/ui/page-heading"

type AccountPageProps = {
  searchParams?: Promise<{
    billing?: string
    checkout?: string
    portal?: string
  }>
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = await searchParams
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return (
      <AccountShell>
        <AccountNotice billing={params?.billing} checkout={params?.checkout} portal={params?.portal} />
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

  const [profile, roles, credentialVerifications, preferences, progressCount, achievementCount, templateCount, membershipSummary] = await Promise.all([
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
    getUserMembershipSummary(prisma, session.user.id),
  ])

  const clinicalSyncReadiness = getClinicalSyncReadiness()
  const roleRows = roles as Array<{ role: AccountRole; status: VerificationStatus }>
  const roleLabels: AccountRole[] =
    roleRows.length > 0 ? roleRows.map((roleRow) => roleRow.role).sort() : [session.user.role as AccountRole]
  const canManageAnatomy = canManageAnatomyContent(roleLabels)
  const canUseChimerCustomColors = membershipSummary.entitlements.features.includes(FEATURE_KEYS.chimerCustomColors)
  const canOpenBillingPortal = Boolean(membershipSummary.stripeCustomer && membershipSummary.subscriptions.length > 0)

  return (
    <AccountShell>
      <AccountNotice
        billing={params?.billing}
        checkout={params?.checkout}
        portal={params?.portal}
        activeMembershipLevel={membershipSummary.entitlements.paidLevel ?? undefined}
      />

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
            <StatusTile label="Membership" value={formatMembershipLevel(membershipSummary.entitlements.level)} />
            <StatusTile label="Chimer colors" value={canUseChimerCustomColors ? "Unlocked" : "Free defaults"} />
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

      <Card id="membership" className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-brand-orange" />
            Membership
          </CardTitle>
          <CardDescription>
            Free access remains available by default. Paid memberships currently unlock Chimer custom colors and membership status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <StatusTile label="Current level" value={formatMembershipLevel(membershipSummary.entitlements.level)} />
            <StatusTile label="Stripe customer" value={membershipSummary.stripeCustomer ? "Connected" : "Not connected"} />
            <StatusTile label="Custom colors" value={canUseChimerCustomColors ? "Available" : "Membership required"} />
          </div>

          <div className="rounded-md border border-brand-orange/30 bg-primary/10 p-3">
            <div className="flex items-start gap-3">
              <Palette className="mt-0.5 h-4 w-4 text-brand-orange" />
              <p className="text-sm text-muted-foreground">
                Basic Chimer remains free. Paid memberships unlock saved custom display and background colors.
              </p>
            </div>
          </div>

          {membershipSummary.configuredOptions.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {membershipSummary.configuredOptions.map((option: { membershipLevel: string; interval: string }) => (
                <form key={`${option.membershipLevel}-${option.interval}`} action="/api/billing/checkout" method="post">
                  <input type="hidden" name="membershipLevel" value={option.membershipLevel} />
                  <input type="hidden" name="interval" value={option.interval} />
                  <Button type="submit" variant="outline" className="w-full justify-between">
                    <span>{formatMembershipLevel(option.membershipLevel)}</span>
                    <span>{formatInterval(option.interval)}</span>
                  </Button>
                </form>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Stripe checkout prices are not configured in this environment yet.
            </p>
          )}

          {membershipSummary.subscriptions.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Subscription status</h3>
              {membershipSummary.subscriptions.slice(0, 3).map((subscription: {
                id: string
                membershipLevel: string
                status: string
                currentPeriodEnd: Date | null
                couponId: string | null
              }) => (
                <div key={subscription.id} className="rounded-md border border-neutral-800 bg-background/70 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{formatMembershipLevel(subscription.membershipLevel)}</span>
                    <span className="rounded-sm border border-brand-orange/40 px-2 py-1 text-xs text-brand-orange">
                      {subscription.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {subscription.currentPeriodEnd ? `Renews through ${subscription.currentPeriodEnd.toLocaleDateString()}` : "Current period unavailable"}
                    {subscription.couponId ? ` · Coupon ${subscription.couponId}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {canOpenBillingPortal ? (
            <form action="/api/billing/portal" method="post">
              <Button type="submit" variant="outline">
                Manage subscription
              </Button>
            </form>
          ) : null}
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
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="student_start_date" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-brand-orange" />
                Student first day of class
              </Label>
              <Input id="student_start_date" name="student_start_date" type="date" />
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

function AccountNotice({
  billing,
  checkout,
  portal,
  activeMembershipLevel,
}: {
  billing?: string
  checkout?: string
  portal?: string
  activeMembershipLevel?: string
}) {
  const notice = accountNotice({ billing, checkout, portal, activeMembershipLevel })

  if (!notice) {
    return null
  }

  return (
    <div className={`rounded-md border p-3 text-sm ${notice.className}`}>
      <p className="font-medium">{notice.title}</p>
      <p className="mt-1 text-muted-foreground">{notice.description}</p>
    </div>
  )
}

function accountNotice({
  billing,
  checkout,
  portal,
  activeMembershipLevel,
}: {
  billing?: string
  checkout?: string
  portal?: string
  activeMembershipLevel?: string
}) {
  if (checkout === "success") {
    if (activeMembershipLevel) {
      return {
        title: `${formatMembershipLevel(activeMembershipLevel)} membership active`,
        description: "Stripe confirmed your membership. Your account benefits are available now.",
        className: "border-brand-orange/40 bg-primary/10",
      }
    }

    return {
      title: "Checkout complete",
      description: "Stripe is syncing your membership. If the status has not updated yet, refresh after the webhook finishes.",
      className: "border-brand-orange/40 bg-primary/10",
    }
  }

  if (checkout === "cancelled") {
    return {
      title: "Checkout cancelled",
      description: "No membership changes were made. Free access remains available.",
      className: "border-neutral-800 bg-card/90",
    }
  }

  if (portal === "returned") {
    return {
      title: "Billing portal closed",
      description: "Any subscription changes made in Stripe will appear here after the webhook syncs.",
      className: "border-brand-orange/40 bg-primary/10",
    }
  }

  if (portal === "customer-not-found") {
    return {
      title: "Billing portal unavailable",
      description: "There is no Stripe customer connected to this account yet.",
      className: "border-neutral-800 bg-card/90",
    }
  }

  if (portal === "error") {
    return {
      title: "Billing portal unavailable",
      description: "Stripe could not start the billing portal. Check the Stripe Customer Portal and secret key configuration.",
      className: "border-destructive/40 bg-destructive/10",
    }
  }

  if (billing) {
    return {
      title: "Checkout unavailable",
      description: billingMessage(billing),
      className: "border-destructive/40 bg-destructive/10",
    }
  }

  return null
}

function billingMessage(code: string) {
  if (code === "unsupported-plan") return "That membership level is not supported for Stripe Checkout."
  if (code === "price-not-configured") return "Stripe prices are not configured for that membership option yet."
  if (code === "account-not-found") return "The signed-in account could not be found."
  if (code === "checkout-error") return "Stripe Checkout could not be started. Check the Stripe secret key and price configuration."
  return "Stripe Checkout could not be started."
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

function formatMembershipLevel(level: string) {
  return level
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatInterval(interval: string) {
  return interval === "year" ? "Yearly" : "Monthly"
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
