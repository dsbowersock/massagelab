import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

describe("Homepage FlipWords layout", () => {
  it("uses intrinsic invisible sizers without duplicating accessible phrase text", () => {
    const source = readFileSync(new URL("../components/home/flip-words.tsx", import.meta.url), "utf8")

    assert.match(source, /safeWords\.map/)
    assert.match(source, /aria-hidden="true"/)
    assert.match(source, /invisible[\s\S]*col-start-1[\s\S]*row-start-1[\s\S]*whitespace-nowrap/)
    assert.match(source, /data-testid="home-flip-word-slot"/)
    assert.match(source, /justify-self-center/)
    assert.doesNotMatch(source, /min-w-\[8\.5ch\]/)
  })

  it("waits for one positive font-backed heading box before measuring phrase transitions", () => {
    const source = readFileSync(new URL("browser/public-routes.spec.ts", import.meta.url), "utf8")
    const start = source.indexOf('test("homepage audience phrases reserve stable heading layout at 704px"')
    const end = source.indexOf('test("homepage widest audience phrase does not overflow at 390px"', start)
    assert.notEqual(start, -1)
    assert.notEqual(end, -1)
    const contract = source.slice(start, end)

    const fontsReady = contract.indexOf("document.fonts.ready")
    const headingVisible = contract.indexOf("await expect(heading).toBeVisible()")
    const positiveHeightPoll = contract.indexOf("expected a positive finite homepage heading height")
    const phraseLoop = contract.indexOf('for (const word of ["therapists"')
    const positiveBaseline = contract.indexOf('expect(baseline.headingHeight, "baseline heading height").toBeGreaterThan(0)')
    const comparisons = contract.indexOf("for (const metric of metrics)")

    for (const index of [fontsReady, headingVisible, positiveHeightPoll, phraseLoop, positiveBaseline, comparisons]) {
      assert.notEqual(index, -1)
    }
    assert.ok(fontsReady < headingVisible)
    assert.ok(headingVisible < positiveHeightPoll)
    assert.ok(positiveHeightPoll < phraseLoop)
    assert.ok(phraseLoop < positiveBaseline)
    assert.ok(positiveBaseline < comparisons)
    assert.doesNotMatch(contract, /waitForTimeout/)
  })
})
