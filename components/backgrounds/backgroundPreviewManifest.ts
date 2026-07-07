export type BackgroundPreviewVariantName = "landscape" | "square" | "vertical"

export type BackgroundPreviewVariant = {
  key: BackgroundPreviewVariantName
  previewMediaUrl: string
  previewMediaType: "video"
  width: number
  height: number
  durationMs: number
  fps: number
  bytes: number
  sha256: string
}

export type BackgroundPreviewManifestEntry = {
  previewMediaUrl: string
  previewMediaType: "image" | "video"
  previewVideoUrl?: string
  previewSquareVideoUrl?: string
  previewVerticalVideoUrl?: string
  variants?: Partial<Record<BackgroundPreviewVariantName, BackgroundPreviewVariant>>
}

const LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL = "/chimer/background-previews"
const HOSTED_CHIMER_PREVIEW_MEDIA_BASE_URL = "https://media.massagelab.app/chimer/background-previews"
const CHIMER_PREVIEW_MEDIA_BASE_URL = (process.env.NEXT_PUBLIC_CHIMER_PREVIEW_MEDIA_BASE_URL || (process.env.NODE_ENV === "production" ? HOSTED_CHIMER_PREVIEW_MEDIA_BASE_URL : LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL)).replace(/\/+$/, "")

function resolvePreviewMediaUrl(url: string) {
  const prefix = `${LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL}/`
  return url.startsWith(prefix) ? `${CHIMER_PREVIEW_MEDIA_BASE_URL}/${url.slice(prefix.length)}` : url
}

function resolvePreviewManifestVariants(variants: BackgroundPreviewManifestEntry["variants"]) {
  if (!variants) {
    return undefined
  }

  const resolved: Partial<Record<BackgroundPreviewVariantName, BackgroundPreviewVariant>> = {}
  for (const key of Object.keys(variants) as BackgroundPreviewVariantName[]) {
    const variant = variants[key]
    if (variant) {
      resolved[key] = {
        ...variant,
        previewMediaUrl: resolvePreviewMediaUrl(variant.previewMediaUrl),
      }
    }
  }

  return resolved
}

function resolvePreviewManifestEntry(entry: BackgroundPreviewManifestEntry): BackgroundPreviewManifestEntry {
  return {
    ...entry,
    previewMediaUrl: resolvePreviewMediaUrl(entry.previewMediaUrl),
    previewVideoUrl: entry.previewVideoUrl ? resolvePreviewMediaUrl(entry.previewVideoUrl) : undefined,
    previewSquareVideoUrl: entry.previewSquareVideoUrl ? resolvePreviewMediaUrl(entry.previewSquareVideoUrl) : undefined,
    previewVerticalVideoUrl: entry.previewVerticalVideoUrl ? resolvePreviewMediaUrl(entry.previewVerticalVideoUrl) : undefined,
    variants: resolvePreviewManifestVariants(entry.variants),
  }
}

