import type { AccountRole, VerificationStatus } from "./domain-types"

export type AccountSurfaceSessionUser = {
  role?: AccountRole | string | null
  roles?: Array<AccountRole | string> | null
  roleAssignments?: Array<{ role: AccountRole | string; status: VerificationStatus | string }> | null
  capabilities?: { canUseChimerCustomColors?: boolean }
}

export type AccountRoleAssignment = {
  role: AccountRole
  status: VerificationStatus
}

export type AccountOverviewSurfaceData = {
  surface: "overview"
  counts: {
    progressCount: number
    achievementCount: number
    templateCount: number
  }
  roleLabels: string[]
  canManageAnatomy: boolean
  canUseChimerCustomColors: boolean
}

export type AccountProfileSurfaceData = {
  surface: "profile"
  profile: {
    displayName?: string | null
    therapistName?: string | null
    therapistLocation?: string | null
    licenseNumber?: string | null
    licenseOrganization?: string | null
    npiNumber?: string | null
  } | null
}

export type AccountSecuritySurfaceData = {
  surface: "security"
  hasPasswordCredential: boolean
  googleLinked: boolean
}

export type AccountCredentialsSurfaceData = {
  surface: "credentials"
  roleAssignments: AccountRoleAssignment[]
  credentialVerifications: Array<{
    id: string
    kind: string
    status: VerificationStatus | string
    jurisdictionCode: string | null
    issuingAuthority: string | null
    credentialNumber: string | null
    verificationPayload: unknown
  }>
}

export type MembershipPriceValue = {
  membershipLevel: string
  interval: "month" | "year"
  priceId: string | null
  unitAmount: number | null
  currency: string
  displayPrice: string
  displayInterval: string
  isConfigured: boolean
  isLookupAvailable: boolean
  yearlySavings: {
    amount: number
    currency: string
    displayAmount: string
    description: string
    percent: number
  } | null
}

export type MembershipPriceCatalog = {
  month: MembershipPriceValue
  year: MembershipPriceValue
}

export type MembershipPricingCatalog = {
  defaultInterval: string
  intervals: ReadonlyArray<{
    id: string
    label: string
    nudge: string
  }>
  plans: Array<{
    membershipLevel: string
    name: string
    eyebrow: string
    description: string
    currentFeatures: string[]
    roadmapNotes: string[]
    amountChoices: Array<{
      id: string
      month: number
      year: number
      prices: MembershipPriceCatalog
    }>
  }>
}

export type AccountMembershipSurfaceData = {
  surface: "membership"
  membershipSummary: {
    stripeCustomer: unknown
    subscriptions: Array<{
      id: string
      membershipLevel: string
      status: string
      currentPeriodEnd: Date | null
      couponId: string | null
    }>
    entitlements: {
      level: string
      paidLevel?: string | null
      features: string[]
    }
  }
  pricingCatalog: MembershipPricingCatalog
}

export type AccountSyncSurfaceData = {
  surface: "sync"
  preferences: { updatedAt: Date | null } | null
  clinicalSyncReadiness: { enabled: boolean }
}

export type AccountBackgroundCommerceSurfaceData = {
  surface: "orders-invoices"
  backgroundCommerce: {
    creditBalance: number
    ownedBackgroundIds: string[]
    ownerships: Array<{
      backgroundId: string
      source: "credit" | "purchase"
      status: string
      acquiredAt: string
    }>
    cart: {
      items: Array<{
        productType: string
        productKey: string
        displayName: string
        unitAmount: number
        currency: string
        availableForPurchase: boolean
      }>
      reservedOrder: { orderId: string; expiresAt: string } | null
      subtotalAmount: number
      currency: string
      notices: Array<{ code: string; productKey: string }>
    }
    recentOrders: Array<Record<string, unknown>>
    orders: Array<{
      reference: string
      status: string
      subtotalAmount: number
      taxAmount: number
      totalAmount: number
      currency: string
      createdAt: string
      items: Array<{
        backgroundId: string
        displayName: string
        unitAmount: number
        taxAmount: number
        totalAmount: number
        refundedAmount: number
        refundStatuses: string[]
      }>
    }>
  }
}

export type AccountLocalSurfaceData = {
  surface: string
  roleLabels: string[]
  canManageAnatomy: boolean
}

export type AccountSurfaceData =
  | AccountOverviewSurfaceData
  | AccountProfileSurfaceData
  | AccountSecuritySurfaceData
  | AccountCredentialsSurfaceData
  | AccountMembershipSurfaceData
  | AccountBackgroundCommerceSurfaceData
  | AccountSyncSurfaceData
  | AccountLocalSurfaceData

export type GetAccountSurfaceData = {
  (surface: "overview", userId: string, sessionUser?: AccountSurfaceSessionUser): Promise<AccountOverviewSurfaceData>
  (surface: "profile", userId: string, sessionUser?: AccountSurfaceSessionUser): Promise<AccountProfileSurfaceData>
  (surface: "security", userId: string, sessionUser?: AccountSurfaceSessionUser): Promise<AccountSecuritySurfaceData>
  (surface: "credentials", userId: string, sessionUser?: AccountSurfaceSessionUser): Promise<AccountCredentialsSurfaceData>
  (surface: "membership", userId: string, sessionUser?: AccountSurfaceSessionUser): Promise<AccountMembershipSurfaceData>
  (surface: "orders-invoices", userId: string, sessionUser?: AccountSurfaceSessionUser): Promise<AccountBackgroundCommerceSurfaceData>
  (surface: "sync", userId: string, sessionUser?: AccountSurfaceSessionUser): Promise<AccountSyncSurfaceData>
  (surface: string, userId: string, sessionUser?: AccountSurfaceSessionUser): Promise<AccountSurfaceData>
}

export type AccountSurfaceDataLoaderOptions = Record<string, unknown>

export type AccountSurfaceDataLoader = {
  getAccountSurfaceData: GetAccountSurfaceData
  clearAccountSurfaceDataCache(userId?: string, surface?: string): void
}

export declare function createAccountSurfaceDataLoader(options?: AccountSurfaceDataLoaderOptions): AccountSurfaceDataLoader
export declare const getAccountSurfaceData: GetAccountSurfaceData
export declare function clearAccountSurfaceDataCache(userId?: string, surface?: string): void
