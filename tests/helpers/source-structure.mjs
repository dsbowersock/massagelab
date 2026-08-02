import assert from "node:assert/strict"

/**
 * Scans comments and quoted text without changing source offsets. Callers
 * choose whether quoted text is masked or preserved; this focused scanner
 * intentionally does not parse regular-expression literals or JSX structure.
 * An unpaired apostrophe in JSX text keeps quote state until the next newline,
 * so a same-line trailing comment is not masked; full JSX parsing is out of scope.
 */
function scanSource(source, { maskQuotedText }) {
  const characters = source.split("")
  let state = "code"

  for (let index = 0; index < characters.length; index += 1) {
    const current = characters[index]
    const next = characters[index + 1]

    if (state === "code") {
      if (current === "/" && next === "/") {
        characters[index] = characters[index + 1] = " "
        state = "line-comment"
        index += 1
      } else if (current === "/" && next === "*") {
        characters[index] = characters[index + 1] = " "
        state = "block-comment"
        index += 1
      } else if (current === "\"" || current === "'" || current === "`") {
        if (maskQuotedText) characters[index] = " "
        state = current
      }
      continue
    }

    if (state === "line-comment") {
      if (current === "\n" || current === "\r") state = "code"
      else characters[index] = " "
      continue
    }

    if (state === "block-comment") {
      if (current === "*" && next === "/") {
        characters[index] = characters[index + 1] = " "
        state = "code"
        index += 1
      } else if (current !== "\n" && current !== "\r") {
        characters[index] = " "
      }
      continue
    }

    const isNewline = current === "\n" || current === "\r"
    if (maskQuotedText) characters[index] = isNewline ? current : " "
    if (isNewline && state !== "`") {
      state = "code"
      continue
    }
    if (current === "\\") {
      if (maskQuotedText && index + 1 < characters.length) characters[index + 1] = " "
      index += 1
    } else if (current === state) {
      state = "code"
    }
  }

  if (state === "line-comment") state = "code"
  assert.equal(state, "code", "source has balanced comments and quoted text")
  return characters.join("")
}

function maskNonCode(source) {
  return scanSource(source, { maskQuotedText: true })
}

/**
 * Masks JavaScript comments without masking quoted program text. Source-based
 * contract tests use this when string literals and JSX attributes are part of
 * the executable evidence but prose comments must not satisfy an assertion.
 */
export function maskSourceComments(source) {
  return scanSource(source, { maskQuotedText: false })
}

/** Extracts one interface without allowing assertions to match later declarations. */
export function extractInterfaceBody(source, name) {
  const code = maskNonCode(source)
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const declaration = new RegExp(`export interface ${escapedName}(?![$\\w])`).exec(code)
  assert.notEqual(declaration, null, `${name} is declared`)
  const declarationIndex = declaration.index

  const openingBraceIndex = code.indexOf("{", declarationIndex)
  assert.notEqual(openingBraceIndex, -1, `${name} has an interface body`)

  let depth = 0
  for (let index = openingBraceIndex; index < code.length; index += 1) {
    if (code[index] === "{") depth += 1
    if (code[index] !== "}") continue

    depth -= 1
    if (depth === 0) return source.slice(openingBraceIndex + 1, index)
  }

  assert.fail(`${name} has a balanced interface body`)
}
