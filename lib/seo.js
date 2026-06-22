// @ts-check

import { LEGAL_DOCUMENTS } from "./legal-documents.js"

export const SEO_SITE_NAME = "MassageLab"

// The canonical SEO host follows the production redirect target recorded in
// the launch audit so crawlers see one stable URL for every public page.
export const SEO_CANONICAL_BASE_URL = "https://www.massagelab.app"
export const SEO_DEFAULT_TITLE = "MassageLab | Massage anatomy flashcards, session timer, and practice tools"
export const SEO_DEFAULT_DESCRIPTION =
  "MassageLab helps massage students, educators, therapists, and small practices use massage anatomy flashcards, a massage session timer, wellness tools, and local-first practice tools."
export const SEO_DEFAULT_IMAGE = "/brand/massagelab-home-logo-badge-padded-20260615.png"
export const SEO_LAST_MODIFIED = "2026-06-22"

export const ROBOTS_PRIVATE_DISALLOW_PATHS = Object.freeze([
  "/api/",
  "/account",
  "/admin",
  "/anatomime/join",
  "/anatomime/play",
  "/anatomy",
  "/book",
  "/browse",
  "/calendar",
  "/forgot-password",
  "/login",
  "/notes/intake",
  "/notes/journal",
  "/notes/rom",
  "/notes/soap",
  "/onboarding",
  "/register",
  "/reset-password",
  "/settings",
  "/verify-email",
])

const flashcardStarterDeckRoutes = Object.freeze([
  {
    path: "/education/flashcards/decks/starter-all-body-identification",
    title: "All-body Image Identification",
    description: "Practice reviewed MassageLab anatomy image identification prompts across the sourced study library.",
  },
  {
    path: "/education/flashcards/decks/starter-muscle-attachments",
    title: "Muscle Origins, Insertions, Actions, and Innervation",
    description: "Study sourced MassageLab muscle attachment, action, and innervation prompts for anatomy recall.",
  },
  {
    path: "/education/flashcards/decks/starter-regions-and-categories",
    title: "Anatomy Regions and Categories",
    description: "Practice fast recall for anatomy body regions and structure categories with MassageLab flashcards.",
  },
])

const legalDocumentRoutes = Object.freeze(LEGAL_DOCUMENTS.map((document) => ({
  path: document.route,
  title: document.label,
  description: document.summary,
  lastModified: "2026-06-17",
})))

/**
 * Public pages that are allowed into the sitemap and can carry indexable
 * metadata in production. Private workspaces, APIs, auth flows, booking links,
 * shared game codes, and dynamic user-created deck pages are intentionally
 * excluded from this contract.
 */
