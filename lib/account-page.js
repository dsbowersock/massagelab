export const accountPageGroups = [
  {
    id: "personal",
    label: "Personal account",
    description: "Profile, access, credentials, and data preferences.",
    items: [
      {
        id: "overview",
        label: "Overview",
        description: "Account health, role summary, and high-priority actions.",
        icon: "UserRound",
        status: "current",
        statusLabel: "Summary",
        sections: ["account-summary", "quick-actions"],
      },
      {
        id: "profile",
        label: "Profile",
        description: "Personal and professional defaults used by account-backed workflows.",
        icon: "UserRound",
        status: "current",
        statusLabel: "Defaults",
        sections: ["profile-defaults"],
      },
      {
        id: "security",
        label: "Security",
        description: "Sign-in methods, password access, authenticator 2FA, and backup codes.",
        icon: "KeyRound",
        status: "current",
        statusLabel: "Priority",
        sections: ["security-settings"],
      },
      {
        id: "credentials",
        label: "Credentials",
        description: "Roles, licenses, student verification, and review history.",
        icon: "BadgeCheck",
        status: "current",
        statusLabel: "Verification",
        sections: ["role-verification"],
      },
      {
        id: "app-settings",
        label: "App settings",
        description: "Theme, sidebar position, and account-level app layout preferences.",
        icon: "Settings2",
        status: "current",
        statusLabel: "Theme and sidebar",
        sections: ["app-layout-settings", "app-theme-settings"],
      },
      {
        id: "therapist-defaults",
        label: "Therapist defaults",
        description: "Local therapist defaults used to pre-fill documentation on this device.",
        icon: "UserRound",
        status: "current",
        statusLabel: "Local defaults",
        sections: ["local-therapist-defaults"],
      },
      {
        id: "sync",
        label: "Data & sync",
        description: "Preference sync controls and the clinical sync boundary.",
        icon: "FileCheck2",
        status: "current",
        statusLabel: "Local-first",
        sections: ["preference-sync", "clinical-sync"],
      },
      {
        id: "accessibility",
        label: "Accessibility",
        description: "Future account-level display, motion, and accessibility preferences.",
        icon: "Accessibility",
        status: "planned",
        statusLabel: "Planned",
        sections: [],
      },
      {
        id: "notifications",
        label: "Notifications",
        description: "Future reminders, email preferences, and notification controls.",
        icon: "Bell",
        status: "planned",
        statusLabel: "Planned",
        sections: [],
      },
    ],
  },
  {
    id: "payments",
    label: "Payments & plans",
    description: "Membership, billing, subscription status, and invoices.",
    items: [
      {
        id: "membership",
        label: "Membership & billing",
        description: "Pricing cards, subscription status, billing portal access, and paid feature eligibility.",
        icon: "CreditCard",
        status: "current",
        statusLabel: "Billing",
        sections: ["membership", "membership-pricing", "subscription-status", "billing-portal"],
      },
      {
        id: "orders-invoices",
        label: "Orders & invoices",
        description: "Future Stripe invoices, receipts, and purchase history.",
        icon: "ReceiptText",
        status: "planned",
        statusLabel: "Planned",
        sections: [],
      },
    ],
  },
  {
    id: "practice",
    label: "Practice management",
    description: "Practice identity, people, calendar, and content tools.",
    items: [
      {
        id: "practice-profile",
        label: "Practice profile",
        description: "Future practice identity, contact details, and public booking context.",
        icon: "Building2",
        status: "planned",
        statusLabel: "Planned",
        sections: [],
      },
      {
        id: "people",
        label: "People",
        description: "Future team, practitioner, and invitation management.",
        icon: "UsersRound",
        status: "planned",
        statusLabel: "Planned",
        sections: [],
      },
      {
        id: "calendar-availability",
        label: "Calendar availability",
        description: "Manage availability on the calendar when practice scheduling is enabled.",
        icon: "CalendarDays",
        status: "link",
        statusLabel: "Open page",
        href: "/calendar/availability",
        sections: [],
      },
      {
        id: "tools",
        label: "Tools",
        description: "Feedback, sign out, and role-gated content tools.",
        icon: "Settings2",
        status: "current",
        statusLabel: "Utilities",
        sections: ["anatomy-feedback", "content-tools"],
      },
    ],
  },
]

export const accountPageNavigationItems = accountPageGroups.flatMap((group) => (
  group.items.map((item) => ({
    ...item,
    groupId: group.id,
    groupLabel: group.label,
  }))
))

export const accountPageTabs = accountPageNavigationItems.filter((item) => (
  item.status === "current" && item.sections.length > 0
))

export const accountPageSectionIds = accountPageTabs.flatMap((tab) => tab.sections)

const accountPageTabIds = new Set(accountPageTabs.map((tab) => tab.id))

export function selectAccountTab(requestedTab, returnState = {}) {
  if (accountPageTabIds.has(requestedTab)) {
    return requestedTab
  }

  if (returnState.checkout || returnState.portal || returnState.billing) {
    return "membership"
  }

  return "overview"
}

export function getAccountTabHref(tabId) {
  return `/account?tab=${encodeURIComponent(String(tabId ?? "overview"))}`
}

export function filterAccountPageGroups(query = "", groups = accountPageGroups) {
  const normalizedQuery = normalizeSearchText(query)

  if (!normalizedQuery) {
    return groups
  }

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const haystack = normalizeSearchText([
          group.label,
          group.description,
          item.label,
          item.description,
          item.statusLabel,
        ].join(" "))

        return haystack.includes(normalizedQuery)
      }),
    }))
    .filter((group) => group.items.length > 0)
}

function normalizeSearchText(value) {
  return String(value ?? "").trim().toLowerCase()
}
