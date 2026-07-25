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
  const ancestors = new Set()

  function visit(value) {
    if (!value || typeof value !== "object") {
      return null
    }
    if (ancestors.has(value)) {
      return null
    }
    ancestors.add(value)

    try {
      if (Array.isArray(value)) {
        for (const child of value) {
          const match = visit(child)
          if (match) {
            return match
          }
        }
        return null
      }

      if (isJsxLikeNode(value) && predicate(value)) {
        return value
      }

      const nestedValues = isJsxLikeNode(value)
        ? Object.values(value.props ?? {})
        : Object.values(value)
      for (const nestedValue of nestedValues) {
        const match = visit(nestedValue)
        if (match) {
          return match
        }
      }
      return null
    } finally {
      ancestors.delete(value)
    }
  }

  return visit(tree)
}

/** Collects every matching JSX-like object across every prop value. */
export function findElements(tree, predicate) {
  const matches = []
  const ancestors = new Set()

  function visit(value) {
    if (!value || typeof value !== "object" || ancestors.has(value)) {
      return
    }
    ancestors.add(value)

    try {
      if (Array.isArray(value)) {
        for (const child of value) {
          visit(child)
        }
        return
      }

      if (isJsxLikeNode(value) && predicate(value)) {
        matches.push(value)
      }
      const nestedValues = isJsxLikeNode(value)
        ? Object.values(value.props ?? {})
        : Object.values(value)
      for (const nestedValue of nestedValues) {
        visit(nestedValue)
      }
    } finally {
      ancestors.delete(value)
    }
  }

  visit(tree)
  return matches
}

/** Recursively evaluates function-component nodes across every prop value. */
export function renderFunctionComponents(tree) {
  const ancestors = new Set()

  function render(value) {
    if (Array.isArray(value)) {
      if (ancestors.has(value)) {
        return value
      }
      ancestors.add(value)
      try {
        return value.map(render)
      } finally {
        ancestors.delete(value)
      }
    }
    if (!value || typeof value !== "object") {
      return value ?? null
    }
    if (!isJsxLikeNode(value)) {
      return value
    }
    if (ancestors.has(value)) {
      return value
    }
    ancestors.add(value)

    try {
      if (typeof value.type === "function") {
        const rendered = value.type(value.props)
        if (
          rendered
          && (typeof rendered === "object" || typeof rendered === "function")
          && typeof rendered.then === "function"
        ) {
          throw new TypeError(
            "renderFunctionComponents received an async function-component result; await it before rendering.",
          )
        }
        return render(rendered)
      }

      const renderedProps = Object.fromEntries(
        Object.entries(value.props ?? {}).map(([name, propValue]) => [
          name,
          render(propValue),
        ]),
      )
      return {
        ...value,
        props: renderedProps,
      }
    } finally {
      ancestors.delete(value)
    }
  }

  return render(tree)
}

/**
 * Flattens readable text from children and explicit text-bearing props without
 * leaking implementation props such as class names, URLs, or event handlers.
 */
export function elementText(tree) {
  const ancestors = new Set()

  function read(value) {
    if (Array.isArray(value)) {
      if (ancestors.has(value)) {
        return ""
      }
      ancestors.add(value)
      try {
        return value.map(read).join("")
      } finally {
        ancestors.delete(value)
      }
    }
    if (typeof value === "string" || typeof value === "number") {
      return String(value)
    }
    if (!value || typeof value !== "object" || ancestors.has(value)) {
      return ""
    }
    ancestors.add(value)

    try {
      const props = value.props ?? {}
      const textValues = [
        props.children,
        props.title,
        props["aria-label"],
        props.label,
        props.placeholder,
        props.content,
      ]
      const hasExplicitText = textValues.some((textValue) => textValue != null)

      if (
        !hasExplicitText
        && value.type !== "input"
        && value.type !== "textarea"
        && (typeof props.value === "string" || typeof props.value === "number")
      ) {
        textValues.push(props.value)
      }

      return textValues.map(read).join("")
    } finally {
      ancestors.delete(value)
    }
  }

  return read(tree)
}

/** Builds a function-component double that preserves its children and props. */
export function passThroughElement(type) {
  return function PassThroughElement(props) {
    return createElement(type, props)
  }
}
