import Link from "next/link"
import { Suspense } from "react"
import {
  BadgeCheck,
  CreditCard,
  Database,
  FileCheck2,
  GraduationCap,
  Shield,
  ShieldAlert,
  Sparkles,
  UserRound,
} from "lucide-react"
import { getCurrentSession } from "@/auth"
import { requestCredentialVerificationAction, saveProfileAction } from "@/app/account/actions"
import { AccountAppSettingsPanel, LocalTherapistDefaultsPanel } from "@/app/account/app-settings-panel"
import { AccountSettingsShell } from "@/app/account/account-settings-shell"
import { PreferenceSync } from "@/app/account/preference-sync"
import { SecurityPanel } from "@/app/account/security/security-panel"
import { SignOutButton } from "@/app/account/sign-out-button"
import { accountPageGroups, accountPageTabs, formatAccountDate, selectAccountTab } from "@/lib/account-page"
import { normalizeSessionRoleAssignments } from "@/lib/account-role-assignments"
import { getAccountSurfaceData } from "@/lib/account-surface-data"
import { getLegalDocumentByKey, legalDocumentAcceptanceId } from "@/lib/legal-documents"
import { US_MASSAGE_JURISDICTIONS } from "@/lib/license-verification"
import { FEATURE_KEYS } from "@/lib/membership"
import type { AccountRole, VerificationStatus } from "@/lib/domain-types"
import { cn } from "@/lib/utils"
import {
  SettingsActionLink,
  SettingsStatusTile,
  SettingsSurface,
  settingsInsetClassName,
  settingsSurfaceClassName,
} from "@/components/account/settings-surfaces"
import { MembershipPricingCards } from "@/components/membership/pricing-cards"
import { AppNotice, AppPageShell } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TabsContent } from "@/components/ui/tabs"

type AccountPageProps = {
  searchParams?: Promise<{
    billing?: string
    checkout?: string
    legal?: string
    portal?: string
    tab?: string
  }>
}

type AccountPageTab = {
  id: string
  label: string
  description: string
}

