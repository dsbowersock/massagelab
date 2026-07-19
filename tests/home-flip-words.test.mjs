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
})
