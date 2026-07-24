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

  if (predicate(tree)) {
    return tree
  }

  for (const value of Object.values(tree.props ?? {})) {
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

  if (predicate(tree)) {
    matches.push(tree)
  }
  for (const value of Object.values(tree.props ?? {})) {
    findElements(value, predicate, matches)
  }
  return matches
}

/** Recursively evaluates function-component nodes in the test JSX tree. */
export function renderFunctionComponents(tree) {
  if (Array.isArray(tree)) {
    return tree.map(renderFunctionComponents)
  }
  if (!tree || typeof tree !== "object") {
    return tree ?? null
  }
  if (typeof tree.type === "function") {
    return renderFunctionComponents(tree.type(tree.props))
  }

  return {
    ...tree,
    props: {
      ...tree.props,
      children: renderFunctionComponents(tree.props?.children),
    },
  }
}

/** Flattens the readable text content from a JSX-like test tree. */
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
  return elementText(tree.props?.children)
}

/** Builds a function-component double that preserves its children and props. */
export function passThroughElement(type) {
  return function PassThroughElement(props) {
    return createElement(type, props)
  }
}
