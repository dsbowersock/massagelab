import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readFileSync, readdirSync } from "node:fs"
import { extname, join, relative } from "node:path"
import ts from "typescript"

const ROOT = process.cwd()
const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".ts", ".tsx"])
const ROOT_SENTRY_ENTRYPOINTS = [
  "instrumentation.ts",
  "instrumentation-client.ts",
  "sentry.options.ts",
  "sentry.server.config.ts",
  "sentry.edge.config.ts",
]
const PROHIBITED_SENTRY_METHODS = new Set([
  "setUser",
  "showReportDialog",
  "captureUserFeedback",
  "addAttachment",
])
const REVIEWED_SENTRY_METHODS = new Set([
  ...PROHIBITED_SENTRY_METHODS,
  "captureException",
  "captureMessage",
])

/** Recursively returns JavaScript and TypeScript source paths below a directory. */
function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : []
  })
}

/** Reads a repository-relative source file without normalizing its contents. */
function source(filePath) {
  return readFileSync(join(ROOT, filePath), "utf8")
}

/**
 * Returns every application and root SDK entrypoint governed by the anonymous
 * Sentry contract. A separate assertion keeps the explicit root allowlist in
 * sync with discovered framework entrypoints.
 */
function sentryBoundarySources() {
  return [
    ...["app", "components", "lib"]
      .flatMap((directory) => sourceFiles(join(ROOT, directory)))
      .map((filePath) => [relative(ROOT, filePath).replaceAll("\\", "/"), readFileSync(filePath, "utf8")]),
    ...ROOT_SENTRY_ENTRYPOINTS.map((filePath) => [filePath, source(filePath)]),
  ]
}

/**
 * Conservatively finds reviewed method references and dynamic calls derived
 * from any Sentry SDK import. Flagging the reference that creates an alias keeps
 * the guard independent of later control flow and lexical shadowing.
 */
