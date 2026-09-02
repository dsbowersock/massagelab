export type BrowserIdentityMethodFixtureScenario = "MATCHING_LINK" | "GOOGLE_ONLY" | "BOTH_METHODS"

export type BrowserIdentityMethodFixtureIdentity = {
  projectSlug: string
  scenario: BrowserIdentityMethodFixtureScenario
  user: { id: string; name: string; email: string }
  intentId: string
  providerAccountId: string
}
/** Creates project-qualified example.test identities that cannot overlap browser workers. */
export function createBrowserIdentityMethodFixtureIdentity(
  projectName: string,
  scenario: BrowserIdentityMethodFixtureScenario,
): BrowserIdentityMethodFixtureIdentity {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectName)) {
    throw new Error("Identity-method fixture requires a safe Playwright project name.")
  }
  if (!(["MATCHING_LINK", "GOOGLE_ONLY", "BOTH_METHODS"] as const).includes(scenario)) {
    throw new Error("Identity-method fixture requires a supported scenario.")
  }
  const projectSlug = Array.from(projectName, (character) => character.charCodeAt(0).toString(16).padStart(2, "0")).join("")
  const scenarioSlug = scenario.toLowerCase().replaceAll("_", "-")
  const id = `browser-identity-${scenarioSlug}-${projectName}`
  const email = `${scenarioSlug}-${projectSlug}@identity-method.massagelab.example.test`
  if (!email.endsWith(".example.test") || id.length > 191 || email.length > 320) {
    throw new Error("Identity-method fixture refuses a non-example identity.")
  }
  return {
    projectSlug,
    scenario,
    user: { id, name: `Browser Identity ${scenarioSlug} ${projectName}`, email },
    intentId: `browser-intent-${scenarioSlug}-${projectName}`,
    providerAccountId: `browser-google-${scenarioSlug}-${projectSlug}`,
  }
}
