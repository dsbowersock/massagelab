import assert from "node:assert/strict"

/** Extracts one interface without allowing assertions to match later declarations. */
export function extractInterfaceBody(source, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const declaration = new RegExp(`export interface ${escapedName}(?![$\\w])`).exec(source)
  assert.notEqual(declaration, null, `${name} is declared`)
  const declarationIndex = declaration.index

  const openingBraceIndex = source.indexOf("{", declarationIndex)
  assert.notEqual(openingBraceIndex, -1, `${name} has an interface body`)

  let depth = 0
  for (let index = openingBraceIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1
    if (source[index] !== "}") continue

    depth -= 1
    if (depth === 0) return source.slice(openingBraceIndex + 1, index)
  }

  assert.fail(`${name} has a balanced interface body`)
}
