import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { it } from "node:test"
import ts from "typescript"

import { BROWSER_QA_PROJECT_NAMES } from "./browser/ci-lanes.mjs"

const FOCUSED_ANATOMIME_NODE_TEST_FILES = [
  "anatomime-traffic-server.test.mjs",
  "anatomime-traffic-routes.test.mjs",
  "anatomime-polling.test.mjs",
  "anatomime-shared.test.mjs",
  "anatomime-room-rules.test.mjs",
  "anatomime-page-lazy-boundary.test.mjs",
  "anatomime-invite-qr.test.mjs",
  "anatomime-release-receipts.test.mjs",
]
const browserSpecFile = "browser/anatomime-traffic.spec.ts"
const [focusedNodeSources, browserSpecSource, projectStateSource, projectLogSource] = await Promise.all([
  Promise.all(FOCUSED_ANATOMIME_NODE_TEST_FILES.map(async (fileName) => ({
    fileName,
    source: await readFile(new URL(fileName, import.meta.url), "utf8"),
  }))),
  readFile(new URL(browserSpecFile, import.meta.url), "utf8"),
  readFile(new URL("../docs/project-state.md", import.meta.url), "utf8"),
  readFile(new URL("../docs/project-log.md", import.meta.url), "utf8"),
])

/** Escapes a derived receipt so it can be matched literally in canonical documentation. */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Returns the statically knowable size of a literal test-case inventory. The
 * focused suites use literal arrays for generated registrations; rejecting any
 * other iterable keeps the receipt from silently undercounting new patterns.
 */
function literalInventorySize(expression, sourceFile, fileName) {
  if (ts.isParenthesizedExpression(expression)
    || ts.isAsExpression(expression)
    || ts.isSatisfiesExpression(expression)) {
    return literalInventorySize(expression.expression, sourceFile, fileName)
  }
  if (ts.isIdentifier(expression)) {
    const declarations = []
    const collectDeclaration = (node) => {
      if (ts.isVariableDeclaration(node)
        && ts.isIdentifier(node.name)
        && node.name.text === expression.text
        && node.initializer) {
        declarations.push(node.initializer)
      }
      ts.forEachChild(node, collectDeclaration)
    }
    collectDeclaration(sourceFile)
    assert.equal(
      declarations.length,
      1,
      `${fileName} must declare exactly one literal ${expression.text} test inventory`,
    )
    return literalInventorySize(declarations[0], sourceFile, fileName)
  }
  assert.ok(
    ts.isArrayLiteralExpression(expression),
    `${fileName} uses a non-literal iterable around a registered test: ${expression.getText(sourceFile)}`,
  )
  assert.ok(
    expression.elements.every((element) => !ts.isSpreadElement(element)),
    `${fileName} uses an unsupported spread in a registered test inventory: ${expression.getText(sourceFile)}`,
  )
  return expression.elements.length
}

/**
 * Counts direct `it()` or `test()` registrations without executing a test
 * module. Literal top-level registration loops are multiplied by their case
 * inventory, while registrations' callback bodies are deliberately skipped.
 */
function registeredTestCount(source, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  )
  let count = 0

  function containsRegistration(node) {
    if (ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && (node.expression.text === "it" || node.expression.text === "test")) {
      return true
    }
    return node.getChildren(sourceFile).some(containsRegistration)
  }

  function visit(node, multiplier = 1) {
    if (ts.isForOfStatement(node)) {
      if (!containsRegistration(node.statement)) return
      visit(node.statement, multiplier * literalInventorySize(node.expression, sourceFile, fileName))
      return
    }
    if (ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && (node.expression.text === "it" || node.expression.text === "test")) {
      count += multiplier
      return
    }
    ts.forEachChild(node, (child) => visit(child, multiplier))
  }

  visit(sourceFile)
  return count
}

it("keeps canonical Layer B receipts synchronized with the executable test inventories", () => {
  assert.throws(
    () => registeredTestCount(
      "for (const scenario of [...cases]) { it(String(scenario), () => {}) }",
      "spread-inventory-fixture.mjs",
    ),
    /unsupported spread in a registered test inventory/,
  )
  const focusedNodeTotal = focusedNodeSources.reduce(
    (total, { fileName, source }) => total + registeredTestCount(source, fileName),
    0,
  )
  const browserCaseTotal = registeredTestCount(browserSpecSource, browserSpecFile)
    * BROWSER_QA_PROJECT_NAMES.length
  const focusedNodeReceipt = new RegExp(escapeRegExp(
    `exact ${focusedNodeTotal}/${focusedNodeTotal} focused Anatomime matrix`,
  ))
  const browserReceipt = new RegExp(escapeRegExp(
    `Fresh exact-head full intercepted Anatomime Browser QA coverage reports ${browserCaseTotal}/${browserCaseTotal} desktop/mobile cases ok in one post-fix run`,
  ))

  for (const source of [projectStateSource, projectLogSource]) {
    assert.match(source, focusedNodeReceipt)
    assert.match(source, browserReceipt)
  }
})