export const PUBLIC_SEO_ROUTES = Object.freeze([
  {
    path: "/",
    title: SEO_DEFAULT_TITLE,
    description: SEO_DEFAULT_DESCRIPTION,
  },
  {
    path: "/about",
    title: "About MassageLab",
    description: "Learn why MassageLab is being built from inside the massage profession for students, educators, therapists, and small practices.",
  },
  {
    path: "/about/derrick",
    title: "About Derrick Bowersock",
    description: "Read about Derrick Bowersock, LMT, an Ohio massage therapist, educator, mentor, and builder of MassageLab.",
  },
  {
    path: "/pricing",
    title: "MassageLab Pricing",
    description: "See how MassageLab memberships fund the alpha while keeping basic tools and local-first workflows available.",
  },
  {
    path: "/support",
    title: "MassageLab Support",
    description: "Contact MassageLab support and find links to roadmap, legal, trust, and privacy information.",
  },
  {
    path: "/roadmap",
    title: "MassageLab Roadmap",
    description: "Review MassageLab's current product direction, privacy posture, membership goals, and future practice-support milestones.",
  },
  {
    path: "/tools",
    title: "MassageLab Tools",
    description: "Find MassageLab tools for massage session timing, business planning, wellness practice, scheduling, and public-alpha practice support.",
  },
  {
    path: "/legal",
    title: "MassageLab Legal and Trust Documents",
    description: "Find MassageLab terms, privacy, billing, cookie, therapist, and local-first health and wellness data notices.",
    lastModified: "2026-06-17",
  },
  ...legalDocumentRoutes,
  {
    path: "/education",
    title: "MassageLab Education",
    description: "Use MassageLab public-alpha anatomy education tools built from reviewed sourced anatomy records.",
  },
  {
    path: "/education/flashcards",
    title: "MassageLab Anatomy Flashcards",
    description: "Build and study sourced massage anatomy flashcards with image identification, region, category, and muscle prompts.",
  },
  {
    path: "/education/flashcards/decks",
    title: "MassageLab Community Flashcard Decks",
    description: "Browse starter MassageLab anatomy flashcard decks built from reviewed sourced prompt templates.",
  },
  ...flashcardStarterDeckRoutes,
  {
    path: "/anatomime",
    title: "Anatomime Classroom Anatomy Game",
    description: "Play Anatomime, MassageLab's massage anatomy classroom game with teams, body-region prompts, room codes, and shared study rounds.",
  },
  {
    path: "/chimer",
    title: "Chimer Massage Session Timer",
    description: "Use Chimer, MassageLab's massage session timer for treatment-room intervals, clock mode, and practical timekeeping.",
  },
  {
    path: "/tools/business-planner",
    title: "MassageLab Business Planner",
    description: "Open massage business planner tools for students and therapists planning session pricing, practice time, and sustainable work.",
  },
  {
    path: "/tools/business-planner/income",
    title: "Massage Business Income Planner",
    description: "Use a massage therapist income planner to estimate session prices, time off, workload capacity, and take-home goals.",
  },
  {
    path: "/clock",
    title: "MassageLab Clock",
    description: "Open MassageLab's standalone treatment-room clock mode for simple full-screen time visibility.",
  },
  {
    path: "/music",
    title: "MassageLab Music Stations",
    description: "Listen to MassageLab-hosted wellness audio stations for massage-room pacing, study, and personal focus.",
  },
  {
    path: "/wellness",
    title: "MassageLab Wellness Tools",
    description: "Use MassageLab public massage wellness tools for self-tracking practice, breathing, music, reminders, and non-diagnostic reflection.",
  },
  {
    path: "/wellness/breathing",
    title: "MassageLab Breathing Guide",
    description: "Use MassageLab's visual breathing guide to settle before, during, or after a massage session.",
  },
  {
    path: "/notes",
    title: "Local-First Massage Documentation",
    description: "Review MassageLab's local-first massage documentation posture for SOAP notes, intake forms, journals, and range-of-motion records.",
  },
].map((route) => Object.freeze({
  lastModified: SEO_LAST_MODIFIED,
  ...route,
})))

const ROUTE_BY_PATH = new Map(PUBLIC_SEO_ROUTES.map((route) => [route.path, route]))

/** @type {NonNullable<import("next").Metadata["robots"]>} */
export const NOINDEX_ROBOTS_METADATA = Object.freeze({
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
})

/** @type {NonNullable<import("next").Metadata["robots"]>} */
const INDEX_ROBOTS_METADATA = Object.freeze({
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": /** @type {"large"} */ ("large"),
    "max-snippet": -1,
    "max-video-preview": -1,
  },
})

/** @type {import("next").Metadata} */
export const PRIVATE_ROUTE_METADATA = Object.freeze({
  robots: NOINDEX_ROBOTS_METADATA,
})

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function publicSeoIndexingEnabled(env = process.env) {
  const vercelEnvironment = cleanEnv(env.VERCEL_ENV)
  if (vercelEnvironment) return vercelEnvironment === "production"

  return cleanEnv(env.NODE_ENV) === "production"
}

/**
 * @param {string} path
 */
