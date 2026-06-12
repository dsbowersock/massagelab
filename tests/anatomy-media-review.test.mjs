import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  anatomyMediaReviewKey,
  bodyParts3dAdminAssetSlug,
  bodyParts3dAdminStoragePath,
  bodyParts3dComposerUrl,
  bodyParts3dImageUrl,
  bodyParts3dSourceDescriptor,
  bodyParts3dView,
  normalizeAnatomyMediaRole,
  normalizeBodyParts3dPartIds,
  safeBodyParts3dImageUrl,
  safeBodyParts3dRenderableImageUrl,
} from "../lib/anatomy-media-review.js"

describe("Anatomy media review helpers", () => {
  it("normalizes BodyParts3D part identifiers and generated view URLs", () => {
    const partIds = normalizeBodyParts3dPartIds("37670, FMA37671 fma37670 bad")
    const url = bodyParts3dImageUrl({ partIds, view: "posterior", treeName: "partof", size: 900 })
    const config = JSON.parse(decodeURIComponent(url.split("?")[1]))
    const superiorUrl = bodyParts3dImageUrl({ partIds: ["FMA37670"], view: "superior", treeName: "isa" })
    const superiorConfig = JSON.parse(decodeURIComponent(superiorUrl.split("?")[1]))

    assert.deepEqual(partIds, ["FMA37670", "FMA37671"])
    assert.equal(url.startsWith("https://lifesciencedb.jp/bp3d/API/image?"), true)
    assert.equal(config.Common.TreeName, "partof")
    assert.equal(config.Camera.CameraMode, "back")
    assert.equal(superiorConfig.Camera.CameraMode, "top")
    assert.equal(config.Window.ImageWidth, 900)
    assert.equal(config.Part.some((part) => part.PartID === "FMA37670" && part.PartColor === "D83A3A"), true)
  })

  it("keeps review keys and form roles stable across casing", () => {
    assert.equal(bodyParts3dView("left-lateral").cameraMode, "left")
    assert.equal(bodyParts3dView("inferior").cameraMode, "bottom")
    assert.equal(bodyParts3dView("transverse").cameraMode, "top")
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
    assert.equal(safeBodyParts3dRenderableImageUrl(` ${safeUrl} `), safeUrl)
    assert.equal(safeBodyParts3dImageUrl("javascript:alert(1)"), "")
    assert.equal(safeBodyParts3dImageUrl("https://example.com/bp3d/API/image?test"), "")
    assert.equal(safeBodyParts3dImageUrl("https://lifesciencedb.jp/bp3d/API/image"), "")
    assert.equal(safeBodyParts3dRenderableImageUrl("https://example.com/bp3d/?tp_ap=oid001%3DFMA37670"), "")
  })

  it("builds BodyParts3D composer URLs and converts pasted composer maps into image URLs", () => {
    const composerUrl = bodyParts3dComposerUrl({ partIds: ["FMA37451"], treeName: "isa", size: 700 })
    const composer = new URL(composerUrl)
    const mapConfig = composer.searchParams.get("tp_ap") ?? ""
    const convertedUrl = safeBodyParts3dRenderableImageUrl(composerUrl)
    const convertedConfig = JSON.parse(decodeURIComponent(convertedUrl.split("?")[1]))
    const descriptor = bodyParts3dSourceDescriptor(composerUrl)

    assert.equal(composer.origin, "https://lifesciencedb.jp")
    assert.equal(composer.pathname, "/bp3d/")
    assert.equal(composer.searchParams.get("lng"), "en")
    assert.match(mapConfig, /oid001=FMA37451/)
    assert.equal(convertedUrl.startsWith("https://lifesciencedb.jp/bp3d/API/image?"), true)
    assert.equal(convertedConfig.Common.TreeName, "isa")
    assert.equal(convertedConfig.Window.ImageWidth, 700)
    assert.equal(convertedConfig.Part.some((part) => part.PartID === "FMA37451" && part.PartColor === "D83A3A"), true)
    assert.deepEqual(descriptor?.partIds, ["FMA37451"])
    assert.equal(descriptor?.treeName, "isa")
    assert.equal(descriptor?.cameraMode, null)
    assert.equal(descriptor?.cameraParameters, null)
    assert.equal(descriptor?.sourceUrl, convertedUrl)
    assert.match(descriptor?.sourceKey ?? "", /^src-/)
  })

  it("parses BodyParts3D image source descriptors for import identity checks", () => {
    const url = bodyParts3dImageUrl({ partIds: ["FMA37670"], view: "posterior", treeName: "partof" })
    const descriptor = bodyParts3dSourceDescriptor(url)
    const customComposerUrl = new URL(bodyParts3dComposerUrl({ partIds: ["FMA37670"], treeName: "partof" }))
    const customMapConfig = new URLSearchParams(customComposerUrl.searchParams.get("tp_ap") ?? "")
    customMapConfig.set("cx", "1")
    customMapConfig.set("cy", "2")
    customMapConfig.set("cz", "3")
    customMapConfig.set("tx", "4")
    customMapConfig.set("ty", "5")
    customMapConfig.set("tz", "6")
    customComposerUrl.searchParams.set("tp_ap", customMapConfig.toString())
    const customDescriptor = bodyParts3dSourceDescriptor(customComposerUrl.toString())

    assert.deepEqual(descriptor?.partIds, ["FMA37670"])
    assert.equal(descriptor?.treeName, "partof")
    assert.equal(descriptor?.cameraMode, "back")
    assert.equal(descriptor?.cameraParameters, null)
    assert.deepEqual(customDescriptor?.partIds, ["FMA37670"])
    assert.equal(customDescriptor?.treeName, "partof")
    assert.equal(customDescriptor?.cameraMode, null)
    assert.deepEqual(customDescriptor?.cameraParameters, {
      CameraX: 1,
      CameraY: 2,
      CameraZ: 3,
      TargetX: 4,
      TargetY: 5,
      TargetZ: 6,
    })
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
    assert.match(
      bodyParts3dAdminAssetSlug({
        entityType: "muscle",
        entitySlug: "biceps-brachii",
        treeName: "partof",
        viewSlug: "anterior",
        partIds: ["FMA37670", "FMA37671"],
        sourceKey: "src-custom",
      }),
      /src-custom-anatomogram$/,
    )
  })
})