const typedAccountPageTabs = accountPageTabs as AccountPageTab[]

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = await searchParams
  const session = await getCurrentSession()
  const defaultTab = selectAccountTab(params?.tab, {
    billing: params?.billing,
    checkout: params?.checkout,
    legal: params?.legal,
    portal: params?.portal,
  })
  const showMobileIndexFirst = !params?.tab && !params?.billing && !params?.checkout && !params?.legal && !params?.portal

  if (!session?.user?.id) {
    return (
      <AccountShell>
        <AccountNotice billing={params?.billing} checkout={params?.checkout} legal={params?.legal} portal={params?.portal} />
        <AccountSettingsShell
          defaultValue={defaultTab}
          groups={accountPageGroups}
          itemStatuses={signedOutAccountItemStatuses}
          showMobileIndexFirst={showMobileIndexFirst}
          user={{
            name: "Guest",
            email: "Local settings available",
            image: null,
          }}
        >
          <TabsContent value="overview" className="flex flex-col gap-5">
            <TabPanelIntro tabId="overview" />
            <SignedOutAccountPrompt title="Sign in to sync your account" />
          </TabsContent>

          <TabsContent value="profile" className="flex flex-col gap-5">
            <TabPanelIntro tabId="profile" />
            <SignedOutAccountPrompt title="Sign in to manage profile defaults" />
          </TabsContent>

          <TabsContent value="security" className="flex flex-col gap-5">
            <TabPanelIntro tabId="security" />
            <SignedOutAccountPrompt title="Sign in to manage security" />
          </TabsContent>

          <TabsContent value="credentials" className="flex flex-col gap-5">
            <TabPanelIntro tabId="credentials" />
            <SignedOutAccountPrompt title="Sign in to verify credentials" />
          </TabsContent>

          <TabsContent value="app-settings" className="flex flex-col gap-5">
            <TabPanelIntro tabId="app-settings" />
            <AccountAppSettingsPanel />
          </TabsContent>

          <TabsContent value="therapist-defaults" className="flex flex-col gap-5">
            <TabPanelIntro tabId="therapist-defaults" />
            <LocalTherapistDefaultsPanel />
          </TabsContent>

          <TabsContent value="sync" className="flex flex-col gap-5">
            <TabPanelIntro tabId="sync" />
            <SignedOutAccountPrompt title="Sign in to sync account data" />
          </TabsContent>

          <TabsContent value="membership" className="flex flex-col gap-5">
            <TabPanelIntro tabId="membership" />
            <SignedOutAccountPrompt
              title="Sign in to manage membership and billing"
              description="Pricing can be viewed publicly, but checkout, subscription status, and billing portal access require an account."
              secondaryHref="/pricing"
              secondaryLabel="View pricing"
            />
          </TabsContent>

          <TabsContent value="tools" className="flex flex-col gap-5">
            <TabPanelIntro tabId="tools" />
            <SignedOutAccountPrompt title="Sign in to use account tools" />
          </TabsContent>
        </AccountSettingsShell>
      </AccountShell>
    )
  }

  const roleRows = normalizeSessionRoleAssignments(session.user as AccountSessionUser) as Array<{ role: AccountRole; status: VerificationStatus }>
  const roleLabels = roleRows.map((roleRow) => roleRow.role).sort()
  const canManageAnatomy = Boolean(session.user.capabilities?.canManageAnatomyContent)
  const canUseChimerCustomColors = Boolean(session.user.capabilities?.canUseChimerCustomColors)
  const accountDisplayName = session.user.name || session.user.email || "MassageLab account"
  const roleSummary = roleLabels.length > 0 ? roleLabels.map(formatRole).join(", ") : "User"
  const accountItemStatuses = {
    overview: "Summary",
    profile: "Defaults",
    security: session.user.twoFactorEnabled ? "2FA enabled" : "2FA available",
    credentials: roleSummary,
    sync: "Local-first",
    accessibility: "Coming later",
    notifications: "Coming later",
    "app-settings": "Theme and layout",
    "therapist-defaults": "Local defaults",
    "practice-profile": "Coming later",
    people: "Coming later",
    "calendar-availability": "Open calendar",
    tools: canManageAnatomy ? "Anatomy browser" : "Feedback",
    membership: canUseChimerCustomColors ? "Paid features active" : "Billing",
    "orders-invoices": "Coming later",
  }
  const accountSummaryLinks = [
    {
      id: "security",
      label: "Security",
      value: session.user.twoFactorEnabled ? "2FA enabled" : "2FA available",
    },
    {
      id: "membership",
      label: "Membership",
      value: canUseChimerCustomColors ? "Custom colors unlocked" : "Review plans",
    },
    {
      id: "credentials",
      label: "Roles",
      value: roleSummary,
    },
    {
      id: "sync",
      label: "Data",
      value: "Local-first only",
    },
  ]

  return (
    <AccountShell>
      <AccountNotice
        billing={params?.billing}
        checkout={params?.checkout}
        legal={params?.legal}
        portal={params?.portal}
      />

      <AccountSettingsShell
        defaultValue={defaultTab}
        groups={accountPageGroups}
        itemStatuses={accountItemStatuses}
        showMobileIndexFirst={showMobileIndexFirst}
        summaryLinks={accountSummaryLinks}
        user={{
          name: accountDisplayName,
          email: session.user.email ?? "Signed in",
          image: session.user.image,
        }}
      >
        <Suspense fallback={<AccountTabLoading tabId={defaultTab} />}>
          <ActiveAccountTab tabId={defaultTab} userId={session.user.id} sessionUser={session.user as AccountSessionUser} />
        </Suspense>
      </AccountSettingsShell>
    </AccountShell>
  )
}

type AccountSessionUser = {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  role: AccountRole
  roles?: AccountRole[]
  roleAssignments?: Array<{ role: AccountRole; status: VerificationStatus }>
  capabilities?: {
    canManageAnatomyContent?: boolean
    canUseChimerCustomColors?: boolean
  }
  twoFactorEnabled?: boolean
}

function AccountTabLoading({ tabId }: { tabId: string }) {
  return (
    <TabsContent value={tabId} className="space-y-5">
      <TabPanelIntro tabId={tabId} />
      <SettingsSurface title="Loading account section" description="Preparing this account section.">
        <div className="h-2" />
      </SettingsSurface>
    </TabsContent>
  )
}

