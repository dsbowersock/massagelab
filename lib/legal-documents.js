// @ts-check

/**
 * @typedef {"terms" | "privacy" | "membership-billing-refunds" | "therapist-agreement" | "cookies" | "local-first-health-wellness-data"} LegalDocumentKey
 * @typedef {"registration" | "checkout" | "professional-activation"} LegalAcceptanceEvent
 * @typedef {{ title: string, body: readonly string[] }} LegalDocumentSection
 * @typedef {{
 *   key: LegalDocumentKey,
 *   slug: string,
 *   label: string,
 *   shortLabel: string,
 *   route: string,
 *   version: string,
 *   effectiveDate: string,
 *   summary: string,
 *   sections: readonly LegalDocumentSection[],
 * }} LegalDocument
 */

export const LEGAL_DOCUMENT_VERSION = "2026-06-legal-v1"
export const LEGAL_EFFECTIVE_DATE = "June 17, 2026"
export const LEGAL_BUSINESS_IDENTITY = "Massage Lab, operated by Derrick Bowersock"

/** @type {readonly LegalDocumentKey[]} */
export const LEGAL_DOCUMENT_KEYS = Object.freeze([
  "terms",
  "privacy",
  "membership-billing-refunds",
  "therapist-agreement",
  "cookies",
  "local-first-health-wellness-data",
])

const sharedNotices = Object.freeze([
  "MassageLab is in private alpha. These documents describe the current product posture and should be reviewed by a licensed attorney before broader public reliance.",
  "MassageLab is not an emergency service, medical provider, insurer, legal advisor, tax advisor, or compliance advisor.",
])