export function normalizeSeoPath(path) {
  if (!path || path === "/") return "/"

  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`
  return withLeadingSlash.replace(/\/+$/, "") || "/"
}

/**
 * @param {string} path
 */
export function buildCanonicalUrl(path) {
  return new URL(normalizeSeoPath(path), SEO_CANONICAL_BASE_URL).toString()
}

/**
 * @param {string} path
 */
export function findPublicSeoRoute(path) {
  return ROUTE_BY_PATH.get(normalizeSeoPath(path)) ?? null
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function getSeoRobotsMetadata(env = process.env) {
  return publicSeoIndexingEnabled(env) ? INDEX_ROBOTS_METADATA : NOINDEX_ROBOTS_METADATA
}

/**
 * @param {string} path
 * @param {{
 *   title?: string,
 *   description?: string,
 *   canonicalPath?: string,
 *   env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
 * }} [overrides]
 * @returns {import("next").Metadata}
 */
export function createPublicPageMetadata(path, overrides = {}) {
  const route = findPublicSeoRoute(path)
  const title = overrides.title ?? route?.title ?? SEO_DEFAULT_TITLE
  const description = overrides.description ?? route?.description ?? SEO_DEFAULT_DESCRIPTION
  const canonicalPath = normalizeSeoPath(overrides.canonicalPath ?? route?.path ?? path)
  const canonicalUrl = buildCanonicalUrl(canonicalPath)
  const imageUrl = buildCanonicalUrl(SEO_DEFAULT_IMAGE)

  return {
    metadataBase: new URL(SEO_CANONICAL_BASE_URL),
    title,
    description,
    applicationName: SEO_SITE_NAME,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: SEO_SITE_NAME,
      title,
      description,
      url: canonicalUrl,
      images: [
        {
          url: imageUrl,
          width: 1536,
          height: 760,
          alt: "MassageLab",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    robots: getSeoRobotsMetadata(overrides.env),
  }
}

/**
 * @param {{
 *   title?: string,
 *   description?: string,
 *   canonicalPath?: string,
 * }} [overrides]
 * @returns {import("next").Metadata}
 */
export function createNoindexPageMetadata(overrides = {}) {
  return {
    title: overrides.title ?? SEO_SITE_NAME,
    description: overrides.description ?? SEO_DEFAULT_DESCRIPTION,
    alternates: overrides.canonicalPath
      ? { canonical: buildCanonicalUrl(overrides.canonicalPath) }
      : undefined,
    robots: NOINDEX_ROBOTS_METADATA,
  }
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function createSitemapEntries(env = process.env) {
  if (!publicSeoIndexingEnabled(env)) return []

  return PUBLIC_SEO_ROUTES.map((route) => ({
    url: buildCanonicalUrl(route.path),
    lastModified: new Date(route.lastModified),
  }))
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function getRobotsRouteConfig(env = process.env) {
  if (!publicSeoIndexingEnabled(env)) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
    }
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...ROBOTS_PRIVATE_DISALLOW_PATHS],
      },
    ],
    sitemap: `${SEO_CANONICAL_BASE_URL}/sitemap.xml`,
    host: SEO_CANONICAL_BASE_URL,
  }
}

export function createSeoJsonLd() {
  const organizationId = `${SEO_CANONICAL_BASE_URL}/#organization`
  const websiteId = `${SEO_CANONICAL_BASE_URL}/#website`
  const webAppId = `${SEO_CANONICAL_BASE_URL}/#web-application`

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: SEO_SITE_NAME,
        url: SEO_CANONICAL_BASE_URL,
        logo: {
          "@type": "ImageObject",
          url: buildCanonicalUrl(SEO_DEFAULT_IMAGE),
          width: 1536,
          height: 760,
        },
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: SEO_SITE_NAME,
        url: SEO_CANONICAL_BASE_URL,
        description: SEO_DEFAULT_DESCRIPTION,
        inLanguage: "en-US",
        publisher: {
          "@id": organizationId,
        },
      },
      {
        "@type": "WebApplication",
        "@id": webAppId,
        name: SEO_SITE_NAME,
        url: SEO_CANONICAL_BASE_URL,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Any modern web browser",
        description: SEO_DEFAULT_DESCRIPTION,
        browserRequirements: "Requires a modern browser with JavaScript enabled.",
        publisher: {
          "@id": organizationId,
        },
      },
    ],
  }
}

/**
 * @param {string | undefined} value
 */
function cleanEnv(value) {
  return typeof value === "string" ? value.trim() : ""
}
