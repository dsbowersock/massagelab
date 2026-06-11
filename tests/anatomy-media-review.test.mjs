import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  anatomyMediaReviewKey,
  bodyParts3dAdminAssetSlug,
  bodyParts3dAdminStoragePath,
  bodyParts3dImageUrl,
  bodyParts3dView,
  normalizeAnatomyMediaRole,
  normalizeBodyParts3dPartIds,
  safeBodyParts3dImageUrl,
} from "../lib/anatomy-media-review.js"

describe("Anatomy media review helpers", () => {
  it("normalizes BodyParts3D part identifiers and generated view URLs", () => {
    const partIds = normalizeBodyParts3dPartIds("37670, FMA37671 fma37670 bad")
    const url = bodyParts3dImageUrl({ partIds, view: "posterior", treeName: "partof", size: 900 })
    const config = JSON.parse(decodeURIComponent(url.split("?")[1]))

    assert.deepEqual(partIds, ["FMA37670", "FMA37671"])
    assert.equal(url.startsWith("https://lifesciencedb.jp/bp3d/API/image?"), true)
    assert.equal(config.Common.TreeName, "partof")
    assert.equal(config.Camera.CameraMode, "back")
    assert.equal(config.Window.ImageWidth, 900)
    assert.equal(config.Part.some((part) => part.PartID === "FMA37670" && part.PartColor === "D83A3A"), true)
  })

  it("keeps review keys and form roles stable across casing", () => {
    assert.equal(bodyParts3dView("left-lateral").cameraMode, "left")
    assert.equal(normalizeAnatomyMediaRole("PRIMARY"), "primary")
    assert.equal(normalizeAnatomyMediaRole("not-a-role"), "reference")
    assert.equal(
      anatomyMediaReviewKey({
        assetSlug: " BodyParts3D-Biceps ",
        entityType: "MUSCLE",
        entitySlug: "Biceps-Brachii",
        role: "PRIMARY",
      }),
      "bodyparts3d-biceps|muscle|biceps-brachii|primary",
    )
  })

  it("only accepts safe BodyParts3D image API URLs for overrides", () => {
    const safeUrl = bodyParts3dImageUrl({ partIds: ["FMA37670"], view: "anterior", treeName: "isa" })

    assert.equal(safeBodyParts3dImageUrl(` ${safeUrl} `), safeUrl)
    assert.equal(safeBodyParts3dImageUrl("javascript:alert(1)"), "")
    assert.equal(safeBodyParts3dImageUrl("https://example.com/bp3d/API/image?test"), "")
    assert.equal(safeBodyParts3dImageUrl("https://lifesciencedb.jp/bp3d/API/image"), "")
  })

  it("keeps BodyParts3D admin asset identity stable by tree and canonical part ids", () => {
    const partofSlug = bodyParts3dAdminAssetSlug({
      entityType: "muscle",
      entitySlug: "biceps-brachii",
      treeName: "partof",
      viewSlug: "anterior",
      partIds: ["FMA37671", "37670"],
    })
    const reorderedPartofSlug = bodyParts3dAdminAssetSlug({
      entityType: "muscle",
      entitySlug: "biceps-brachii",
      treeName: "partof",
      viewSlug: "anterior",
      partIds: ["FMA37670", "FMA37671"],
    })
    const isaSlug = bodyParts3dAdminAssetSlug({
      entityType: "muscle",
      entitySlug: "biceps-brachii",
      treeName: "isa",
      viewSlug: "anterior",
      partIds: ["FMA37670", "FMA37671"],
    })

    assert.equal(partofSlug, reorderedPartofSlug)
    assert.notEqual(partofSlug, isaSlug)
    assert.match(partofSlug, /partof-anterior-fma37670-fma37671/)
    assert.equal(
      bodyParts3dAdminStoragePath({
        entityType: "muscle",
        entitySlug: "biceps-brachii",
        treeName: "partof",
        viewSlug: "anterior",
        assetSlug: partofSlug,
      }),
      `anatomy/bodyparts3d/admin/muscle/biceps-brachii/partof/anterior/${partofSlug}.png`,
    )
  })
})