/** @type {LegalDocument[]} */
const legalDocuments = [
  {
    key: "terms",
    slug: "terms",
    label: "Terms of Service",
    shortLabel: "Terms",
    route: "/legal/terms",
    version: LEGAL_DOCUMENT_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    summary: "Rules for adult account use, acceptable use, professional responsibility, and MassageLab's current service boundaries.",
    sections: [
      {
        title: "Who operates MassageLab",
        body: [
          `${LEGAL_BUSINESS_IDENTITY}, provides MassageLab as a private-alpha software platform for education, timing, scheduling, memberships, wellness self-tracking, and local-first professional documentation tools.`,
          ...sharedNotices,
        ],
      },
      {
        title: "Adult accounts only",
        body: [
          "MassageLab accounts are intended for adults who are at least 18 years old.",
          "Therapists and practices are responsible for any consent, guardian involvement, and documentation rules that apply when they work with minor clients outside the MassageLab account system.",
        ],
      },
      {
        title: "Professional responsibility",
        body: [
          "Massage therapists, practice owners, and practice staff remain responsible for licensure, scope of practice, client consent, documentation, privacy obligations, recordkeeping, fees, cancellation rules, and professional judgment.",
          "MassageLab may provide forms, templates, scheduling tools, education tools, and local-first documentation surfaces, but MassageLab does not guarantee that any workflow satisfies a legal, licensing, insurance, tax, employment, or professional-board requirement.",
        ],
      },
      {
        title: "Acceptable use",
        body: [
          "Users must not use MassageLab unlawfully, misrepresent credentials, access information they are not authorized to access, disrupt security controls, submit harmful or misleading content, or use the service for emergency needs.",
          "MassageLab may suspend or restrict access when necessary to protect the service, users, privacy, billing integrity, or legal obligations.",
        ],
      },
      {
        title: "Current dispute posture",
        body: [
          "These terms are written for Ohio as the current governing-law context. Detailed dispute, venue, arbitration, or class-action language should be finalized by a licensed attorney before broader public reliance.",
        ],
      },
    ],
  },
  {
    key: "privacy",
    slug: "privacy",
    label: "Privacy Policy",
    shortLabel: "Privacy",
    route: "/legal/privacy",
    version: LEGAL_DOCUMENT_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    summary: "How MassageLab handles account, membership, booking, wellness, support, diagnostics, and local-first professional-record boundaries.",
    sections: [
      {
        title: "Information MassageLab handles",
        body: [
          "MassageLab may handle account, authentication, role, profile, membership, billing metadata, calendar, booking, support, diagnostics, app preference, education progress, and client-owned wellness self-tracking information.",
          "Stripe handles payment processing. MassageLab does not intentionally store full payment card numbers.",
        ],
      },
      {
        title: "Local-first professional records",
        body: [
          "SOAP notes, intake forms, journals, therapist ROM sessions, body maps, and related therapist professional-record content stay in the user's encrypted browser vault during this alpha unless future hosted clinical storage passes documented compliance gates.",
          "The local vault passphrase is not sent to MassageLab. Encrypted local storage and exports do not replace device security, backups, staff policies, or professional recordkeeping obligations.",
        ],
      },
      {
        title: "Client-owned wellness self-tracking",
        body: [
          "Signed-in wellness entries are client-owned self-tracking records. They are separate from therapist professional records and are not diagnosis, emergency monitoring, medical advice, or automatic therapist-facing data.",
          "Anonymous wellness practice flows run in browser memory only unless the user signs in and saves entries.",
        ],
      },
      {
        title: "Diagnostics and support",
        body: [
          "MassageLab uses privacy-scrubbed diagnostics to improve reliability. Diagnostic and support paths should not include client PHI, clinical notes, or sensitive professional-record content.",
          "Support requests should avoid client-identifying health information or sensitive clinical details.",
        ],
      },
      {
        title: "User choices",
        body: [
          "Users may use direct export tools where available, such as wellness exports and local vault exports. Broader account export and account deletion request workflows are planned separately.",
          "Some records may need to be retained when legally, professionally, operationally, security, payment, dispute, or audit needs require it.",
        ],
      },
    ],
  },
  {
    key: "membership-billing-refunds",
    slug: "membership-billing-refunds",
    label: "Membership, Billing, and Refund Terms",
    shortLabel: "Billing Terms",
    route: "/legal/membership-billing-refunds",
    version: LEGAL_DOCUMENT_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    summary: "Stripe-backed membership billing, cancellation, and the 31-calendar-day renewal refund rule.",
    sections: [
      {
        title: "Memberships",
        body: [
          "MassageLab currently uses Free, Student, Supporter, Therapist, and Practice membership language. Supporter, Therapist, and Practice are Stripe-backed paid memberships.",
          "Memberships fund current paid features and future careful work, but they do not currently unlock hosted transcription, cloud SOAP drafting, HIPAA-ready sync, or server-side PHI storage.",
        ],
      },
      {
        title: "Billing",
        body: [
          "Paid memberships may be billed monthly or yearly through Stripe. There are no free trials in the current membership posture.",
          "Users manage active subscriptions, payment methods, invoices, and cancellation through Stripe-hosted billing flows where available.",
        ],
      },
      {
        title: "Refunds",
        body: [
          "A user may request a full refund if they cancel within 31 calendar days of any membership renewal payment.",
          "Refund requests should be sent to MassageLab support. Stripe processing, fraud, abuse, chargeback, or legal constraints may affect handling.",
        ],
      },
      {
        title: "Provider payments",
        body: [
          "Provider/client payment collection through MassageLab is future/planned. Separate payment terms will be needed before that feature is enabled.",
        ],
      },
    ],
  },
  {
    key: "therapist-agreement",
    slug: "therapist-agreement",
    label: "Therapist Agreement",
    shortLabel: "Therapist Agreement",
    route: "/legal/therapist-agreement",
    version: LEGAL_DOCUMENT_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    summary: "Professional/practice user responsibilities for licensure, scope, client consent, privacy, documentation, and practice access.",
    sections: [
      {
        title: "Who must accept this agreement",
        body: [
          "This agreement applies to users acting in a professional or practice capacity, including licensed therapists, practice owners, practice therapists, and practice staff.",
        ],
      },
      {
        title: "Professional responsibility",
        body: [
          "Professional users are responsible for licensure, certification, scope of practice, professional judgment, client consent, documentation accuracy, privacy obligations, staff access, fees, cancellations, and records they create or maintain.",
          "MassageLab does not verify professional competence and does not guarantee legal authority to practice.",
        ],
      },
      {
        title: "Documentation responsibility",
        body: [
          "MassageLab local-first documentation tools may help organize forms, SOAP notes, journals, ROM sessions, body maps, and related materials.",
          "Professional users remain responsible for reviewing, correcting, exporting, protecting, and retaining records as required by their own legal, professional, and practice obligations.",
        ],
      },
      {
        title: "Client consent and privacy",
        body: [
          "Professional users are responsible for obtaining appropriate client consent before collecting, storing, recording, transcribing, or using client information.",
          "Professional users must not put client PHI or sensitive clinical details into account preferences, support requests, diagnostics, calendar reminders, or other non-clinical app fields.",
        ],
      },
    ],
  },
  {
    key: "cookies",
    slug: "cookies",
    label: "Functional Cookie Notice",
    shortLabel: "Cookies",
    route: "/legal/cookies",
    version: LEGAL_DOCUMENT_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    summary: "MassageLab's functional-only cookie and similar browser storage posture.",
    sections: [
      {
        title: "Functional-only posture",
        body: [
          "MassageLab uses cookies or similar browser storage only where needed for login, session security, preferences, fraud or abuse prevention, and core app functionality.",
          "MassageLab does not use advertising cookies, ad targeting, marketing retargeting, or ad personalization.",
        ],
      },
      {
        title: "Similar browser storage",
        body: [
          "MassageLab may use browser storage for local-first vaults, app preferences, anonymous practice flows, and user-controlled local data that makes the app work.",
          "Clearing browser data may remove local-only data unless the user has exported or backed it up.",
        ],
      },
      {
        title: "Future analytics",
        body: [
          "If analytics are added later, they should be privacy-preserving and disclosed before use.",
        ],
      },
    ],
  },
  {
    key: "local-first-health-wellness-data",
    slug: "local-first-health-wellness-data",
    label: "Local-First Health and Wellness Data Notice",
    shortLabel: "Health Data Notice",
    route: "/legal/local-first-health-wellness-data",
    version: LEGAL_DOCUMENT_VERSION,
    effectiveDate: LEGAL_EFFECTIVE_DATE,
    summary: "Plain-language explanation of local-first professional records, client-owned wellness records, and future hosted clinical gates.",
    sections: [
      {
        title: "Three data zones",
        body: [
          "MassageLab separates ordinary account/contact/booking data, client-owned wellness self-tracking, and therapist professional records.",
          "These zones have different privacy expectations and should not be treated as one shared clinical record.",
        ],
      },
      {
        title: "Local-first professional records",
        body: [
          "Therapist-created professional records remain local-first and user-controlled in the encrypted browser vault during this alpha.",
          "Hosted clinical storage and automatic therapist viewing of client wellness data are not active.",
        ],
      },
      {
        title: "Wellness self-tracking",
        body: [
          "Client-owned wellness entries can help users notice patterns, but MassageLab does not diagnose, treat, monitor emergencies, make insurance decisions, or provide medical advice.",
        ],
      },
      {
        title: "Future hosted clinical storage",
        body: [
          "Future hosted clinical storage requires separate legal, security, BAA, audit, access-control, retention, incident-response, and operating-policy review before implementation.",
        ],
      },
    ],
  },
]

