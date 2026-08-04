import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const source = await readFile(
  new URL("../components/backgrounds/effects/massage-lab-gradient-blinds-background.tsx", import.meta.url),
  "utf8",
)

test("Gradient Blinds animates its gradient and blind phase", () => {
  assert.match(source, /const float GRADIENT_DRIFT_RATE = 0\.11;/)
  assert.match(source, /const float BLIND_DRIFT_RATE = 0\.18;/)
  assert.match(source, /sin\(iTime \* GRADIENT_DRIFT_RATE\) \* 0\.12/)
  assert.match(source, /uvMod\.x \+ iTime \* BLIND_DRIFT_RATE/)
})