async function ActiveAccountTab({
  tabId,
  userId,
  sessionUser,
}: {
  tabId: string
  userId: string
  sessionUser: AccountSessionUser
}) {
  if (tabId === "profile") {
    return <ProfileTab userId={userId} sessionUser={sessionUser} />
  }

  if (tabId === "security") {
    return <SecurityTab userId={userId} sessionUser={sessionUser} />
  }

  if (tabId === "credentials") {
    return <CredentialsTab userId={userId} sessionUser={sessionUser} />
  }

  if (tabId === "app-settings") {
    return (
      <TabsContent value="app-settings" className="flex flex-col gap-5">
        <TabPanelIntro tabId="app-settings" />
        <AccountAppSettingsPanel />
      </TabsContent>
    )
  }

  if (tabId === "therapist-defaults") {
    return (
      <TabsContent value="therapist-defaults" className="flex flex-col gap-5">
        <TabPanelIntro tabId="therapist-defaults" />
        <LocalTherapistDefaultsPanel />
      </TabsContent>
    )
  }

  if (tabId === "sync") {
    return <SyncTab userId={userId} sessionUser={sessionUser} />
  }

  if (tabId === "membership") {
    return <MembershipTab userId={userId} sessionUser={sessionUser} />
  }

  if (tabId === "tools") {
    return <ToolsTab sessionUser={sessionUser} />
  }

  return <OverviewTab userId={userId} sessionUser={sessionUser} />
}

async function OverviewTab({ userId, sessionUser }: { userId: string; sessionUser: AccountSessionUser }) {
  const data = await getAccountSurfaceData("overview", userId, sessionUser)

  return (
    <TabsContent value="overview" className="space-y-5">
      <TabPanelIntro tabId="overview" />

      <Card id="account-summary" className={settingsSurfaceClassName}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-brand-orange" aria-hidden="true" />
            Account summary
          </CardTitle>
          <CardDescription>Current account status across learning, templates, security, and feature access.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <StatusTile label="Progress items" value={String(data.counts.progressCount)} />
            <StatusTile label="Achievements" value={String(data.counts.achievementCount)} />
            <StatusTile label="Templates" value={String(data.counts.templateCount)} />
            <StatusTile label="Security" value={sessionUser.twoFactorEnabled ? "2FA enabled" : "2FA available"} />
            <StatusTile label="Clinical sync" value="Local-first only" />
            <StatusTile label="Chimer colors" value={data.canUseChimerCustomColors ? "Unlocked" : "Free defaults"} />
          </div>
        </CardContent>
      </Card>

      <Card id="quick-actions" className={settingsSurfaceClassName}>
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>Shortcuts to the account areas that usually need attention first.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <AccountActionLink
            href="/account?tab=security"
            icon={<Shield className="h-4 w-4" aria-hidden="true" />}
            title="Review security"
            description={sessionUser.twoFactorEnabled ? "2FA is enabled. Review sign-in methods or backup codes." : "Add 2FA and confirm sign-in methods."}
          />
          <AccountActionLink
            href="/account?tab=membership"
            icon={<CreditCard className="h-4 w-4" aria-hidden="true" />}
            title="Manage membership and billing"
            description="Review pricing options, subscription status, and billing portal access."
          />
          <AccountActionLink
            href="/account?tab=sync"
            icon={<FileCheck2 className="h-4 w-4" aria-hidden="true" />}
            title="Sync preferences"
            description="Save safe local settings to your account while clinical data stays local-first."
          />
          <AccountActionLink
            href="/account?tab=credentials"
            icon={<BadgeCheck className="h-4 w-4" aria-hidden="true" />}
            title="Verify credentials"
            description="Submit license or student enrollment details for role access."
          />
          <AccountActionLink
            href="/onboarding"
            icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
            title="Tune your starting path"
            description="Update the role and tool priorities MassageLab uses to shape account shortcuts."
          />
          {sessionUser.capabilities?.canManageAnatomyContent ? (
            <AccountActionLink
              href="/admin/anatomy"
              icon={<Database className="h-4 w-4" aria-hidden="true" />}
              title="Open anatomy browser"
              description="Search and inspect the protected anatomy foundation database."
            />
          ) : null}
          <div className={cn(settingsInsetClassName, "p-4")}>
            <p className="text-sm font-medium">Session</p>
            <p className="mt-1 text-sm text-muted-foreground">End this browser session and return to the public home page.</p>
            <div className="mt-4">
              <SignOutButton />
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  )
}

