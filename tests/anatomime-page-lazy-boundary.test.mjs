import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const pageSourcePath = new URL("../app/anatomime/page.tsx", import.meta.url)
const gameClientSourcePath = new URL("../app/anatomime/anatomime-game-client.tsx", import.meta.url)
const pageSource = await readFile(pageSourcePath, "utf8")
const gameClientSource = await readFile(gameClientSourcePath, "utf8")

function escapedPattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

describe("Anatomime page lazy boundary", () => {
  it("keeps sourced anatomy runtime modules out of the initial page shell", () => {
    for (const moduleName of [
      "@/lib/anatomy-study",
      "@/lib/anatomime-shared",
      "@/lib/anatomime-game",
      "./host-room-client",
      "./anatomime-game-client",
    ]) {
      assert.doesNotMatch(
        pageSource,
        new RegExp(`from\\s+["']${escapedPattern(moduleName)}["']`),
        `${moduleName} should not be statically imported by the initial Anatomime page shell`,
      )
    }
  })

  it("keeps the full game client behind dynamic imports", () => {
    assert.match(
      pageSource,
      /import\s*\(\s*["']\.\/anatomime-game-client["']\s*\)/,
      "the full Anatomime game client should be behind a dynamic import",
    )
    assert.match(
      pageSource,
      /ssr:\s*false/,
      "the lazy Anatomime game client should stay out of the server-rendered initial shell",
    )
    assert.match(
      pageSource,
      /initialPhase=["']selection["']/,
      "the lazy game client should enter the deck-selection phase after the lightweight setup action",
    )
  })

  it("keeps the sourced deck workspace in the lazy game client", () => {
    for (const moduleName of [
      "@/lib/anatomy-study",
      "@/lib/anatomime-shared",
      "@/lib/anatomime-game",
      "./host-room-client",
    ]) {
      assert.match(
        gameClientSource,
        new RegExp(`from\\s+["']${escapedPattern(moduleName)}["']`),
        `${moduleName} should remain available to the lazy game client`,
      )
    }
  })
})
