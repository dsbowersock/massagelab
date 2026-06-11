import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

describe("Flashcard anatomy media admin flagging", () => {
  it("keeps image flagging admin-only and posts to the anatomy media review endpoint", async () => {
    const pageSource = await readFile(new URL("../app/education/flashcards/page.tsx", import.meta.url), "utf8")
    const clientSource = await readFile(new URL("../app/education/flashcards/flashcards-client.tsx", import.meta.url), "utf8")
    const routeSource = await readFile(new URL("../app/api/admin/anatomy/media-flags/route.ts", import.meta.url), "utf8")

    assert.match(pageSource, /canManageAnatomyContent/)
    assert.match(clientSource, /canManageAnatomyContent && currentPrompt\.front\.mode === "media"/)
    assert.match(clientSource, /\/api\/admin\/anatomy\/media-flags/)
    assert.match(clientSource, /Bad match/)
    assert.match(clientSource, /Bad view/)
    assert.match(clientSource, /setActiveDeck\(\(current\) => \{/)
    assert.match(routeSource, /canManageAnatomyContent/)
    assert.match(routeSource, /reviewStatus: "REJECTED"/)
    assert.match(routeSource, /reviewReason: reviewReason/)
  })
})