async function SecurityTab({ userId, sessionUser }: { userId: string; sessionUser: AccountSessionUser }) {
  const data = await getAccountSurfaceData("security", userId, sessionUser)

  return (
    <TabsContent value="security" className="space-y-5">
      <TabPanelIntro tabId="security" />
      <div id="security-settings">
        <SecurityPanel
          twoFactorEnabled={Boolean(sessionUser.twoFactorEnabled)}
          hasPasswordCredential={data.hasPasswordCredential}
          googleLinked={data.googleLinked}
        />
      </div>
    </TabsContent>
  )
}

async function ProfileTab({ userId, sessionUser }: { userId: string; sessionUser: AccountSessionUser }) {
  const data = await getAccountSurfaceData("profile", userId, sessionUser)
  const profile = data.profile

  return (
    <TabsContent value="profile" className="space-y-5">
      <TabPanelIntro tabId="profile" />
      <Card id="profile-defaults" className={settingsSurfaceClassName}>
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
            <Button type="submit">
              Save profile
            </Button>
          </form>
        </CardContent>
      </Card>
    </TabsContent>
  )
}

async function CredentialsTab({ userId, sessionUser }: { userId: string; sessionUser: AccountSessionUser }) {
  const data = await getAccountSurfaceData("credentials", userId, sessionUser)
  const roleRows = data.roleAssignments
  const credentialVerifications = data.credentialVerifications
  const therapistAgreement = getLegalDocumentByKey("therapist-agreement")
  const therapistAgreementId = legalDocumentAcceptanceId(therapistAgreement)

  return (
    <TabsContent value="credentials" className="space-y-5">
      <TabPanelIntro tabId="credentials" />
      <Card id="role-verification" className={settingsSurfaceClassName}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-brand-orange" aria-hidden="true" />
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
                    <div key={verification.id} className={cn(settingsInsetClassName, "p-3")}>
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

          <form action={requestCredentialVerificationAction} className="grid gap-4 border-t border-border/80 pt-5 md:grid-cols-2">
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
                <GraduationCap className="h-4 w-4 text-brand-orange" aria-hidden="true" />
                Student first day of class
              </Label>
              <Input id="student_start_date" name="student_start_date" type="date" />
            </div>
            <p className="text-xs text-muted-foreground md:col-span-2">
              Ohio massage license requests run an automatic eLicense check. Other jurisdictions and student enrollment remain pending for review.
            </p>
            <input type="hidden" name="acceptedLegalDocuments" value={therapistAgreementId} />
            <label className="flex gap-3 rounded-md border border-border/80 bg-background/70 p-3 text-sm text-muted-foreground md:col-span-2">
              <input type="checkbox" name="therapistAgreementAccepted" value="true" className="mt-1" required />
              <span>
                I agree to the{" "}
                <Link href={therapistAgreement.route} className="text-brand-orange underline-offset-4 hover:underline">
                  {therapistAgreement.label}
                </Link>{" "}
                before requesting professional or practice access.
              </span>
            </label>
            <div className="md:col-span-2">
              <Button type="submit" variant="outline">
                Request verification
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </TabsContent>
  )
}