const rawBackgroundPreviewManifest = {
  "massage-lab-3d-globe": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-3d-globe.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-3d-globe.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-3d-globe-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-3d-globe-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-3d-globe.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 6986,
        "sha256": "f2ca13b9bcafb88735096379e1891c188b728b8407700d568ba7342f58ac3cc0"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-3d-globe-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 11749,
        "sha256": "2bc242853101f9a5379f7700e94a445ab767e235c8ac9dc757be4b54bd136edc"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-3d-globe-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 7242,
        "sha256": "a65665b4be951e686e8e8fba7bd70eafe3c876f9991edec56cde14d191afc1e5"
      }
    }
  },
  "massage-lab-aerial-rays": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-aerial-rays.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-aerial-rays.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-aerial-rays-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-aerial-rays-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-aerial-rays.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3438,
        "sha256": "c0f00948f379baf36bda6fe52ba2d743a64e938173fd98c4bb40852a2b526e3c"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-aerial-rays-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4163,
        "sha256": "5cd083f8d48024263c04394a0c8401f0a709bff08ce8bf3705f10b357c02d751"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-aerial-rays-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3582,
        "sha256": "941db438cd627ef798a8e11b116d704fe1ed79b7a31548912133b0d595208fd8"
      }
    }
  },
  "massage-lab-astral-flow": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-astral-flow.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-astral-flow.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-astral-flow-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-astral-flow-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-astral-flow.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 87002,
        "sha256": "42bee859fc07acb24f5b552340128117239260326c8d60e1118a59cc650dd935"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-astral-flow-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 134440,
        "sha256": "ad050d982ecc1ce2dfbe4b93319db8d843a9e192524b5016797a28262e40a746"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-astral-flow-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 91090,
        "sha256": "e3ffbe02e38f7b475348ff43c7272e6f5b75b6b32a85e51bedb5d05126a48de2"
      }
    }
  },
  "massage-lab-aurora": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-aurora.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-aurora.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-aurora-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-aurora-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-aurora.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3650,
        "sha256": "c3f2532338e30772b24094aed92ca3e2ea32cf129930b2ca61e187fea843370c"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-aurora-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4283,
        "sha256": "6ecdb11ef3347c228896efbc3fbf37f23fd80adfbde13e08d9e2ec438ddfe5fe"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-aurora-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3627,
        "sha256": "aeac2ec1a6399761796fd1ab5fcd2037375d4df7d163599834ffad74ac05a131"
      }
    }
  },
  "massage-lab-aurora-bars": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-aurora-bars.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-aurora-bars.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-aurora-bars-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-aurora-bars-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-aurora-bars.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 7496,
        "sha256": "aabcf085fb93e40a699c341e69c9fa101d8ee2818f257b1ff617342e5e6a176e"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-aurora-bars-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 8886,
        "sha256": "61113baf58be109a111d153e1d0962e6028db9d64f654328f89e848b9fe30e5e"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-aurora-bars-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 7129,
        "sha256": "153acd5ebdc9bdb32d18465153aa0dfc4cb1f7e60e780f6ac617b97fcdfbc40a"
      }
    }
  },
  "massage-lab-background-beams": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-background-beams.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-background-beams.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-background-beams-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-background-beams-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-background-beams.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 2989,
        "sha256": "03a7a4958a1de6a950fd2c4f7562948c05983723a45a102946ffd69dc6d437b2"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-background-beams-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3915,
        "sha256": "b28bcbffe99c57989a15a38fd7eb40ae164b99b278252f91968b709de720d8d7"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-background-beams-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3439,
        "sha256": "02a8f16c62e6c21985a8383f23d6d3c90255ef7c3ff17b482b8373173e0e8a47"
      }
    }
  },
  "massage-lab-background-lines": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-background-lines.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-background-lines.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-background-lines-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-background-lines-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-background-lines.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 2918,
        "sha256": "03a42187ce9207989e21f536e3985c75346da07e6b971ac286807b7402ebe96c"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-background-lines-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4363,
        "sha256": "f12f3e6ec6fb621b1ec31fcbbc293754a1d3db1210b1f7e46c83cb94665bea20"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-background-lines-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3839,
        "sha256": "0d52c1524134197c564fc6c26ee908cb6d0afd20c00c61060d2a3dfe026d2017"
      }
    }
  },
  "massage-lab-balatro": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-balatro.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-balatro.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-balatro-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-balatro-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-balatro.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 9461,
        "sha256": "4febbb344f56526efc3f15eaa3bd8b0ac4d50a48727ee1197e3c1a9f87ee2992"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-balatro-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 79327,
        "sha256": "76b7f9088f6dcad31a6f5fd71c514c772940198f2fe06ed303a70dc13416e33d"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-balatro-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 10066,
        "sha256": "3861ebf81f95e7c6a389cb9358505bae7ad7c75c934c84b14be1fea5fb83bbbe"
      }
    }
  },
  "massage-lab-beams": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-beams.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-beams.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-beams-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-beams-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-beams.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4494,
        "sha256": "4857abefc5ca0198e130b555bc136a879e13029fd949f98f5052c6ec2138776b"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-beams-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 19759,
        "sha256": "d6d4611354195f1c06edf768014cfdf76b6c9c41ef26abf89ca15e24a39e28cf"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-beams-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3932,
        "sha256": "cd70c0cf5bdf62a265afee423f43b46f71b26b728db2d8bcff29eb383c032f1a"
      }
    }
  },
  "massage-lab-bubble": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-bubble.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-bubble.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-bubble-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-bubble-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-bubble.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4664,
        "sha256": "6ab81766fc17a125fdc471a54d0fcf87d4f130a0588fea4f39213f71370499f9"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-bubble-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 5709,
        "sha256": "d68835f9afe99bcddab9c8a32cf8df2f9e01a8672099d5645343e7a7feafa36c"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-bubble-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3727,
        "sha256": "aaa29cd2aa0924a0f65f920ab80a04e3ec221b2050c0301cbc7250f5215af1a1"
      }
    }
  },
  "massage-lab-chrome-flow": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-chrome-flow.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-chrome-flow.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-chrome-flow-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-chrome-flow-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-chrome-flow.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 41990,
        "sha256": "a7ec9716698a0c3a5090d8cb9f3ee39ce3e80d744753332d3a8f16efeb934d11"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-chrome-flow-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 53649,
        "sha256": "98f35a5d57528b3649d47e6b39e220dab5394df38eebdfc2d2c80bf20fb5ab92"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-chrome-flow-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 43547,
        "sha256": "c6204acb8d9400a7eee6dfb9afa50b01f83e011b136168eae8f8e77f05d70563"
      }
    }
  },
  "massage-lab-collision-beams": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-collision-beams.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-collision-beams.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-collision-beams-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-collision-beams-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-collision-beams.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3899,
        "sha256": "a2c2be97f38f247f1667c50777901caa7b65a15852db4416604cd8aae4c22f16"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-collision-beams-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4456,
        "sha256": "6cd84d74cd16a4cc0eae4c9ff289285b0f9e1f60f005109485eb4728ebf9f059"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-collision-beams-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3856,
        "sha256": "8223b64b63703f9235becb97363a0ccb5fe47a1bf11480c152c10eaa51ff6306"
      }
    }
  },
  "massage-lab-color-bends": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-color-bends.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-color-bends.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-color-bends-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-color-bends-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-color-bends.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 5016,
        "sha256": "12a0a315895bc18459fadedf86fa71e37dbd05a4d1a9e83aa41750d628e9d72b"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-color-bends-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 18366,
        "sha256": "966dd1b511c32cb480ac21cc0f0d6f9929e91b9288c1f2ec74b76b88ce21c9ad"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-color-bends-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 5879,
        "sha256": "8e90fb4fe59581eb1eb7dc9169a83ea516a8a8a7a802f8238da83eb1b21a394f"
      }
    }
  },
  "massage-lab-dark-veil": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-dark-veil.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-dark-veil.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-dark-veil-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-dark-veil-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-dark-veil.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3635,
        "sha256": "601c8d52bbefb3349eeda9f1a0ba09ac903283ba635fffd870d8f235094edff2"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-dark-veil-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4045,
        "sha256": "29ca95e9bc79fe856e6829671d9b293a0583698992ed8197f183a659ffdde721"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-dark-veil-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3736,
        "sha256": "29803af5f766e8ba22b80a86475100aedf58e8211cb5883e4318b97705cc30fb"
      }
    }
  },
  "massage-lab-deep-space-nebula": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-deep-space-nebula.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-deep-space-nebula.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-deep-space-nebula-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-deep-space-nebula-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-deep-space-nebula.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 20477,
        "sha256": "c0a9c6c82c170885dd796d43d15ef952a1e44dd5bb6bde3240d011e596501fe7"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-deep-space-nebula-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 29222,
        "sha256": "5974beb6137d35af82bfe4396eea9dd02e422c142c53b039c9dd9b0bd19f361f"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-deep-space-nebula-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 21681,
        "sha256": "4a580c0014c08b519af7e400601f7bed815d4eca8b55f20e164a1c06929fbe96"
      }
    }
  },
  "massage-lab-dither": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-dither.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-dither.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-dither-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-dither-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-dither.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 15664,
        "sha256": "6888f7af2845cf50f9c4b27f8b39d772291c2b43f2fb28b119a8940c79b1dcf9"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-dither-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 22527,
        "sha256": "685734d9a7d3a76c11312ef3105e4c525384477b8f38560b94b3d1d27e7e94b5"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-dither-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 12485,
        "sha256": "5d484b0482037a58813c19e47449dcf528e45e044f7827acd8cba4eff3da5ffd"
      }
    }
  },
  "massage-lab-dot-field": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-dot-field.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-dot-field.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-dot-field-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-dot-field-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-dot-field.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 6394,
        "sha256": "19f6994b875faa5a7ab2b992a22579647fcaf2c3621db01da0d23975b86ed3a3"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-dot-field-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 8567,
        "sha256": "9b4a2f237e98d598d02531cfbaecb6667ace60b92e078433f4650d9988041cb3"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-dot-field-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 6434,
        "sha256": "b83475616f822569249cf86136af0cd5a35c8d82292f25475de6f4504a801342"
      }
    }
  },
  "massage-lab-dot-grid": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-dot-grid.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-dot-grid.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-dot-grid-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-dot-grid-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-dot-grid.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 8518,
        "sha256": "a4703634161a9baa5bd0976a1ad2eb0a852cc3fcf009f8c37263de2c299b9b8a"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-dot-grid-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 11610,
        "sha256": "63c9b02ad6680d67c2214a38f5e4a8364085085bf63c6f3ff51f163e6ba01bbf"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-dot-grid-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 8464,
        "sha256": "bbbdb7091347923ee1e3b387701f6fbd9720dbcd2de29a45ec076e2d3db87941"
      }
    }
  },
  "massage-lab-dotted-glow": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-dotted-glow.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-dotted-glow.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-dotted-glow-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-dotted-glow-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-dotted-glow.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 12586,
        "sha256": "f794de88e479289b45afcc93104711837c67cffe53894a3b303b441450bbd1a7"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-dotted-glow-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 21183,
        "sha256": "416733df058551b483e59a3e801190c1fefc72cdeebcfa5bdfeee758f41f36f6"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-dotted-glow-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 12451,
        "sha256": "4574327889cedadc42965eae10b0bc6d339cd63ad67cfea07e2dd8594a177a84"
      }
    }
  },
  "massage-lab-electric-mist": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-electric-mist.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-electric-mist.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-electric-mist-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-electric-mist-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-electric-mist.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 131509,
        "sha256": "cefc6a0a11840219090b9761141a511dc621430e57362012045f231810d9ff5b"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-electric-mist-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 140589,
        "sha256": "9c44b96720c3597774791130e62851a2b89fc0242d0d31ba676624c74edd7dab"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-electric-mist-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 76391,
        "sha256": "8565e581d0e82145576cf69c007af491975b5399e879671381898af532f466f9"
      }
    }
  },
  "massage-lab-evil-eye": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-evil-eye.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-evil-eye.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-evil-eye-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-evil-eye-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-evil-eye.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 155667,
        "sha256": "09b6212612d28a01af71218735bc177df44f2b9a26af0206c551d4f45dbed5a3"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-evil-eye-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 276278,
        "sha256": "0c358226a7a4697ef8e2dd497e5c6002c230f778a061768f44a5f8b968cb2cd9"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-evil-eye-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 202450,
        "sha256": "37ebd37e4a931fed12ba6c627605bbece130af070c0985c8ce3a5c57202d4aa2"
      }
    }
  },
  "massage-lab-faulty-terminal": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-faulty-terminal.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-faulty-terminal.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-faulty-terminal-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-faulty-terminal-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-faulty-terminal.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 8644,
        "sha256": "d567fb95c0a27563421ddcde94dba18e7318482c13cc6a0a42463442d41ea810"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-faulty-terminal-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 26615,
        "sha256": "c7bd9396b75675b38e1e4cacf83fb2915093324c688039477556c1011749ad0f"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-faulty-terminal-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 8144,
        "sha256": "346eae209756e905613c902025c53e2377e68f414c1a8ea9492c09907ff1f91b"
      }
    }
  },
  "massage-lab-ferrofluid": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-ferrofluid.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-ferrofluid.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-ferrofluid-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-ferrofluid-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-ferrofluid.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 63466,
        "sha256": "2010b4c08243edac74479344b85afd67c40f027cb83c29bd88ed9d5d0d554b49"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-ferrofluid-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 49037,
        "sha256": "d3ebbda958efe0924f294179d64da4bc132e7a9661fa07b5616f20b21d3e74c1"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-ferrofluid-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 34287,
        "sha256": "4a8ca90d521e55c04574d6e11babb45b1d660517f50c6ce90e1549d96a779e81"
      }
    }
  },
  "massage-lab-floating-lines": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-floating-lines.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-floating-lines.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-floating-lines-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-floating-lines-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-floating-lines.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4111,
        "sha256": "8fa44abd56c15c0a4a5055ce16c1c557944b35eea128bf2471648d0062abac41"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-floating-lines-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 9112,
        "sha256": "2d6d971515000e52b0549dcd959bc05f7f601bb8227fb5c9e3cd2dacdf26f06d"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-floating-lines-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3670,
        "sha256": "18c512fa02312dcf03d8540d2256f211c04b4f76cc513f82ddb4171d9d4609bc"
      }
    }
  },
  "massage-lab-galaxy": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-galaxy.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-galaxy.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-galaxy-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-galaxy-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-galaxy.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3870,
        "sha256": "fcb8e8ad54b4e3c20ad4cc628d54404f8d90171999fb3bb1cd5366ae63495f15"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-galaxy-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 24014,
        "sha256": "8053dd4ff7a85bb7c3a9daa7920bbc1da5d0320247eac1018bced75ef9d800b3"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-galaxy-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3376,
        "sha256": "2f871e7bf4fd2e441e72a558cb0c71164ab42a2f69e1bd303dc27c2c77940c45"
      }
    }
  },
  "massage-lab-glowing-stars": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-glowing-stars.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-glowing-stars.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-glowing-stars-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-glowing-stars-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-glowing-stars.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 2831,
        "sha256": "3a335dda1b98c28fc21a4a6e1c239dd3f93bd50b02b2204742b76f72be751819"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-glowing-stars-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3337,
        "sha256": "dafc70a1566a53b70db6cadbd5ef9666f820901107b0aec89bf6d3b0a7c3d458"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-glowing-stars-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3006,
        "sha256": "1f1a7b257eedc390d0021260d69169b623b403f2a5807fcb2a33364875e9e066"
      }
    }
  },
  "massage-lab-gradient": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-gradient.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-gradient.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-gradient-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-gradient-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-gradient.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3731,
        "sha256": "09dd9e62ebb4bdacefb9cf17bdbe8f62f292c9d87cc6d10c3021b2955d6be18c"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-gradient-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4542,
        "sha256": "31c0a58694960f7e63a08caeb18805a05e81e1c21ea7fe373703bfd23abbb57e"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-gradient-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3760,
        "sha256": "4bd31aba79cf9f2302f370599bef83e71a89e0a3123631b04fcf182301046820"
      }
    }
  },
  "massage-lab-gradient-animation": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-gradient-animation.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-gradient-animation.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-gradient-animation-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-gradient-animation-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-gradient-animation.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3941,
        "sha256": "984fec248b9458433f2438a2bfde8027247dd89af593ec12bcdf5472d8487caa"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-gradient-animation-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 5458,
        "sha256": "8b5248aebc6f612c3e73fae577d2ed83be4eb77ce69f23b0aba055f3f266b5fc"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-gradient-animation-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4812,
        "sha256": "b0ea5092acd41a1901bd4d3b87a5bdece1a374b46c13ad70d57bcf55c20ab47f"
      }
    }
  },
  "massage-lab-gradient-blinds": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-gradient-blinds.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-gradient-blinds.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-gradient-blinds-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-gradient-blinds-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-gradient-blinds.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 7523,
        "sha256": "0a51113ba4ffe4c5dd872bf8d8890a412f7496aba2569ec8dfc95d71d2ceb223"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-gradient-blinds-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 30162,
        "sha256": "8ba50c3cd4320d1d44baa99b2f7eebbc19213165975c5f6eacd7882146df886b"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-gradient-blinds-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 7289,
        "sha256": "883e55d069d8206eff1b070afa14e4cecafa77022e594dcd755986951f86a2eb"
      }
    }
  },
  "massage-lab-grainient": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-grainient.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-grainient.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-grainient-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-grainient-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-grainient.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 8722,
        "sha256": "24769e598cee8e78e01b88119c14faa87810ba3e478400eb6741405d606a3c3a"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-grainient-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 16643,
        "sha256": "33be9e0a1ad25fcb466d1c513c59506bbd27fccdb137123eb9c9e7e22f0b6d54"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-grainient-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 8127,
        "sha256": "a73ef168a5249e13bf6ea450a7a77550f16f321f424df9b05d5b924c3454a1bd"
      }
    }
  },
  "massage-lab-grid-bloom": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-grid-bloom.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-grid-bloom.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-grid-bloom-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-grid-bloom-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-grid-bloom.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 29435,
        "sha256": "fa5e05a2f1133b32e30deb27e54a47ae246b48aad886f414b90d8c12e94c3880"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-grid-bloom-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 45124,
        "sha256": "fb38c38cfd3ac8eae9837167df411a1d9911145764973dcf399df0cb2df98e6a"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-grid-bloom-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 27152,
        "sha256": "6d656ba3122f5b83dbd4c327430786f28ca69a48242861160b3981031fb2ee97"
      }
    }
  },
  "massage-lab-grid-distortion": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-grid-distortion.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-grid-distortion.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-grid-distortion-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-grid-distortion-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-grid-distortion.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 6483,
        "sha256": "c914a07fbf1cdc28dc616ceb4f99ca31b84c2d9a3878e4f5f5410acae8269df5"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-grid-distortion-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3416,
        "sha256": "fa04ce5e4bb0ed99d393d8ee19524ca55695c6f26104e162b5e07f7372a7080a"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-grid-distortion-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 6618,
        "sha256": "38302873a57bc83b9a89347a05b52e950d7d65320d3fc8d74d0d0335f2146f8e"
      }
    }
  },
  "massage-lab-grid-motion": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-grid-motion.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-grid-motion.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-grid-motion-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-grid-motion-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-grid-motion.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 5685,
        "sha256": "6e9e923fac42d2a425fd60620f26facd764a1b15222df77d440fb427978cf752"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-grid-motion-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 7369,
        "sha256": "4f2e07a2e1f6bef79cc80346dcadeb155be6913f38474687dbc7e9b42eba5e1d"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-grid-motion-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 5212,
        "sha256": "eb742945563243cd8b9c9aa5424bcf3e4d6ed97de6eac463c648d51308b81607"
      }
    }
  },
  "massage-lab-grid-scan": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-grid-scan.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-grid-scan.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-grid-scan-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-grid-scan-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-grid-scan.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 20869,
        "sha256": "7b1eabc85e0bee64afd247ba4cf5de3965e7f9780c40e4bdae38ea0cc2a36b3b"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-grid-scan-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 29511,
        "sha256": "cd96519b561885202a1194fed9f41cac041bdfebb06beb3104b2750619a897e3"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-grid-scan-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 15070,
        "sha256": "214db9645b7beca086d356bb43bb988225ec1be4983c7b0a24f3d8b820684153"
      }
    }
  },
  "massage-lab-hex-grid": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-hex-grid.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-hex-grid.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-hex-grid-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-hex-grid-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-hex-grid.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 22994,
        "sha256": "833f88a2c189a44d7e0cbaa805399c57acf9285b466f08a7bfccfaeb23c65574"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-hex-grid-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 30503,
        "sha256": "0d3c74722b1d2034fe7cb4636e43bb07a62eeefb106bad57a948d85ce9b8cde6"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-hex-grid-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 23939,
        "sha256": "9287cc95b6fe4189994cd590a8cbb3a614dcf4ebf85d9291304bbd1f2099042c"
      }
    }
  },
  "massage-lab-hole": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-hole.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-hole.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-hole-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-hole-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-hole.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 16859,
        "sha256": "a1309151bb23f697bbac5a96fc38f5975b6e195a2c1597f0d0c2127423cfe61a"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-hole-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 27578,
        "sha256": "2acf40ed719b59e888d195b67539e2d52a4919e1b210466f4887019758f319f2"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-hole-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 20977,
        "sha256": "8b42c3840de6dacf3e2ea01bb60443bb5f1425ce819bbfdce2eb263833f0ec3f"
      }
    }
  },
  "massage-lab-iridescence": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-iridescence.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-iridescence.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-iridescence-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-iridescence-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-iridescence.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 25451,
        "sha256": "9d64a222d85ccf3aab94d9ae61650db3f5acd55d58b72aa57a277082d2f800e3"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-iridescence-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 26539,
        "sha256": "cf4c0b4fe377f3a73115e1376d291df023302efa1346691f2251528ca282c818"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-iridescence-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 25744,
        "sha256": "4bed5d47b261344726ae494bf63e8133cc8556f70c7878af7be6e539a112dfdf"
      }
    }
  },
  "massage-lab-lamp-effect": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-lamp-effect.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-lamp-effect.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-lamp-effect-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-lamp-effect-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-lamp-effect.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 2943,
        "sha256": "002f396d1a76c277dc3522b172b79e9fd723d288a466c7a74dcbd7e2447c5bfe"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-lamp-effect-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3569,
        "sha256": "551f5d42fae9ecb2a7aed471dc14e99b4a1afe1dfb549a678e33a1bc4e350093"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-lamp-effect-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3168,
        "sha256": "ad71b6fd9144cfa92d14123b93302ec8a22ab03163fa9a614e41a6358cdc19af"
      }
    }
  },
  "massage-lab-letter-glitch": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-letter-glitch.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-letter-glitch.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-letter-glitch-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-letter-glitch-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-letter-glitch.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 24280,
        "sha256": "8c121a5df2ffb25fafc896ff82e1785eac9e50eb03e05217c37c9e4c3d712bac"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-letter-glitch-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 203120,
        "sha256": "110e3634e13b6db339b939c869af4183acd1d2f4ec55b1e9b0eed16b91a98e9b"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-letter-glitch-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 24369,
        "sha256": "ae119b98555ed1bc986bae9ecf8914296ef43744699ec68d97f58d6779073553"
      }
    }
  },
  "massage-lab-light-pillar": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-light-pillar.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-light-pillar.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-light-pillar-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-light-pillar-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-light-pillar.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4635,
        "sha256": "dc82e9749f58cd1ce57ab0d9d8757680ea1d8c0272f039566227e4aefce880a4"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-light-pillar-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 5644,
        "sha256": "8410cdcd83fed11f497e567e54b9a9c8c23c2d5a818f62ae3ea7f2a2b8b8546d"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-light-pillar-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 5339,
        "sha256": "7ffaeef80f0206a54d43985ed2dfa54e4deb61d434f91302c164d8bb87d991eb"
      }
    }
  },
  "massage-lab-light-rays": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-light-rays.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-light-rays.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-light-rays-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-light-rays-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-light-rays.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4135,
        "sha256": "d9e1922e8e88c139d1dd506c5dded521758a00ab9bb9123dd88029356f46b3f7"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-light-rays-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4347,
        "sha256": "adf4aebdfc6631c1e6da2935ea7d43c80eec40292852309e9d6f161e35998683"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-light-rays-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3133,
        "sha256": "991858ff7d5213f52148173808f52016746421f83eda42f7cb3f57dbbb0096c0"
      }
    }
  },
  "massage-lab-light-speed": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-light-speed.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-light-speed.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-light-speed-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-light-speed-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-light-speed.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 6393,
        "sha256": "c3d922cf0b2bbec749dfa738cf3fa45003e57e525506e7ed5127ba97281dc707"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-light-speed-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 6904,
        "sha256": "2333e1170c6833529acd8ef3aebf3a1335d38f7a89b3ae954781afb4cbfabb62"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-light-speed-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 7177,
        "sha256": "5cc0e020aa9413bfc76a3c006b61d1c58297c0c53dc00de13db75e50ccf501f8"
      }
    }
  },
  "massage-lab-lightfall": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-lightfall.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-lightfall.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-lightfall-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-lightfall-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-lightfall.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 40807,
        "sha256": "f6ab13a1de07731c5b4a0f9e283a3043dbcd32118ee3e298188c62d6d64da181"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-lightfall-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 58066,
        "sha256": "92e577b8ce863f1b7661ea2a2dadde901414c1db71e2eaaf62faa0a2185f0722"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-lightfall-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 45468,
        "sha256": "06b4cbc8d7e4f83795c7e767b6325db1178445c123f11001a861ee148a203b19"
      }
    }
  },
  "massage-lab-lightning": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-lightning.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-lightning.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-lightning-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-lightning-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-lightning.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 2549,
        "sha256": "10bfc97c0b3dd75e145170654b2b2394ec1b0b3fdc1c7822488bb327045ae464"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-lightning-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 82741,
        "sha256": "bbed2edb3660eff9f11435c33724fe28c2a8e8dbf49c4b82508724d09bcc29af"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-lightning-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 2772,
        "sha256": "ef2ff43451cbccbca8bca70d40024dddb21b6bcad7cfa559ae2c2bf32fcac436"
      }
    }
  },
  "massage-lab-line-waves": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-line-waves.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-line-waves.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-line-waves-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-line-waves-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-line-waves.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 132296,
        "sha256": "c69f22a83d639fb38b757d7f387b97524d048c6cb4b6a50a751e2c70bc7eef39"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-line-waves-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 181716,
        "sha256": "8dd083e8b9801564d8ed869fb33d9751382e65a2d17f20fc25220bf28f5ed7cc"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-line-waves-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 126718,
        "sha256": "a901b4f4cf667326a82b83d51dcda9e2d10dc44027534396169d51d3732fedd3"
      }
    }
  },
  "massage-lab-liquid-chrome": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-liquid-chrome.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-liquid-chrome.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-liquid-chrome-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-liquid-chrome-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-liquid-chrome.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4568,
        "sha256": "4b0b9d3aab1c287b744646d67a2e3ac372e251d9a7a93ada84380b113fae439f"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-liquid-chrome-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 50358,
        "sha256": "217ea61ad0a84f3151f0509539e6f6b9338da1fb66aad2c37ebf68209d092647"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-liquid-chrome-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4692,
        "sha256": "5cec61775f080125f30ac249ba88f15c561c7ed19ee512de567b588d890adaa7"
      }
    }
  },
  "massage-lab-liquid-ether": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-liquid-ether.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-liquid-ether.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-liquid-ether-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-liquid-ether-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-liquid-ether.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 14916,
        "sha256": "978f7f30448e98a7d1c21442d7bc1748b0ae313359d51eb8f43aaf24843bfb24"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-liquid-ether-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 20322,
        "sha256": "4bc06df9ac01074edbd78f7de882d595851b304ad0fee6973c0f090fb14cc706"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-liquid-ether-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 15644,
        "sha256": "b00e67396c379133cc8834a2137a44e2842a8cf1b61ca582674fcc92a92e1219"
      }
    }
  },
  "massage-lab-matrix-rain": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-matrix-rain.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-matrix-rain.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-matrix-rain-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-matrix-rain-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-matrix-rain.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 87140,
        "sha256": "4b40bab329288694e0d80b456057130dcf21f5f43bb0b136b83ba0f9098434f9"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-matrix-rain-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 147632,
        "sha256": "99efa17481cfeedb44bb41ba72d72e229f06719273bde372d89d6f737cd9e45f"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-matrix-rain-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 73511,
        "sha256": "a461d1a885cc84fca068b4b331ebe2a41b48e56386556b8465445c67f00472ba"
      }
    }
  },
  "massage-lab-meteors": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-meteors.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-meteors.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-meteors-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-meteors-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-meteors.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3237,
        "sha256": "c265490ea0271021435214339808d066024f772b679981a77a298d06b236d6c1"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-meteors-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3970,
        "sha256": "6671ff1659ab6f29f51d97fda48cc9a026e26c4edbf733f34167fd27cf3f60a9"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-meteors-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 2848,
        "sha256": "d8c24b099bd2b6c958902b8f434b7e4772d892461a91a75be4bd980df977a283"
      }
    }
  },
  "massage-lab-moving-gradient": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-moving-gradient.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-moving-gradient.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-moving-gradient-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-moving-gradient-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-moving-gradient.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 2894,
        "sha256": "44a0c60a15d244ab65be972a7af3ce84103f442da550dde90a843d2837018d72"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-moving-gradient-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3106,
        "sha256": "7dec0ba9b27e8cf292f7e7fbce334c10c7802453fe660df8ea30009afe9977d7"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-moving-gradient-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 2955,
        "sha256": "3e22ec64bd308ca4bf07dc0e478b36ce3f01f095c70460dc53544af6c0290a19"
      }
    }
  },
  "massage-lab-novatrix": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-novatrix.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-novatrix.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-novatrix-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-novatrix-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-novatrix.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 25539,
        "sha256": "7cbbae35e6424db05111a2491c51fa6e0806714846c2b66bd5bd8b3df6997cf3"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-novatrix-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 26918,
        "sha256": "2013ae26217675b1e0f69a702f94a4b997c8af437229ed0be3402c7787356685"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-novatrix-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 26084,
        "sha256": "25d40692f64688ea92d31942995a06c930fb84d37d94787b4e2fd5b7aae9c850"
      }
    }
  },
  "massage-lab-orb": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-orb.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-orb.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-orb-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-orb-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-orb.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3468,
        "sha256": "964e88572ec468f8ac873519effb837c58a88f6aac24f60448a16be0daffeef9"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-orb-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 18577,
        "sha256": "795d66474ada04a74fcaf1cfb6709df03640a6f11a3b0866cad21b6be6833b88"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-orb-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3565,
        "sha256": "36ab54966e25c69d00244c507e65fe2472e9a74a63ddc65851b3e9682c726ef3"
      }
    }
  },
  "massage-lab-particles": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-particles.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-particles.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-particles-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-particles-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-particles.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 13775,
        "sha256": "ae99b8b7a77667e8f44347627afecb34b133fa5c28316f2402bd4075be9b743e"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-particles-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 16190,
        "sha256": "9e5268c27c1952188062b96f5f65cd53f3b495c7a1cdba3a3713fb4909272df3"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-particles-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 8472,
        "sha256": "d3d1222712abb3d56a838b59ba2e79b9b2f4d4df5a899dfb8cd6fee3bf972489"
      }
    }
  },
  "massage-lab-photon-beam": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-photon-beam.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-photon-beam.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-photon-beam-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-photon-beam-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-photon-beam.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 6432,
        "sha256": "1d971f50154c5dd3f65444f48a0a89b50699394efe9cf061a28c3137077be1b1"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-photon-beam-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 6295,
        "sha256": "67f8ac65328d28a68f2f849f69a0fdac782e2dce208652f1f585a407cf46312b"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-photon-beam-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4914,
        "sha256": "4bf8f12b815084d5d08f8ba2992f9801bbd2063ab00b9bee9a6dabbfc9421291"
      }
    }
  },
  "massage-lab-pixel-blast": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-pixel-blast.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-pixel-blast.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-pixel-blast-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-pixel-blast-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-pixel-blast.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 5852,
        "sha256": "f2e07a352812020c1007c199a3bc8ca019fdf99e2c0d63007f5759b1760299ae"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-pixel-blast-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 8925,
        "sha256": "0216feab5364c86bb241ab4f25118fd994b2854ef69da632b4ec054dd5088a7e"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-pixel-blast-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3971,
        "sha256": "6e0402f3c546ac1fbd2f7954c4bf434f6b606a99654c12c4e47827a77fdf9038"
      }
    }
  },
  "massage-lab-pixel-liquid": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-pixel-liquid.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-pixel-liquid.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-pixel-liquid-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-pixel-liquid-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-pixel-liquid.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 5284,
        "sha256": "68826420ebce165aef6b7d1fe75eb1d23caa9ed0dbf1d1f107b48fefb0b8ee55"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-pixel-liquid-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 6946,
        "sha256": "20aeeb5d2afe542680fb85baf346ecbbba8ed8300f27442c0f9502eeac1c240d"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-pixel-liquid-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 5139,
        "sha256": "23e0cac663e6e24c7048af3c84fcc091263c324acfb25b822a38ab5df40ae05f"
      }
    }
  },
  "massage-lab-pixel-snow": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-pixel-snow.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-pixel-snow.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-pixel-snow-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-pixel-snow-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-pixel-snow.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4741,
        "sha256": "59a8c1ece2635649edac41719951d0638aaf598e4c61e495f7e4e31bbd15e40a"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-pixel-snow-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 42767,
        "sha256": "c427f42ecf349c99dfdd86ae0a4e97ede14416910a193b4ae77637bccb1e7222"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-pixel-snow-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4821,
        "sha256": "a7e88bb212e98c4423dfc5a3024ba494198b2ad5a6f8eeb815d237a3aa09c118"
      }
    }
  },
  "massage-lab-plasma": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-plasma.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-plasma.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-plasma-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-plasma-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-plasma.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 9529,
        "sha256": "261168744ab0ca2bb2a7e2102c73bd0ebb568efa1bc676b48d43629d2c9437cc"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-plasma-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 12092,
        "sha256": "acb42f3361277f24f55068c99f4ae54c5c7dcec8177d9004103978f8d6a9ad3b"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-plasma-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 9490,
        "sha256": "7dcb81c89a86f74f2970c536ffeba538daedf5217c0416a9eb55ac2a969792ce"
      }
    }
  },
  "massage-lab-plasma-wave": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-plasma-wave.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-plasma-wave.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-plasma-wave-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-plasma-wave-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-plasma-wave.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 22180,
        "sha256": "ef4f1c7ea7a2c7d8b1521bb7d9ead5e1b0f512fe801c2f3626066605022b111b"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-plasma-wave-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 25092,
        "sha256": "7f5a3598303a18c6bb4a5b3016587a4d8ffe1fd0de69fbe39d490c22e524ea16"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-plasma-wave-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 17116,
        "sha256": "84830f262b718c63285fb60bbb84a3f6da11f8d09b9d3acafb4bc7d6addc5c8f"
      }
    }
  },
  "massage-lab-prism": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-prism.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-prism.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-prism-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-prism-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-prism.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 272263,
        "sha256": "769cfca423d134f9757abc344ca9b6917f517d3ab6135e9bdf8b6b9624d6ce5a"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-prism-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 789676,
        "sha256": "f1506c0ce0c47bafdde139f4d2bb8fcfba7fb73e8fdcf002a63672af8013da7e"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-prism-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 270733,
        "sha256": "bb941c9eb5a8b154a4a291b57a696e5555a83a48be483e3feedc836b7206590f"
      }
    }
  },
  "massage-lab-prismatic-burst": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-prismatic-burst.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-prismatic-burst.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-prismatic-burst-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-prismatic-burst-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-prismatic-burst.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 5499,
        "sha256": "44333b6c73baced5555aa279e59891e2a8f184683e97ffa35311cf52b3d4a237"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-prismatic-burst-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 36207,
        "sha256": "f8a7978f173e8ce38fa0e2fa53e0dbf7db1df651c0f3f9e77ffc11d40303542f"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-prismatic-burst-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 7397,
        "sha256": "4558645d74500b1025f1b19c4f0e8fd0bdc59b7cc77057f3a2aa3267353c67b7"
      }
    }
  },
  "massage-lab-radar": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-radar.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-radar.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-radar-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-radar-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-radar.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 17884,
        "sha256": "1cff946ce22a2962b030ee8538cb3a96fbf718e7c199f2314f5853b2c018f3aa"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-radar-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 33407,
        "sha256": "ed84041fb6b30520de5b99065a0fa7437670729e8b906a557e459089bba64160"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-radar-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 31939,
        "sha256": "93dbe881c3489b35b6f30551b3ca3ebc7359774b53424c2e3e72e9bd183c090e"
      }
    }
  },
  "massage-lab-retro-grid": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-retro-grid.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-retro-grid.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-retro-grid-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-retro-grid-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-retro-grid.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 10709,
        "sha256": "713d2e7138054e6e494a75dd798a3ed6e6a8af3392f6c33896d8d0f5329ad7f4"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-retro-grid-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 13477,
        "sha256": "ad72993d92875061b10bee86587f56f6892c11205131937d2650b29ebba9b72f"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-retro-grid-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 9446,
        "sha256": "1ea3ea74d5ea73eb6f5d83f63134f467c332ccd9f0491f3f15ae9e84f23a1d0e"
      }
    }
  },
  "massage-lab-reveal-dots": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-reveal-dots.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-reveal-dots.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-reveal-dots-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-reveal-dots-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-reveal-dots.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 23921,
        "sha256": "7f98971f793d6c9b12b034640d2a6dd090f66075c8566425a6aecee590a5bc72"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-reveal-dots-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 37732,
        "sha256": "ecc8580cffa298ea88758edb1e0769f3db83531465e661dead28d929d82cec92"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-reveal-dots-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 23940,
        "sha256": "042c640ff7dfed5b8fb7d3a55a6117e24b108399a19a6ee13a1732462cc0c464"
      }
    }
  },
  "massage-lab-ripple-grid": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-ripple-grid.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-ripple-grid.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-ripple-grid-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-ripple-grid-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-ripple-grid.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4529,
        "sha256": "356aaaee5be49797751c20c4ef19fd7b868b803821431b82bedbefbba340ee2f"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-ripple-grid-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 31249,
        "sha256": "6d433bae678ff0cdaf4da43876eedbd3ea1871a95d276f1162648b5d9e40e6bc"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-ripple-grid-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4842,
        "sha256": "450e99b234150cd33a98a721ef7415b8ddd6711976dd772c3a37c56736ec7d21"
      }
    }
  },
  "massage-lab-shape-grid": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-shape-grid.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-shape-grid.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-shape-grid-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-shape-grid-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-shape-grid.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 5714,
        "sha256": "0ca22e4fc9ee49040884badfda7689b0bb8c235ad26bc4a3ccaf93daae71e6fc"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-shape-grid-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 13571,
        "sha256": "642bb724d73a47464a0fd9def450a08b8b061334bce8994023ae1429af5ea28c"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-shape-grid-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 5873,
        "sha256": "6adea41c44d6d45ae626dcf265e85cac9684bddb92da8b5feffd107bb36b09f7"
      }
    }
  },
  "massage-lab-shooting-stars": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-shooting-stars.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-shooting-stars.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-shooting-stars-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-shooting-stars-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-shooting-stars.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 2626,
        "sha256": "0bd91bcaf21640005b3b234b0fab73605e7ff8026d558064908c555332f48571"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-shooting-stars-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 2831,
        "sha256": "53fc8e10fda276484283435e8041abd1818483581b862be46b253f32d2802632"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-shooting-stars-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 2559,
        "sha256": "e3b09f1ed0785e04123f2eb82e22bfcb247744dcfd83d7c21a3f3c67155e3cd0"
      }
    }
  },
  "massage-lab-side-rays": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-side-rays.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-side-rays.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-side-rays-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-side-rays-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-side-rays.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 2727,
        "sha256": "f36bd80bd1c1da8c322dbbe0a53c3b1e8349b2db549a6e3e06a28d90b713c0d7"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-side-rays-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4357,
        "sha256": "ad630a3a07c1c6c54f6eeeba8b59a9f4cafb145397b420c6c4abf0db8f493a5b"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-side-rays-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 2800,
        "sha256": "01475fc4b95176c9b4c07342b1dec17ab490c885192bc9e6dc3f7b7e11a7a135"
      }
    }
  },
  "massage-lab-silk": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-silk.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-silk.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-silk-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-silk-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-silk.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4074,
        "sha256": "a7a96a2f677eb714180183d1c4392c9c4442abb58fe844db4d3e96e0bf823780"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-silk-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 16526,
        "sha256": "86b1762a8dc78902ef5db0cd5c5904ea176ff75180f0a6c5d2e1d75c1aa4ee05"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-silk-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3979,
        "sha256": "fd33d49dbba81cee73089b38800c6531007d4fe4be01d7bec9d4fefc50c7631c"
      }
    }
  },
  "massage-lab-soft-aurora": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-soft-aurora.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-soft-aurora.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-soft-aurora-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-soft-aurora-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-soft-aurora.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 6623,
        "sha256": "357a7cf30080854ccc908c08da5471b1ae9c5922f45c9c68cd069efa006c6c29"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-soft-aurora-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 7244,
        "sha256": "66c2771e0ee12e705d84f8ddccfcdabd6594988585a76c1998b04ddcfa9e7dc3"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-soft-aurora-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 5544,
        "sha256": "a019335326dde9a0e2bb077f7337651e563cee4c3a430b8ea6455d64b0f27a19"
      }
    }
  },
  "massage-lab-sparkles": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-sparkles.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-sparkles.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-sparkles-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-sparkles-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-sparkles.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 33736,
        "sha256": "f4c4bd1b7dfc45098dd147a4b61e8a34896587dd2b4c16d4a6da7b046fae1856"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-sparkles-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 41160,
        "sha256": "64021503474bdd751eb92c9e6a2eea5d1efb04849043796255e84784860d2257"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-sparkles-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 31962,
        "sha256": "a7c7cce8c54d9c437f15eeb85fd2e03f62ecc36aec6dc40fb22b51ac65c5a31a"
      }
    }
  },
  "massage-lab-spotlight": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-spotlight.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-spotlight.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-spotlight-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-spotlight-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-spotlight.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3443,
        "sha256": "f270a6939a1aaa93392fb70e45815bdd9338772e824ce9326a7c1eb891eb4841"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-spotlight-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3704,
        "sha256": "483d9a0abddebd415692bdcb9295ea55389c4d26b5e5a3b101ce38e99232f36a"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-spotlight-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 3165,
        "sha256": "617210e005b876121ed413e3d7bcef1d6acf60a58be32ad1d9319eed79249f1c"
      }
    }
  },
  "massage-lab-stars": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-stars.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-stars.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-stars-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-stars-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-stars.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4158,
        "sha256": "3f2178252752e08238e6eee1ba89cc45e4ece98a4f1cabab170cc0921e8aa7b0"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-stars-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 5272,
        "sha256": "79068155ae0fe80d6dbe9007ec808b6c188008f0e7bfdf172be1b7b5e39aa01c"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-stars-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4190,
        "sha256": "5dc309576e6e40cae2251d6db7feb74cf42e09063e9ff7a5290441d0f7f73b48"
      }
    }
  },
  "massage-lab-synthesis": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-synthesis.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-synthesis.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-synthesis-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-synthesis-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-synthesis.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 9685,
        "sha256": "128938d2a5a2cd7ae915678a8e6e6585c809a1385aec886a555a5ab916061c29"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-synthesis-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 9262,
        "sha256": "159bc35889e624b1e89ff83abe5bb6b6e2f0be4712c2ff92e6398a29f2ee14f5"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-synthesis-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 8906,
        "sha256": "8adfb2acb00392bce637b1bebf6f385631bc7eac13072cf56629ffbc7c2dab10"
      }
    }
  },
  "massage-lab-threads": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-threads.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-threads.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-threads-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-threads-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-threads.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 12693,
        "sha256": "003f448808abc7012d28d7966e5e3e2814bb9a8ce4deb7c106d757e073e81f7e"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-threads-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 16591,
        "sha256": "b2f039f7cee62621585002356c068a218fd64daae6b6b11adb8433c422e3421a"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-threads-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 13131,
        "sha256": "5faf73c2945b2efc2d6f650570065a6aa979159ba40e4d6cdc3a700d9639619c"
      }
    }
  },
  "massage-lab-tile-grid": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-tile-grid.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-tile-grid.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-tile-grid-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-tile-grid-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-tile-grid.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 21561,
        "sha256": "5e08b8d587178bf957182b5f6583532b496f216e11b5b7350e47de607ee5c12c"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-tile-grid-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 26571,
        "sha256": "28e0495eb384d03d17a61d5c4f85e56d679c312e0d2178f3d0ba3b0c125b0271"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-tile-grid-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 19936,
        "sha256": "ec099b231fbe74b3a1e65269dfc7791e44acd7838b3927e59f79147d03844874"
      }
    }
  },
  "massage-lab-vortex": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-vortex.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-vortex.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-vortex-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-vortex-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-vortex.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 19765,
        "sha256": "14f552ad8bc05db0b2b506d7efa7f236febdca1a574407ad2d4edf6031790ddf"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-vortex-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 29237,
        "sha256": "22d623118961838808397aed0c27d2b9038be69eefc3478388a69585aa71ea64"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-vortex-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 19284,
        "sha256": "746663a993291bda5a80279ec274af56f6b65df74387307061a6b72539dd495f"
      }
    }
  },
  "massage-lab-wave-current": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-wave-current.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-wave-current.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-wave-current-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-wave-current-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-wave-current.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 6833,
        "sha256": "7a00ed995bd7c612b8066a56de2d05876a87a45ddf1b74f401b9c09bcc83d03e"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-wave-current-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 6286,
        "sha256": "7d395a1b3c5971d2d583c0cd06a0348560da3c4b5bbd00cd40e05797ff452e64"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-wave-current-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 4387,
        "sha256": "4dc8046bfb85b2943b0033882c6823f70b27fd83cc520ca7c0f7b921955a8d74"
      }
    }
  },
  "massage-lab-waves": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-waves.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-waves.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-waves-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-waves-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-waves.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 18839,
        "sha256": "4153d7aeae03461dd5cdc57b7fb5f183a5b8d6bee5b8b029d81815bb9cb23f13"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-waves-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 129003,
        "sha256": "a2500f116396838819bd8ca9b385cc93ce8fc70fa013b1a59ca306d5510fe8ec"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-waves-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 18706,
        "sha256": "30bc6e376da89f328918d2dde821569a01a71cbf56461c579c635c70436341b1"
      }
    }
  },
  "massage-lab-wavy-background": {
    "previewMediaUrl": "/chimer/background-previews/massage-lab-wavy-background.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/massage-lab-wavy-background.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/massage-lab-wavy-background-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/massage-lab-wavy-background-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-wavy-background.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 7983,
        "sha256": "db8da546fbfb3c6d00e6cbc1e8b462e306093e256718f390bf05731755cb56c4"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-wavy-background-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 9608,
        "sha256": "9f29195a0ed90de296d89d270b65a7bf16a958e3ab35c787364f9bb5cb228574"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/massage-lab-wavy-background-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 5998,
        "sha256": "0a573c97347780f1252ab4962a5c18d1ba670988e91da9c76a8907c07868960a"
      }
    }
  },
  "static-gradient": {
    "previewMediaUrl": "/chimer/background-previews/static-gradient.webm",
    "previewMediaType": "video",
    "previewVideoUrl": "/chimer/background-previews/static-gradient.webm",
    "previewSquareVideoUrl": "/chimer/background-previews/static-gradient-square.webm",
    "previewVerticalVideoUrl": "/chimer/background-previews/static-gradient-vertical.webm",
    "variants": {
      "landscape": {
        "key": "landscape",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/static-gradient.webm",
        "width": 384,
        "height": 216,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 2576,
        "sha256": "9e241df56a8fc7f3117aceb453b4da24dffa0980888cb4aa8f6000d0deaeb6d8"
      },
      "square": {
        "key": "square",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/static-gradient-square.webm",
        "width": 384,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 2851,
        "sha256": "7af8b3e68ee1f135575b9b2f2c16668e9cbb2a4fafbbcc6690c6e2cc917d26a5"
      },
      "vertical": {
        "key": "vertical",
        "previewMediaType": "video",
        "previewMediaUrl": "/chimer/background-previews/static-gradient-vertical.webm",
        "width": 216,
        "height": 384,
        "durationMs": 6000,
        "fps": 12,
        "bytes": 2549,
        "sha256": "dd3f6c8b59e0085a03dc50b1e1f0749267a359ec1081504b6e43b9d746c2d643"
      }
    }
  }
} satisfies Record<string, BackgroundPreviewManifestEntry>

export const backgroundPreviewManifest = Object.fromEntries(
  Object.entries(rawBackgroundPreviewManifest).map(([id, entry]) => [id, resolvePreviewManifestEntry(entry)]),
) as Record<string, BackgroundPreviewManifestEntry>
