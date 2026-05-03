import Link from "next/link"
import { Shield, UserRound } from "lucide-react"
import { getCurrentSession } from "@/auth"
import { saveProfileAction } from "@/app/account/actions"
import { PreferenceSync } from "@/app/account/preference-sync"
import { SignOutButton } from "@/app/account/sign-out-button"
import { canManageAnatomyContent } from "@/lib/account-permissions"
import type { AccountRole } from "@/lib/domain-types"
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
            <Button asChild className="bg-[#ff7043] hover:bg-[#f4511e]">
              <Link href="/login">Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      </AccountShell>
    )
  }

  const [profile, roles, preferences, progressCount, achievementCount, templateCount] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: session.user.id } }),
    prisma.userRole.findMany({ where: { userId: session.user.id }, select: { role: true } }),
    prisma.userPreference.findUnique({ where: { userId: session.user.id }, select: { updatedAt: true } }),
    prisma.learningProgress.count({ where: { userId: session.user.id } }),
    prisma.achievement.count({ where: { userId: session.user.id } }),
    prisma.noteTemplate.count({ where: { userId: session.user.id } }),
  ])

  const roleRows = roles as Array<{ role: AccountRole }>
  const roleLabels: AccountRole[] =
    roleRows.length > 0 ? roleRows.map((roleRow) => roleRow.role).sort() : [session.user.role as AccountRole]
  const canManageAnatomy = canManageAnatomyContent(roleLabels)

  return (
    <AccountShell>
      <Card className="border-neutral-800 bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-[#ff7043]" />
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
            <Button type="submit" className="bg-[#ff7043] hover:bg-[#f4511e]">
              Save profile
            </Button>
          </form>
        </CardContent>
      </Card>

      {canManageAnatomy ? (
        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#ff7043]" />
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
