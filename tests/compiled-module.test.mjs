import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  compileCommonJsModule,
  createCompiledModuleLoader,
  createElement,
  elementText,
  findElement,
  findElements,
  renderFunctionComponents,
} from "./helpers/compiled-module.mjs"

describe("compiled-module JSX traversal helpers", () => {
  it("removes an mjs shebang and transpiles the module as TypeScript", () => {
    const compiled = compileCommonJsModule(
      "#!/usr/bin/env node\nexport const answer = <number>42",
      "virtual-module.mjs",
    )
    const compiledModule = { exports: {} }
    const executeModule = new Function("require", "exports", "module", compiled)

    executeModule(() => {
      throw new Error("The shebang export fixture must not require dependencies")
    }, compiledModule.exports, compiledModule)

    assert.doesNotMatch(compiled, /^#!/)
    assert.equal(compiledModule.exports.answer, 42)
  })

  it("preserves TSX parsing for tsx fixtures", () => {
    const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
    const loaded = loadCompiledModule(
      'export const result = <span data-marker="tsx">Rendered</span>',
      "virtual-loader-module.tsx",
      {
        "react/jsx-runtime": { jsx: createElement },
      },
    )

    assert.equal(loaded.result.type, "span")
    assert.equal(loaded.result.props["data-marker"], "tsx")
    assert.equal(loaded.result.props.children, "Rendered")
  })

  it("loads explicit dependency doubles before attempting a real require", () => {
    const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
    const loaded = loadCompiledModule(
      'import { marker } from "virtual-only-dependency"\nexport const result = marker',
      "virtual-loader-module.ts",
      {
        "virtual-only-dependency": { marker: "dependency-double" },
      },
    )

    assert.equal(loaded.result, "dependency-double")
  })

  it("loads a resolved fallback dependency from the calling test", () => {
    const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
    const loaded = loadCompiledModule(
      'import { basename } from "node:path"\nexport const result = basename("/tmp/example.txt")',
      "virtual-loader-module.ts",
    )

    assert.equal(loaded.result, "example.txt")
  })

  it("contextualizes only an unresolved requested dependency", () => {
    const loadCompiledModule = createCompiledModuleLoader(import.meta.url)

    assert.throws(
      () => loadCompiledModule(
        'import "compiled-module-direct-missing-specifier"',
        "virtual-loader-module.ts",
      ),
      (error) => {
        assert.equal(error.code, "MODULE_NOT_FOUND")
        assert.match(error.message, /compiled-module-direct-missing-specifier/)
        assert.match(error.message, /dependency double/)
        assert.equal(error.cause?.code, "MODULE_NOT_FOUND")
        return true
      },
    )
  })

  it("preserves native errors thrown while loading a resolved dependency", () => {
    const loadCompiledModule = createCompiledModuleLoader(import.meta.url)

    assert.throws(
      () => loadCompiledModule(
        'import "./fixtures/compiled-module-transitive-missing.cjs"',
        "virtual-loader-module.ts",
      ),
      (error) => {
        assert.equal(error.code, "MODULE_NOT_FOUND")
        assert.match(error.message, /compiled-module-missing-transitive-dependency/)
        assert.doesNotMatch(error.message, /dependency double/)
        return true
      },
    )
  })

  it("finds the first match across ordered prop values, arrays, and null entries", () => {
    const first = createElement("span", { marker: "first" })
    const second = createElement("span", { marker: "second" })
    const tree = createElement("section", {
      leading: [null, first],
      children: [second],
    })

    assert.equal(
      findElement(tree, (element) => element.props?.marker != null),
      first,
    )
    assert.equal(findElement(null, () => true), null)
  })

  it("collects matches from every prop value while preserving traversal order", () => {
    const leading = createElement("span", { marker: "leading" })
    const child = createElement("span", { marker: "child" })
    const trailing = createElement("span", { marker: "trailing" })
    const tree = createElement("section", {
      leading: [null, leading],
      children: [child, null],
      trailing,
    })

    assert.deepEqual(
      findElements(tree, (element) => element.props?.marker != null)
        .map((element) => element.props.marker),
      ["leading", "child", "trailing"],
    )
    assert.deepEqual(findElements(null, () => true), [])
  })

  it("calls the first-match predicate only for JSX-like nodes while traversing object props", () => {
    const target = createElement("span", { marker: "target" })
    const tree = createElement("section", {
      leading: {
        marker: "plain-object",
        nested: {
          deeper: target,
        },
      },
    })
    const visited = []

    const match = findElement(tree, (element) => {
      assert.equal(Object.hasOwn(element, "type"), true)
      assert.equal(Object.hasOwn(element, "props"), true)
      visited.push(element.type)
      return element.props.marker === "target"
    })

    assert.equal(match, target)
    assert.deepEqual(visited, ["section", "span"])
  })

  it("collects JSX matches without passing style or data objects to the predicate", () => {
    const child = createElement("span", { marker: "child" })
    const nested = createElement("span", { marker: "nested" })
    const tree = createElement("section", {
      style: { color: "orange" },
      data: {
        analytics: "plain-object",
        payload: { nested },
      },
      children: child,
    })
    const visited = []

    const matches = findElements(tree, (element) => {
      assert.equal(Object.hasOwn(element, "type"), true)
      assert.equal(Object.hasOwn(element, "props"), true)
      visited.push(element.type)
      return element.props.marker != null
    })

    assert.deepEqual(matches, [nested, child])
    assert.deepEqual(visited, ["section", "span", "span"])
  })

  it("terminates cyclic JSX trees without changing repeated-reference traversal", () => {
    const target = createElement("span", {
      marker: "target",
      children: "Target",
    })
    const cyclicTree = createElement("section", {})
    cyclicTree.props.children = [target, cyclicTree]
    const repeatedTree = createElement("section", {
      children: [target, target],
    })

    assert.equal(
      findElement(cyclicTree, (element) => element.props?.marker === "target"),
      target,
    )
    assert.deepEqual(
      findElements(cyclicTree, (element) => element.props?.marker === "target"),
      [target],
    )
    assert.deepEqual(
      findElements(repeatedTree, (element) => element.props?.marker === "target"),
      [target, target],
    )
    assert.equal(elementText(cyclicTree), "Target")
    assert.equal(elementText(repeatedTree), "TargetTarget")

    const rendered = renderFunctionComponents(cyclicTree)
    assert.equal(rendered.props.children[0].type, "span")
    assert.equal(rendered.props.children[0].props.marker, "target")
    assert.equal(rendered.props.children[1], cyclicTree)
  })

  it("renders function components in every prop while preserving primitive props", () => {
    const onClick = () => {}
    const style = { color: "orange" }
    const Marker = ({ marker }) => createElement("span", { marker })
    const tree = createElement("section", {
      icon: createElement(Marker, { marker: "icon" }),
      children: [createElement(Marker, { marker: "child" }), null],
      onClick,
      optional: null,
      style,
    })

    const rendered = renderFunctionComponents(tree)

    assert.equal(rendered.props.icon.type, "span")
    assert.equal(rendered.props.icon.props.marker, "icon")
    assert.equal(rendered.props.children[0].type, "span")
    assert.equal(rendered.props.children[0].props.marker, "child")
    assert.equal(rendered.props.children[1], null)
    assert.equal(rendered.props.onClick, onClick)
    assert.equal(rendered.props.optional, null)
    assert.equal(rendered.props.style, style)
  })

  it("fails clearly when a function component returns an unawaited thenable", () => {
    const AsyncComponent = () => ({
      then() {},
    })

    assert.throws(
      () => renderFunctionComponents(createElement(AsyncComponent, {})),
      {
        name: "TypeError",
        message: "renderFunctionComponents received an async function-component result; await it before rendering.",
      },
    )
  })

  it("reads only explicit text-bearing props", () => {
    const tree = createElement("div", {
      children: "Child",
      title: "Title",
      "aria-label": "Accessible",
      label: "Label",
      placeholder: "Placeholder",
      content: "Content",
      className: "do-not-read",
      href: "/do-not-read",
      "data-secret": "do-not-read",
    })

    assert.equal(
      elementText(tree),
      "ChildTitleAccessibleLabelPlaceholderContent",
    )
  })

  it("uses a scalar value only when it is the node's sole readable text", () => {
    assert.equal(elementText(createElement("option", { value: "Supporter" })), "Supporter")
    assert.equal(
      elementText(createElement("option", {
        children: "Visible choice",
        value: "internal-choice-id",
      })),
      "Visible choice",
    )
    assert.equal(
      elementText(createElement("input", {
        type: "hidden",
        value: "sensitive-internal-value",
      })),
      "",
    )
  })
})