async function MembershipTab({ userId, sessionUser }: { userId: string; sessionUser: AccountSessionUser }) {
  const data = await getAccountSurfaceData("membership", userId, sessionUser)
  const membershipSummary = data.membershipSummary
  const canUseChimerCustomColors = membershipSummary.entitlements.features.includes(FEATURE_KEYS.chimerCustomColors)
  const canOpenBillingPortal = Boolean(membershipSummary.stripeCustomer && membershipSummary.subscriptions.length > 0)

  return (
    <TabsContent value="membership" className="space-y-5">
      <TabPanelIntro tabId="membership" />
      <Card id="membership" className={settingsSurfaceClassName}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-brand-orange" aria-hidden="true" />
            Membership
          </CardTitle>
          <CardDescription>
            Free access remains available by default. Paid memberships currently unlock Chimer custom colors and membership status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <StatusTile label="Current level" value={formatMembershipLevel(membershipSummary.entitlements.level)} />
            <StatusTile label="Billing profile" value={membershipSummary.stripeCustomer ? "Connected" : "Not started"} />
            <StatusTile label="Custom colors" value={canUseChimerCustomColors ? "Available" : "Membership required"} />
          </div>

          <div className="rounded-md border border-primary/50 bg-primary/10 p-3 shadow-sm shadow-primary/10">
            <p className="text-sm text-muted-foreground">
              Basic Chimer remains free. Paid memberships unlock saved custom display and background colors. Yearly billing is highlighted when Stripe pricing shows an annual savings.
            </p>
          </div>
        </CardContent>
      </Card>

      <div id="membership-pricing">
        <MembershipPricingCards
          catalog={data.pricingCatalog}
          activeMembershipLevel={membershipSummary.entitlements.paidLevel}
          mode="checkout"
        />
      </div>

      <Card id="subscription-status" className={settingsSurfaceClassName}>
        <CardHeader>
          <CardTitle>Subscription status</CardTitle>
          <CardDescription>Membership status, recent subscriptions, and billing management.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {membershipSummary.subscriptions.length > 0 ? (
            <div className="space-y-2">
              {membershipSummary.subscriptions.slice(0, 3).map((subscription) => (
                <div key={subscription.id} className={cn(settingsInsetClassName, "p-3 text-sm")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{formatMembershipLevel(subscription.membershipLevel)}</span>
                    <span className="rounded-sm border border-brand-orange/40 px-2 py-1 text-xs text-brand-orange">
                      {subscription.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {subscription.currentPeriodEnd ? `Renews through ${formatAccountDate(subscription.currentPeriodEnd)}` : "Current period unavailable"}
                    {subscription.couponId ? ` · Coupon ${subscription.couponId}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <div id="billing-portal" className="flex flex-col gap-3">
            {canOpenBillingPortal ? (
              <form action="/api/billing/portal" method="post">
                <Button type="submit" variant="outline">
                  Manage subscription
                </Button>
              </form>
            ) : null}
            {!canOpenBillingPortal && membershipSummary.subscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You do not have a paid subscription yet.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  )
}

async function SyncTab({ userId, sessionUser }: { userId: string; sessionUser: AccountSessionUser }) {
  const data = await getAccountSurfaceData("sync", userId, sessionUser)

  return (
    <TabsContent value="sync" className="space-y-5">
      <TabPanelIntro tabId="sync" />
      <div id="preference-sync">
        <PreferenceSync hasCloudPreferences={Boolean(data.preferences)} />
      </div>

      <Card id="clinical-sync" className={cn(settingsSurfaceClassName, "border-primary/50 bg-primary/10")}>
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <ShieldAlert className="mt-1 h-5 w-5 text-brand-orange" aria-hidden="true" />
          <div>
            <CardTitle>{data.clinicalSyncReadiness.enabled ? "Clinical sync is gated" : "Clinical sync is not hosted yet"}</CardTitle>
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
    </TabsContent>
  )
}

function ToolsTab({ sessionUser }: { sessionUser: AccountSessionUser }) {
  const canManageAnatomy = Boolean(sessionUser.capabilities?.canManageAnatomyContent)

  return (
    <TabsContent value="tools" className="space-y-5">
      <TabPanelIntro tabId="tools" />
      <Card id="anatomy-feedback" className={settingsSurfaceClassName}>
        <CardHeader>
          <CardTitle>Content feedback</CardTitle>
          <CardDescription>Flag anatomy content that needs correction or review.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/anatomy/corrections">Flag anatomy content</Link>
          </Button>
        </CardContent>
      </Card>

      {canManageAnatomy ? (
        <Card id="anatomy-browser-access" className={settingsSurfaceClassName}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-brand-orange" aria-hidden="true" />
              Anatomy browser
            </CardTitle>
            <CardDescription>
              Access is limited to full admins and users with the dedicated anatomy admin role.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/admin/anatomy">Open anatomy browser</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/anatomy?quick=scapula-attachments">Scapula attachments</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card id="account-session" className={settingsSurfaceClassName}>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Sign out of this browser session.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>
    </TabsContent>
  )
}

const signedOutAccountItemStatuses = {
  overview: "Sign in",
  profile: "Sign in",
  security: "Sign in",
  credentials: "Sign in",
  "app-settings": "Available",
  "therapist-defaults": "Local only",
  sync: "Sign in",
  accessibility: "Coming later",
  notifications: "Coming later",
  membership: "Sign in",
  "orders-invoices": "Coming later",
  "practice-profile": "Coming later",
  people: "Coming later",
  "calendar-availability": "Open calendar",
  tools: "Sign in",
}

function AccountShell({ children }: { children: React.ReactNode }) {
  return (
    <AppPageShell title="Account">
        {children}
    </AppPageShell>
  )
}

function SignedOutAccountPrompt({
  title,
  description = "Accounts sync preferences, progress, templates, profile defaults, security controls, and billing access. Local-only app settings remain available without signing in.",
  secondaryHref,
  secondaryLabel,
}: {
  title: string
  description?: string
  secondaryHref?: string
  secondaryLabel?: string
}) {
  return (
    <SettingsSurface title={title} description={description}>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/register">Create account</Link>
        </Button>
        {secondaryHref && secondaryLabel ? (
          <Button asChild variant="ghost">
            <Link href={secondaryHref}>{secondaryLabel}</Link>
          </Button>
        ) : null}
      </div>
    </SettingsSurface>
  )
}

function TabPanelIntro({ tabId }: { tabId: string }) {
  const tab = typedAccountPageTabs.find((candidate) => candidate.id === tabId)

  if (!tab) {
    return null
  }

  return (
    <div className={cn(settingsInsetClassName, "p-4")}>
      <h2 className="text-base font-semibold">{tab.label}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{tab.description}</p>
    </div>
  )
}

function AccountActionLink({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <SettingsActionLink href={href} icon={icon} title={title} description={description} />
  )
}

function AccountNotice({
  billing,
  checkout,
  legal,
  portal,
}: {
  billing?: string
  checkout?: string
  legal?: string
  portal?: string
}) {
  const notice = accountNotice({ billing, checkout, legal, portal })

  if (!notice) {
    return null
  }

  return (
    <AppNotice title={notice.title} description={notice.description} tone={notice.tone} />
  )
}

function accountNotice({
  billing,
  checkout,
  legal,
  portal,
}: {
  billing?: string
  checkout?: string
  legal?: string
  portal?: string
}) {
  if (checkout === "success") {
    return {
      title: "Checkout complete",
      description: "Your membership is being updated. If it does not appear right away, refresh this page in a minute.",
      tone: "accent" as const,
    }
  }

  if (checkout === "cancelled") {
    return {
      title: "Checkout cancelled",
      description: "No membership changes were made. Free access remains available.",
      tone: "default" as const,
    }
  }

  if (portal === "returned") {
    return {
      title: "Billing portal closed",
      description: "Any subscription changes you made may take a moment to appear here. Refresh this page if they do not show right away.",
      tone: "accent" as const,
    }
  }

  if (portal === "customer-not-found") {
    return {
      title: "Billing portal unavailable",
      description: "This account does not have a paid subscription to manage yet.",
      tone: "default" as const,
    }
  }

  if (portal === "error") {
    return {
      title: "Billing portal unavailable",
      description: "We could not open billing management right now. Please try again or contact support if this continues.",
      tone: "destructive" as const,
    }
  }

  if (legal === "therapist-agreement-required") {
    return {
      title: "Therapist Agreement required",
      description: "Accept the Therapist Agreement before requesting professional or practice access.",
      tone: "destructive" as const,
    }
  }

  if (billing) {
    return {
      title: "Checkout unavailable",
      description: billingMessage(billing),
      tone: "destructive" as const,
    }
  }

  return null
}

function billingMessage(code: string) {
  if (code === "unsupported-plan") return "That membership option is not available yet."
  if (code === "price-not-configured") return "That membership option is not available yet."
  if (code === "billing-terms-required") return "Accept the membership billing and refund terms before starting checkout."
  if (code === "account-not-found") return "The signed-in account could not be found."
  if (code === "checkout-error") return "We could not open checkout right now. Please try again or contact support if this continues."
  return "We could not open checkout right now."
}

function StatusTile({ label, value, href }: { label: string; value: string; href?: string }) {
  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          settingsInsetClassName,
          "block p-3 transition hover:border-primary/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <p className="text-xs uppercase tracking-normal text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-sm font-medium">{value}</p>
      </Link>
    )
  }

  return <SettingsStatusTile label={label} value={value} />
}

function formatRole(role: AccountRole) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatMembershipLevel(level: string) {
  if (level === "PRACTICE") {
    return "Team/Practice"
  }

  return level
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
