export type BrowserAdminFixtureIdentity = {
  operator: { id: string; name: string; email: string }
  target: { id: string; name: string; email: string }
}

/**
 * Creates the exact browser-admin identities owned by one Playwright project.
 * Project-qualified IDs prevent concurrent desktop/mobile setup and teardown
 * from reading or deleting one another's deterministic fixture records.
 */
export function createBrowserAdminFixtureIdentity(projectName: string): BrowserAdminFixtureIdentity {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectName)) {
    throw new Error("Browser fixture requires a safe Playwright project name.")
  }
  return {
    operator: browserAdminIdentity("operator", projectName),
    target: browserAdminIdentity("target", projectName),
  }
}

function browserAdminIdentity(kind: "operator" | "target", projectName: string) {
  const id = `browser-admin-${kind}-${projectName}`
  return {
    id,
    name: `Browser Admin ${kind === "operator" ? "Operator" : "Target"} ${projectName}`,
    email: `${id}@example.test`,
  }
}