/** @type {readonly LegalDocument[]} */
export const LEGAL_DOCUMENTS = Object.freeze(legalDocuments.map((document) => Object.freeze({
  ...document,
  sections: Object.freeze(document.sections.map((section) => Object.freeze({
    ...section,
    body: Object.freeze(section.body),
  }))),
})))

/** @type {ReadonlyMap<string, LegalDocument>} */
const DOCUMENT_BY_KEY = new Map(LEGAL_DOCUMENTS.map((document) => [document.key, document]))
/** @type {ReadonlyMap<string, LegalDocument>} */
const DOCUMENT_BY_SLUG = new Map(LEGAL_DOCUMENTS.map((document) => [document.slug, document]))

const ACCEPTANCE_EVENTS = /** @type {Readonly<Record<LegalAcceptanceEvent, readonly LegalDocumentKey[]>>} */ (Object.freeze({
  registration: Object.freeze(["terms", "privacy"]),
  checkout: Object.freeze(["membership-billing-refunds"]),
  "professional-activation": Object.freeze(["therapist-agreement"]),
}))

/**
 * @param {string} key
 * @returns {LegalDocument}
 */
export function getLegalDocumentByKey(key) {
  const document = DOCUMENT_BY_KEY.get(String(key ?? ""))
  if (!document) throw new Error(`Unknown legal document key: ${key}`)
  return document
}

/**
 * @param {string} slug
 * @returns {LegalDocument | null}
 */
export function findLegalDocumentBySlug(slug) {
  return DOCUMENT_BY_SLUG.get(String(slug ?? "")) ?? null
}

/**
 * @param {string} slug
 * @returns {LegalDocument}
 */
export function getLegalDocumentBySlug(slug) {
  const document = findLegalDocumentBySlug(slug)
  if (!document) throw new Error(`Unknown legal document slug: ${slug}`)
  return document
}

/**
 * @param {{ key: string, version: string }} document
 * @returns {string}
 */
export function legalDocumentAcceptanceId(document) {
  return `${document.key}:${document.version}`
}

/**
 * @param {LegalAcceptanceEvent} event
 * @returns {LegalDocument[]}
 */
export function requiredLegalDocumentsForEvent(event) {
  const keys = ACCEPTANCE_EVENTS[event]
  if (!keys) throw new Error(`Unknown legal acceptance event: ${event}`)
  return keys.map((key) => getLegalDocumentByKey(key))
}
