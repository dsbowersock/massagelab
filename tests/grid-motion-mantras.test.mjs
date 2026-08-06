import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  DEFAULT_GRID_MOTION_MANTRAS,
  GRID_MOTION_MANTRA_CHARACTER_LIMIT,
  GRID_MOTION_MANTRA_LIMIT,
  GRID_MOTION_MANTRA_WORD_LIMIT,
  getGridMotionMantraAddSeed,
  normalizeGridMotionMantra,
  normalizeGridMotionMantras,
} from "../lib/grid-motion-mantras.js"

const EXACT_STARTERS = [
  "I am grounded",
  "I choose ease",
  "I can soften",
  "Breathe and release",
  "Rest is productive",
  "I trust myself",
  "I am enough",
  "Peace begins within",
  "My body knows",
  "I welcome calm",
]

describe("Grid Motion mantra domain", () => {
  it("publishes the approved immutable limits and exact wellness starters", () => {
    assert.equal(GRID_MOTION_MANTRA_LIMIT, 10)
    assert.equal(GRID_MOTION_MANTRA_WORD_LIMIT, 3)
    assert.equal(GRID_MOTION_MANTRA_CHARACTER_LIMIT, 28)
    assert.equal(Object.isFrozen(DEFAULT_GRID_MOTION_MANTRAS), true)
    assert.deepEqual(DEFAULT_GRID_MOTION_MANTRAS, EXACT_STARTERS)
  })

  it("collapses whitespace, retains three words, and rejects empty input", () => {
    assert.equal(normalizeGridMotionMantra("  I   choose   ease  now "), "I choose ease")
    assert.equal(normalizeGridMotionMantra("\n Breathe\tand   release \n"), "Breathe and release")
    assert.equal(normalizeGridMotionMantra("   \n\t "), "")
    assert.equal(normalizeGridMotionMantra(null), "")
    assert.equal(normalizeGridMotionMantra(123), "")
  })

  it("caps Unicode characters without splitting a surrogate pair", () => {
    const normalized = normalizeGridMotionMantra("123456789012345678901234567😀Z")

    assert.equal(Array.from(normalized).length, 28)
    assert.equal(normalized.endsWith("😀"), true)
    assert.equal(normalized.includes("\uFFFD"), false)
  })

  it("preserves order while removing case-insensitive duplicates and capping entries", () => {
    const input = [
      "I am enough",
      "i am enough",
      "Breathe and release",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
    ]

    assert.deepEqual(normalizeGridMotionMantras(input), [
      "I am enough",
      "Breathe and release",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
    ])
  })

  it("uses all ten starters for missing, non-array, or wholly invalid input", () => {
    assert.deepEqual(normalizeGridMotionMantras(undefined), EXACT_STARTERS)
    assert.deepEqual(normalizeGridMotionMantras("I am grounded"), EXACT_STARTERS)
    assert.deepEqual(normalizeGridMotionMantras(["", "   ", null]), EXACT_STARTERS)
  })

  it("returns defensive copies for the starters and a supplied fallback", () => {
    const startersCopy = normalizeGridMotionMantras(undefined)
    const fallback = ["Fallback phrase"]
    const fallbackCopy = normalizeGridMotionMantras([], fallback)

    startersCopy[0] = "Changed"
    fallbackCopy[0] = "Changed"

    assert.deepEqual(DEFAULT_GRID_MOTION_MANTRAS, EXACT_STARTERS)
    assert.deepEqual(fallback, ["Fallback phrase"])
  })

  it("chooses the first valid case-insensitive nonduplicate Add seed", () => {
    assert.equal(getGridMotionMantraAddSeed(["I am calm"]), "I am grounded")
    assert.equal(
      getGridMotionMantraAddSeed(["i AM calm", "I AM GROUNDED"]),
      "I choose ease",
    )

    const nineUsedCandidates = ["I AM CALM", ...EXACT_STARTERS.slice(0, 8)]
    const seed = getGridMotionMantraAddSeed(nineUsedCandidates)

    assert.equal(seed, "My body knows")
    assert.equal(normalizeGridMotionMantra(seed), seed)
    assert.equal(
      nineUsedCandidates.some((entry) => entry.toLowerCase() === seed.toLowerCase()),
      false,
    )
    assert.equal(getGridMotionMantraAddSeed(EXACT_STARTERS.slice(0, GRID_MOTION_MANTRA_LIMIT)), "")
  })
})
