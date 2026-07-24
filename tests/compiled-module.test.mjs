import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  createElement,
  findElement,
  findElements,
} from "./helpers/compiled-module.mjs"

describe("compiled-module JSX traversal helpers", () => {
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
})
