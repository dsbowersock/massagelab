import assert from "node:assert/strict"

/**
 * Scans comments and quoted text without changing source offsets. Callers
 * choose whether quoted text is masked or preserved; this focused scanner
 * intentionally does not parse regular-expression literals or JSX structure.
 * An unpaired apostrophe in JSX text keeps quote state until the next newline,
 * so a same-line trailing comment is not masked; full JSX parsing is out of scope.
 * Template literals are treated as one flat backtick-quoted region; interpolation
 * is not parsed, so nested backticks, quotes, or comments can affect scanning.
 */
function scanSource(source, { maskQuotedText, label = "source" }) {
  const characters = source.split("")
  let state = "code"
  let stateStartIndex = 0

  for (let index = 0; index < characters.length; index += 1) {
    const current = characters[index]
    const next = characters[index + 1]

    if (state === "code") {
      if (current === "/" && next === "/") {
        characters[index] = characters[index + 1] = " "
        stateStartIndex = index
        state = "line-comment"
        index += 1
      } else if (current === "/" && next === "*") {
        characters[index] = characters[index + 1] = " "
        stateStartIndex = index
        state = "block-comment"
        index += 1
      } else if (current === "\"" || current === "'" || current === "`") {
        if (maskQuotedText) characters[index] = " "
        stateStartIndex = index
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
  assert.equal(
    state,
    "code",
    `${label} has an unterminated ${state} starting at offset ${stateStartIndex}`,
  )
  return characters.join("")
}

function maskNonCode(source, label) {
  return scanSource(source, { maskQuotedText: true, label })
}

/**
 * Masks JavaScript comments without masking quoted program text. Source-based
 * contract tests use this when string literals and JSX attributes are part of
 * the executable evidence but prose comments must not satisfy an assertion.
 */
export function maskSourceComments(source, label = "source") {
  return scanSource(source, { maskQuotedText: false, label })
}

/** Masks CSS block comments while preserving strings and `//` URL segments. */
export function maskCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => (
    comment.replace(/[^\r\n]/g, " ")
  ))
}

/**
 * Extracts one exported interface body without matching later declarations.
 * Non-exported interfaces are intentionally reported as undeclared.
 */
export function extractInterfaceBody(source, name, label = `${name} interface source`) {
  const code = maskNonCode(source, label)
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const declaration = new RegExp(`export interface ${escapedName}(?![$\\w])`).exec(code)
  assert.notEqual(declaration, null, `${name} is declared`)
  const declarationEndIndex = declaration.index + declaration[0].length

  let angleDepth = 0
  let parenthesisDepth = 0
  let bracketDepth = 0
  let openingBraceIndex = -1
  for (let index = declarationEndIndex; index < code.length; index += 1) {
    const character = code[index]
    if (character === "<") angleDepth += 1
    else if (character === ">") angleDepth = Math.max(0, angleDepth - 1)
    else if (character === "(") parenthesisDepth += 1
    else if (character === ")") parenthesisDepth = Math.max(0, parenthesisDepth - 1)
    else if (character === "[") bracketDepth += 1
    else if (character === "]") bracketDepth = Math.max(0, bracketDepth - 1)
    else if (character === "{" && angleDepth === 0 && parenthesisDepth === 0 && bracketDepth === 0) {
      openingBraceIndex = index
      break
    }
  }
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
