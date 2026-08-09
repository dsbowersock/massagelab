import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

describe("Flashcard anatomy media reviewer flagging", () => {
  it("uses fresh reviewer authority for image flagging and posts to the anatomy media review endpoint", async () => {
    const pageSource = await readFile(new URL("../app/education/flashcards/page.tsx", import.meta.url), "utf8")
    const deckListSource = await readFile(new URL("../app/education/flashcards/decks/page.tsx", import.meta.url), "utf8")
    const deckDetailSource = await readFile(new URL("../app/education/flashcards/decks/[slug]/page.tsx", import.meta.url), "utf8")
    const clientSource = await readFile(new URL("../app/education/flashcards/flashcards-client.tsx", import.meta.url), "utf8")
    const runnerSource = await readFile(new URL("../app/education/flashcards/flashcard-runner.tsx", import.meta.url), "utf8")
    const routeSource = await readFile(new URL("../app/api/admin/anatomy/media-flags/route.ts", import.meta.url), "utf8")

    assert.match(pageSource, /loadAnatomyReviewerActor/)
    assert.match(pageSource, /sessionUserId: session\?\.user\?\.id \?\? null/)
    assert.match(pageSource, /canManageAnatomyContent=\{Boolean\(reviewActor\)\}/)
    for (const routeSource of [deckListSource, deckDetailSource]) {
      assert.match(routeSource, /loadAnatomyReviewerActor/)
      assert.match(routeSource, /sessionUserId: (?:session\?\.user\?\.id|viewerUserId) \?\? null/)
      assert.match(routeSource, /canManageAnatomyContent=\{Boolean\(reviewActor\)\}/)
      assert.doesNotMatch(routeSource, /session\?\.user\?\.capabilities\?\.canManageAnatomyContent/)
    }
    assert.match(runnerSource, /canManageAnatomyContent && currentPrompt\.front\.mode === "media"/)
    assert.match(clientSource, /\/api\/admin\/anatomy\/media-flags/)
    assert.match(runnerSource, /Bad match/)
    assert.match(runnerSource, /Bad view/)
    assert.match(clientSource, /mediaSlug: media\.id/)
    assert.match(clientSource, /setActiveDeck\(\(current\) => \{/)
    assert.match(clientSource, /setPromptSummaries\(\(current\) => current\.filter/)
    assert.match(clientSource, /setSelectedPromptIds\(\(current\) => current\.filter/)
    assert.match(routeSource, /loadAnatomyReviewerActor/)
    assert.doesNotMatch(routeSource, /userRole\.findMany|canManageAnatomyContent/)
    assert.match(routeSource, /reviewedById: actor\.id/)
    assert.match(routeSource, /status: 403/)
    assert.match(routeSource, /mediaSlug/)
    assert.match(routeSource, /reviewStatus: "REJECTED"/)
    assert.match(routeSource, /reviewReason: reviewReason/)
  })
})
