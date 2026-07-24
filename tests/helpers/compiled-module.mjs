import { createRequire } from "node:module"
import ts from "typescript"

/**
 * Transpiles a production TS/TSX/ESM source string into executable CommonJS
 * without changing the production module or introducing test-only exports.
 */
export function compileCommonJsModule(source, fileName) {
  return ts.transpileModule(source.replace(/^#!.*\r?\n/, ""), {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: fileName.replace(/\.mjs$/, ".js"),
  }).outputText
}

/**
 * Creates a compiler/loader whose unresolved requires use the calling test's
 * location. Explicit dependency doubles always take precedence.
 */
export function createCompiledModuleLoader(parentUrl) {
  const requireFromTest = createRequire(parentUrl)

  return function loadCompiledModule(source, fileName, dependencies = {}) {
    const compiledSource = compileCommonJsModule(source, fileName)
    const compiledModule = { exports: {} }
    const executeModule = new Function("require", "exports", "module", compiledSource)

    executeModule((specifier) => (
      Object.hasOwn(dependencies, specifier)
        ? dependencies[specifier]
        : requireFromTest(specifier)
    ), compiledModule.exports, compiledModule)

    return compiledModule.exports
  }
}

/** Creates the minimal JSX-like node shape emitted by the test JSX runtime. */
export function createElement(type, props, key) {
  return {
    type,
    key: key ?? null,
    props: props ?? {},
  }
}

/** Identifies the minimal element shape emitted by the test JSX runtime. */
function isJsxLikeNode(value) {
  return Boolean(
    value
    && typeof value === "object"
    && Object.hasOwn(value, "type")
    && Object.hasOwn(value, "props"),
  )
}

/** Returns the first matching JSX-like object across every prop value. */
export function findElement(tree, predicate) {
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const match = findElement(child, predicate)
      if (match) {
        return match
      }
    }
    return null
  }

  if (!tree || typeof tree !== "object") {
    return null
  }

  if (isJsxLikeNode(tree) && predicate(tree)) {
    return tree
  }

  const nestedValues = isJsxLikeNode(tree)
    ? Object.values(tree.props ?? {})
    : Object.values(tree)
  for (const value of nestedValues) {
    const match = findElement(value, predicate)
    if (match) {
      return match
    }
  }
  return null
}

/** Collects every matching JSX-like object across every prop value. */
export function findElements(tree, predicate, matches = []) {
  if (Array.isArray(tree)) {
    for (const child of tree) {
      findElements(child, predicate, matches)
    }
    return matches
  }

  if (!tree || typeof tree !== "object") {
    return matches
  }

  if (isJsxLikeNode(tree) && predicate(tree)) {
    matches.push(tree)
  }
  const nestedValues = isJsxLikeNode(tree)
    ? Object.values(tree.props ?? {})
    : Object.values(tree)
  for (const value of nestedValues) {
    findElements(value, predicate, matches)
  }
  return matches
}

/** Recursively evaluates function-component nodes across every prop value. */
export function renderFunctionComponents(tree) {
  if (Array.isArray(tree)) {
    return tree.map(renderFunctionComponents)
  }
  if (!tree || typeof tree !== "object") {
    return tree ?? null
  }
  if (!Object.hasOwn(tree, "type") || !Object.hasOwn(tree, "props")) {
    return tree
  }
  if (typeof tree.type === "function") {
    return renderFunctionComponents(tree.type(tree.props))
  }

  const renderedProps = Object.fromEntries(
    Object.entries(tree.props ?? {}).map(([name, value]) => [
      name,
      renderFunctionComponents(value),
    ]),
  )
  return {
    ...tree,
    props: renderedProps,
  }
}

/**
 * Flattens readable text from children and explicit text-bearing props without
 * leaking implementation props such as class names, URLs, or event handlers.
 */
export function elementText(tree) {
  if (Array.isArray(tree)) {
    return tree.map(elementText).join("")
  }
  if (typeof tree === "string" || typeof tree === "number") {
    return String(tree)
  }
  if (!tree || typeof tree !== "object") {
    return ""
  }

  const props = tree.props ?? {}
  const textValues = [
    props.children,
    props.title,
    props["aria-label"],
    props.label,
    props.placeholder,
    props.content,
  ]
  const hasExplicitText = textValues.some((value) => value != null)

  if (
    !hasExplicitText
    && tree.type !== "input"
    && tree.type !== "textarea"
    && (typeof props.value === "string" || typeof props.value === "number")
  ) {
    textValues.push(props.value)
  }

  return textValues.map(elementText).join("")
}

/** Builds a function-component double that preserves its children and props. */
export function passThroughElement(type) {
  return function PassThroughElement(props) {
    return createElement(type, props)
  }
}
