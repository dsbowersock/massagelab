export type BrowserAdminFixtureIdentity = {
  projectSlug: string
  operator: { id: string; name: string; email: string }
  target: { id: string; name: string; email: string }
}

/**
 * Creates the exact browser-admin identities owned by one Playwright project.
 * Project-qualified IDs prevent concurrent desktop/mobile setup and teardown
 * from reading or deleting one another's deterministic fixture records.
 */
export function createBrowserAdminFixtureIdentity(projectName: string): BrowserAdminFixtureIdentity {
  const projectSlug = browserAdminFixtureProjectSlug(projectName)
  return {
    projectSlug,
    operator: browserAdminIdentity("operator", projectName),
    target: browserAdminIdentity("target", projectName),
  }
}

/** Encodes the safe project name injectively for alphanumeric-only provider sentinels. */
export function browserAdminFixtureProjectSlug(projectName: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectName)) {
    throw new Error("Browser fixture requires a safe Playwright project name.")
  }
  return Array.from(projectName, (character) => character.charCodeAt(0).toString(16).padStart(2, "0")).join("")
}

function browserAdminIdentity(kind: "operator" | "target", projectName: string) {
  const id = `browser-admin-${kind}-${projectName}`
  const namePrefix = `Browser Admin ${kind === "operator" ? "Operator" : "Target"} ${projectName}`
  if (id.length > 64 || namePrefix.length > 120) {
    throw new Error("Browser fixture requires a safe Playwright project name.")
  }
  const localPart = id.padEnd(64, "x")
  const maximumSafeTestDomain = `${"d".repeat(63)}.${"q".repeat(63)}.${"a".repeat(56)}.test`
  return {
    id,
    name: namePrefix.padEnd(120, "x"),
    email: `${localPart}@${maximumSafeTestDomain}`,
  }
}
