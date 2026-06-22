import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { LEGAL_DOCUMENTS } from "../lib/legal-documents.js"
import {
  PUBLIC_SEO_ROUTES,
  ROBOTS_PRIVATE_DISALLOW_PATHS,
  buildCanonicalUrl,
  createSitemapEntries,
  getRobotsRouteConfig,
  publicSeoIndexingEnabled,
} from "../lib/seo.js"

const productionEnv = Object.freeze({ NODE_ENV: "production", VERCEL_ENV: "production" })
const previewEnv = Object.freeze({ NODE_ENV: "production", VERCEL_ENV: "preview" })
const developmentEnv = Object.freeze({ NODE_ENV: "development" })

function readProjectFile(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8").toLowerCase()
}

describe("SEO route contract", () => {
  it("enables public indexing only for production deployments", () => {
    assert.equal(publicSeoIndexingEnabled(productionEnv), true)
    assert.equal(publicSeoIndexingEnabled(previewEnv), false)
    assert.equal(publicSeoIndexingEnabled(developmentEnv), false)
  })

  it("builds canonical URLs on the production redirect target", () => {
    assert.equal(buildCanonicalUrl("/about/"), "https://www.massagelab.app/about")
    assert.equal(buildCanonicalUrl("education/flashcards"), "https://www.massagelab.app/education/flashcards")
  })

  it("keeps legal documents and starter study routes in the public sitemap contract", () => {
    const publicPaths = PUBLIC_SEO_ROUTES.map((route) => route.path)

    assert.ok(publicPaths.includes("/"))
    assert.ok(publicPaths.includes("/education/flashcards/decks/starter-all-body-identification"))
    assert.ok(publicPaths.includes("/education/flashcards/decks/starter-muscle-attachments"))
    assert.ok(publicPaths.includes("/education/flashcards/decks/starter-regions-and-categories"))

    for (const document of LEGAL_DOCUMENTS) {
      assert.ok(publicPaths.includes(document.route), `missing legal route ${document.route}`)
    }
  })

  it("does not include private or per-user paths in sitemap entries", () => {
    const entries = createSitemapEntries(productionEnv)
    const urls = entries.map((entry) => new URL(entry.url))

    assert.equal(entries.length, PUBLIC_SEO_ROUTES.length)
    assert.equal(createSitemapEntries(previewEnv).length, 0)

    for (const url of urls) {
      assert.equal(url.search, "")
      assert.equal(url.hostname, "www.massagelab.app")
      assert.equal(url.pathname.startsWith("/api/"), false)
      assert.equal(url.pathname.startsWith("/account"), false)
      assert.equal(url.pathname.startsWith("/admin"), false)
      assert.equal(url.pathname.startsWith("/book/"), false)
      assert.equal(url.pathname.startsWith("/calendar"), false)
      assert.equal(url.pathname.startsWith("/anatomime/play/"), false)
      assert.equal(url.pathname.startsWith("/notes/soap"), false)
      assert.equal("priority" in entries[0], false)
      assert.equal("changeFrequency" in entries[0], false)
    }
  })

  it("blocks private sections in production robots.txt while advertising the sitemap", () => {
    const robots = getRobotsRouteConfig(productionEnv)
    const disallow = robots.rules[0].disallow

    assert.equal(robots.sitemap, "https://www.massagelab.app/sitemap.xml")
    assert.deepEqual(disallow, [...ROBOTS_PRIVATE_DISALLOW_PATHS])
    assert.ok(disallow.includes("/api/"))
    assert.ok(disallow.includes("/account"))
    assert.ok(disallow.includes("/anatomime/play/"))
    assert.ok(disallow.includes("/notes/soap"))
  })

  it("disallows all crawling outside production", () => {
    assert.deepEqual(getRobotsRouteConfig(previewEnv).rules, [{ userAgent: "*", disallow: "/" }])
    assert.deepEqual(getRobotsRouteConfig(developmentEnv).rules, [{ userAgent: "*", disallow: "/" }])
  })

  it("keeps focused public landing copy aligned with target searches", () => {
    const publicRouteCopy = PUBLIC_SEO_ROUTES
      .map((route) => `${route.title} ${route.description}`)
      .join(" ")
      .toLowerCase()

    assert.match(readProjectFile("app/page.tsx"), /massage anatomy flashcards/)
    assert.match(readProjectFile("app/page.tsx"), /massage session timer/)
    assert.match(readProjectFile("app/education/flashcards/page.tsx"), /massage anatomy flashcards/)
    assert.match(readProjectFile("app/anatomime/page.tsx"), /massage anatomy classroom game/)
    assert.match(readProjectFile("app/chimer/set-timer.tsx"), /massage session timer/)
    assert.match(readProjectFile("app/notes/page.tsx"), /local-first massage documentation/)
    assert.match(readProjectFile("app/wellness/page.tsx"), /massage wellness tools/)
    assert.match(publicRouteCopy, /massage anatomy flashcards/)
    assert.match(publicRouteCopy, /massage session timer/)
    assert.match(publicRouteCopy, /local-first massage documentation/)
  })

  it("keeps public about pages visitor-facing instead of placeholder-facing", () => {
    const aboutCopy = readProjectFile("app/about/page.tsx")
    const derrickCopy = readProjectFile("app/about/derrick/page.tsx")
    const combinedCopy = `${aboutCopy} ${derrickCopy}`

    assert.match(aboutCopy, /built from inside the massage profession/)
    assert.match(derrickCopy, /licensed massage therapist in ohio/)
    assert.doesNotMatch(combinedCopy, /current focus/)
    assert.doesNotMatch(combinedCopy, /credential note/)
    assert.doesNotMatch(combinedCopy, /intentionally brief/)
    assert.doesNotMatch(combinedCopy, /exact wording/)
    assert.doesNotMatch(combinedCopy, /private-alpha|private alpha/)
  })
})