function findReviewedSentryReferences(filePath, contents) {
  const scriptKind = extname(filePath) === ".tsx" ? ts.ScriptKind.TSX
    : extname(filePath) === ".ts" ? ts.ScriptKind.TS
      : ts.ScriptKind.JS
  const syntaxTree = ts.createSourceFile(filePath, contents, ts.ScriptTarget.Latest, true, scriptKind)
  const namespaceAliases = new Set()
  const references = []

  function unwrap(expression) {
    let current = expression
    while (ts.isParenthesizedExpression(current)
      || ts.isAsExpression(current)
      || ts.isTypeAssertionExpression(current)
      || ts.isNonNullExpression(current)
      || ts.isSatisfiesExpression(current)) {
      current = current.expression
    }
    return current
  }

  function originatesFromSentry(expression) {
    const current = unwrap(expression)
    if (ts.isIdentifier(current)) return namespaceAliases.has(current.text)
    if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
      return originatesFromSentry(current.expression)
    }
    if (ts.isCallExpression(current)) return originatesFromSentry(current.expression)
    return false
  }

  function elementName(node) {
    const property = node.argumentExpression
    return property && (ts.isStringLiteral(property) || ts.isNoSubstitutionTemplateLiteral(property))
      ? property.text
      : undefined
  }

  function bindingName(node) {
    const property = node.propertyName
    if (!property) return ts.isIdentifier(node.name) ? node.name.text : undefined
    if (ts.isIdentifier(property) || ts.isStringLiteral(property)) return property.text
    if (ts.isComputedPropertyName(property)
      && (ts.isStringLiteral(property.expression) || ts.isNoSubstitutionTemplateLiteral(property.expression))) {
      return property.expression.text
    }
    return undefined
  }

  function assignmentPropertyName(node) {
    if (ts.isShorthandPropertyAssignment(node)) return node.name.text
    if (!ts.isPropertyAssignment(node)) return undefined
    const property = node.name
    if (ts.isIdentifier(property) || ts.isStringLiteral(property)) return property.text
    if (ts.isComputedPropertyName(property)
      && (ts.isStringLiteral(property.expression)
        || ts.isNoSubstitutionTemplateLiteral(property.expression))) {
      return property.expression.text
    }
    return undefined
  }

  function visit(node) {
    if (ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && node.moduleSpecifier.text.startsWith("@sentry/")) {
      const importClause = node.importClause
      if (importClause?.name) namespaceAliases.add(importClause.name.text)
      if (importClause?.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
        namespaceAliases.add(importClause.namedBindings.name.text)
      }
      if (importClause?.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
        for (const element of importClause.namedBindings.elements) {
          const method = element.propertyName?.text ?? element.name.text
          namespaceAliases.add(element.name.text)
          if (REVIEWED_SENTRY_METHODS.has(method)) references.push({ filePath, method })
        }
      }
    }

    if (ts.isExportDeclaration(node)
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)
      && node.moduleSpecifier.text.startsWith("@sentry/")) {
      if (!node.exportClause) {
        references.push({ filePath, method: "<dynamic>" })
      } else if (ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          const method = element.propertyName?.text ?? element.name.text
          if (REVIEWED_SENTRY_METHODS.has(method)) references.push({ filePath, method })
        }
      } else if (ts.isNamespaceExport(node.exportClause)) {
        references.push({ filePath, method: "<dynamic>" })
      }
    }

    if (ts.isExportDeclaration(node)
      && !node.moduleSpecifier
      && node.exportClause
      && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) {
        const localName = element.propertyName?.text ?? element.name.text
        if (namespaceAliases.has(localName)) references.push({ filePath, method: "<dynamic>" })
      }
    }

    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (ts.isIdentifier(node.name) && originatesFromSentry(node.initializer)) {
        namespaceAliases.add(node.name.text)
      } else if (ts.isObjectBindingPattern(node.name) && originatesFromSentry(node.initializer)) {
        for (const element of node.name.elements) {
          const method = bindingName(element)
          if (method && REVIEWED_SENTRY_METHODS.has(method)) references.push({ filePath, method })
        }
      }
    }

    if (ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && originatesFromSentry(node.right)) {
      const assignmentTarget = unwrap(node.left)
      if (ts.isIdentifier(assignmentTarget)) {
        namespaceAliases.add(assignmentTarget.text)
      } else if (ts.isObjectLiteralExpression(assignmentTarget)) {
        for (const property of assignmentTarget.properties) {
          const method = assignmentPropertyName(property)
          if (method && REVIEWED_SENTRY_METHODS.has(method)) {
            references.push({ filePath, method })
          } else if (ts.isSpreadAssignment(property)
            || ("name" in property && ts.isComputedPropertyName(property.name) && !method)) {
            references.push({ filePath, method: "<dynamic>" })
          }
        }
      }
    }

    if (ts.isPropertyAccessExpression(node) && REVIEWED_SENTRY_METHODS.has(node.name.text)) {
      references.push({ filePath, method: node.name.text })
    }

    if (ts.isElementAccessExpression(node)) {
      const method = elementName(node)
      if (method && REVIEWED_SENTRY_METHODS.has(method)) {
        references.push({ filePath, method })
      } else if (!method && originatesFromSentry(node.expression)) {
        references.push({ filePath, method: "<dynamic>" })
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(syntaxTree)
  return references
}

const BOUNDARY_SOURCES = sentryBoundarySources()
const BOUNDARY_REFERENCES = BOUNDARY_SOURCES
  .flatMap(([filePath, contents]) => findReviewedSentryReferences(filePath, contents))

describe("anonymous operational Sentry boundary", () => {
  it("keeps prohibited Sentry products and identity APIs out of application source", () => {
    const prohibitedCalls = BOUNDARY_REFERENCES
      .filter(({ method }) => PROHIBITED_SENTRY_METHODS.has(method) || method === "<dynamic>")
    const combined = BOUNDARY_SOURCES.map(([filePath, contents]) => `${filePath}\n${contents}`).join("\n")

    assert.deepEqual(prohibitedCalls, [])
    assert.doesNotMatch(combined, /(?:replayIntegration|feedbackIntegration|captureConsoleIntegration)\s*\(/)
    assert.doesNotMatch(combined, /@sentry\/replay/)
  })

  it("limits application capture sites to global errors and voluntary diagnostics", () => {
    const captureSites = [...new Set(BOUNDARY_REFERENCES
      .filter(({ method }) => method === "captureException" || method === "captureMessage")
      .map(({ filePath }) => filePath))]
      .sort()

    assert.deepEqual(captureSites, [
      "app/api/support/problem-report/route.ts",
      "app/global-error.tsx",
    ])
  })

  it("detects prohibited Sentry calls through common alias forms", () => {
    const references = findReviewedSentryReferences("fixture.ts", `
      import * as Sentry from "@sentry/nextjs"
      import * as Core from "@sentry/core"
      import { addAttachment as attach } from "@sentry/browser"
      import { getCurrentScope } from "@sentry/core"
      const report = Sentry.captureUserFeedback as typeof Sentry.captureUserFeedback
      const { ["setUser"]: identify } = Sentry
      const { setUser: scopeIdentify } = getCurrentScope()
      const scope = getCurrentScope()
      let dialog
      dialog = Sentry.showReportDialog
      Core.setUser()
      Sentry.getCurrentScope().addAttachment()
      Sentry["showReportDialog"]()
      Sentry[method]()
      scope[method]()
    `).map(({ method }) => method)

    assert.deepEqual(new Set(references), new Set([
      "addAttachment",
      "captureUserFeedback",
      "setUser",
      "showReportDialog",
      "<dynamic>",
    ]))
    assert.deepEqual(findReviewedSentryReferences("bridge.ts", `
      import * as SDK from "@sentry/core"
      export { setUser as identify } from "@sentry/core"
      export * from "@sentry/browser"
      export * as Sentry from "@sentry/core"
      export { SDK as SentrySdk }
    `).map(({ method }) => method), ["setUser", "<dynamic>", "<dynamic>", "<dynamic>"])
    assert.deepEqual(findReviewedSentryReferences("allowed.ts", `
      import * as Sentry from "@sentry/nextjs"
      Sentry.init()
      Sentry.flush()
      Sentry.captureRequestError()
      Sentry.captureRouterTransitionStart()
    `), [])
    assert.deepEqual(findReviewedSentryReferences("assignment.ts", `
      import * as Sentry from "@sentry/nextjs"
      let identify
      let dialog
      let dynamicAlias
      ({ setUser: identify, ["showReportDialog"]: dialog, [method]: dynamicAlias } = Sentry)
    `).map(({ method }) => method), ["setUser", "showReportDialog", "<dynamic>"])
  })

  it("pins root Sentry framework hooks without allowing additional capture APIs", () => {
    const discoveredEntrypoints = readdirSync(ROOT, { withFileTypes: true })
      .filter((entry) => entry.isFile()
        && SOURCE_EXTENSIONS.has(extname(entry.name))
        && (entry.name.startsWith("instrumentation") || entry.name.startsWith("sentry.")))
      .map((entry) => entry.name)
      .sort()

    assert.deepEqual(discoveredEntrypoints, [...ROOT_SENTRY_ENTRYPOINTS].sort())

    const rootSources = [
      ["instrumentation.ts", source("instrumentation.ts")],
      ["instrumentation-client.ts", source("instrumentation-client.ts")],
    ]

    assert.match(rootSources[0][1], /export const onRequestError\s*=\s*Sentry\.captureRequestError/)
    assert.match(rootSources[1][1], /export const onRouterTransitionStart\s*=\s*Sentry\.captureRouterTransitionStart/)

    const rootCaptureCalls = rootSources
      .flatMap(([path, contents]) => [...contents.matchAll(/Sentry\.capture[A-Za-z0-9_]+/g)]
        .map(([match]) => `${path}:${match}`))
      .sort()

    assert.deepEqual(rootCaptureCalls, [
      "instrumentation-client.ts:Sentry.captureRouterTransitionStart",
      "instrumentation.ts:Sentry.captureRequestError",
    ])
  })

  it("keeps the SDK policy explicit and session-free", () => {
    const options = source("sentry.options.ts")
    const server = source("sentry.server.config.ts")
    const policy = source("lib/sentry-options.js")
    const privacy = source("lib/sentry-privacy.js")

    assert.match(options, /dataCollection:\s*getAnonymousSentryDataCollection\(\)/)
    assert.match(options, /enableLogs:\s*false/)
    assert.match(options, /enableMetrics:\s*false/)
    assert.match(options, /maxBreadcrumbs:\s*0/)
    assert.match(server, /includeServerName:\s*false/)
    assert.match(privacy, /event\.user\s*=\s*{\s*ip_address:\s*null\s*}/)
    assert.match(options, /integrations\(defaultIntegrations\)\s*{\s*return filterAnonymousSentryIntegrations\(defaultIntegrations\)\s*}/s)
    assert.match(policy, /"BrowserSession"/)
    assert.match(policy, /"Replay"/)
  })

  it("documents anonymous diagnostics without presenting them as product analytics", () => {
    const deployment = source("docs/wiki/deployment.md")
    const privacy = source("docs/wiki/privacy-and-phi.md")
    const combined = `${deployment}\n${privacy}`

    for (const phrase of [
      "no account, user, visitor, or session identifier",
      "automatic click, input, navigation, console, and network breadcrumbs are disabled",
      "not product analytics",
      "Prevent Storing of IP Addresses",
      "requires a separately approved scoped design/privacy contract and disclosure review",
    ]) {
      assert.match(combined, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
    }
  })
})
