import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const hostRoomSourcePath = new URL("../app/anatomime/host-room-client.tsx", import.meta.url)
const joinPageSourcePath = new URL("../app/anatomime/join/page.tsx", import.meta.url)
const hostRoomSource = await readFile(hostRoomSourcePath, "utf8")
const joinPageSource = await readFile(joinPageSourcePath, "utf8")

describe("Anatomime host invite QR", () => {
  it("builds QR invites from the code-prefilled join URL", () => {
    assert.ok(
      hostRoomSource.includes("const joinPath = `/anatomime/join?code=${encodeURIComponent(session.code)}`"),
      "host invites should prefill the shared room code in the join URL",
    )
    assert.match(hostRoomSource, /import\("qrcode"\)/)
    assert.match(hostRoomSource, /QR code for Anatomime room/)
    assert.match(hostRoomSource, /Copy Join Link/)
  })

  it("passes join-page code search params into the shared-session client", () => {
    assert.match(joinPageSource, /searchParams/)
    assert.match(joinPageSource, /params\?\.code/)
    assert.match(joinPageSource, /initialCode=\{initialCode\}/)
  })
})
