import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8")
}

test("browser QA harness is wired for public smoke, PWA, and local-first checks", async () => {
  const [packageJson, config, publicRoutesSpec, pwaSpec, localFirstSpec, ciWorkflow] = await Promise.all([
    readProjectFile("package.json"),
    readProjectFile("playwright.config.ts"),
    readProjectFile("tests/browser/public-routes.spec.ts"),
    readProjectFile("tests/browser/pwa.spec.ts"),
    readProjectFile("tests/browser/local-first.spec.ts"),
    readProjectFile(".github/workflows/ci.yml"),
  ])

  const packageData = JSON.parse(packageJson)

  assert.match(packageData.devDependencies["@playwright/test"], /^\^\d+\.\d+\.\d+$/)
  assert.equal(packageData.scripts["test:browser"], "playwright test")
  assert.equal(packageData.scripts["test:browser:build"], "npm run build && npm run test:browser")

  assert.match(config, /webServer/)
  assert.match(config, /127\.0\.0\.1:3010/)
  assert.match(config, /Desktop Chrome/)
  assert.match(config, /Pixel 7/)

  for (const route of ["/", "/notes", "/notes/soap", "/chimer", "/calendar", "/anatomime"]) {
    assert.match(publicRoutesSpec, new RegExp(JSON.stringify(route)))
  }

  assert.match(publicRoutesSpec, /\/api\/account\/preferences/)
  assert.match(publicRoutesSpec, /\/api\/account\/profile/)
  assert.match(publicRoutesSpec, /page\.on\("console"/)
  assert.match(publicRoutesSpec, /page\.on\("pageerror"/)

  assert.match(pwaSpec, /\/manifest\.webmanifest/)
  assert.match(pwaSpec, /\/icons\/icon-192\.png/)
  assert.match(pwaSpec, /\/icons\/icon-512\.png/)
  assert.match(pwaSpec, /\/icons\/maskable-icon-192\.png/)
  assert.match(pwaSpec, /\/icons\/maskable-icon-512\.png/)

  assert.match(localFirstSpec, /ML_BROWSER_QA_SENTINEL/)
  assert.match(localFirstSpec, /\/api\/clinical\/sync/)
  assert.match(localFirstSpec, /\/api\/clients\//)
  assert.match(localFirstSpec, /POST|PUT|PATCH|DELETE/)

  assert.match(ciWorkflow, /npm run test:browser/)
  assert.match(ciWorkflow, /AUTH_SECRET/)
  assert.match(ciWorkflow, /NEXTAUTH_SECRET/)
  assert.match(ciWorkflow, /npx playwright install --with-deps chromium/)
})
