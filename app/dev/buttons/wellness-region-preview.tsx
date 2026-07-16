"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { SegmentedToggleGroup } from "@/components/ui/segmented-toggle-group"
import { cn } from "@/lib/utils"

type BodyView = "front" | "back"
type BodyPerspective = "direct" | "lateral"

interface BodyRegion {
  id: string
  label: string
  path: string
}

interface BodyReferencePlacement {
  width: number
  height: number
  x: number
  y: number
}

const bodyViewOptions = [
  { value: "front", label: "Anterior" },
  { value: "back", label: "Posterior" },
] as const

const bodyPerspectiveOptions = [
  { value: "direct", label: "Direct" },
  { value: "lateral", label: "Lateral" },
] as const

// These derivatives only crop the source viewBox so each anatomical orientation renders independently.
const bodyPerspectiveAssets = {
  direct: {
    src: {
      front: "/wellness/anatomy/anterior.svg",
      back: "/wellness/anatomy/posterior.svg",
    },
    placement: {
      front: { width: 212, height: 520, x: 24, y: 0 },
      back: { width: 212, height: 520, x: 24, y: 0 },
    },
  },
  lateral: {
    src: {
      front: "/wellness/anatomy/anterior-lateral.svg",
      back: "/wellness/anatomy/posterior-lateral.svg",
    },
    placement: {
      front: { width: 156, height: 542, x: 64, y: -4 },
      back: { width: 156, height: 542, x: 20, y: -4 },
    },
  },
} satisfies Record<BodyPerspective, {
  src: Record<BodyView, string>
  placement: Record<BodyView, BodyReferencePlacement>
}>

// Direct references share a centered mannequin coordinate system. Lateral references
// use dedicated paths below because their angled anatomy cannot be aligned by scaling.
const regionTransforms = {
  direct: {
    front: "translate(22 0) scale(0.83 1)",
    back: "translate(22 0) scale(0.83 1)",
  },
  lateral: {
    front: "translate(0 0)",
    back: "translate(0 0)",
  },
} satisfies Record<BodyPerspective, Record<BodyView, string>>
// Clip interactive regions to the visible anatomy instead of exposing broad hit geometry.
const bodyClipPaths = {
  direct: {
    front: "M130 16 C107 16 96 34 99 54 C102 72 113 82 130 82 C147 82 158 72 161 54 C164 34 153 16 130 16 Z M109 78 L151 78 L168 98 C188 94 207 101 220 119 C230 145 229 178 225 202 L231 280 C237 296 232 316 222 320 C211 314 207 296 210 282 L203 203 L199 145 L168 137 L167 226 L178 362 L178 397 L177 401 L174 483 C183 489 185 496 186 506 L146 506 L151 486 L144 401 L141 369 L134 277 L126 277 L119 369 L116 401 L109 486 L114 506 L74 506 C75 496 78 490 86 486 L83 401 L82 366 L90 274 L97 226 L92 137 L61 145 L57 203 L50 282 C53 296 49 314 38 320 C27 314 25 294 29 280 L35 202 C31 158 35 129 48 116 C61 98 84 91 109 96 Z",
    back: "M130 16 C107 16 96 34 99 54 C102 72 113 82 130 82 C147 82 158 72 161 54 C164 34 153 16 130 16 Z M109 78 L151 78 L168 98 C188 94 207 101 220 119 C230 145 229 178 225 202 L231 280 C237 296 232 316 222 320 C211 314 207 296 210 282 L203 203 L199 145 L168 137 L167 226 L178 362 L178 397 L177 401 L174 483 C183 489 185 496 186 506 L146 506 L151 486 L144 401 L141 369 L134 277 L126 277 L119 369 L116 401 L109 486 L114 506 L74 506 C75 496 78 490 86 486 L83 401 L82 366 L90 274 L97 226 L92 137 L61 145 L57 203 L50 282 C53 296 49 314 38 320 C27 314 25 294 29 280 L35 202 C31 158 35 129 48 116 C61 98 84 91 109 96 Z",
  },
  lateral: {
    front: "M108 17 C99 29 98 51 108 67 C118 82 146 82 160 65 C170 50 169 29 155 17 Z M119 70 C128 77 145 77 153 69 L157 99 C174 101 185 109 190 120 C194 145 193 174 187 207 L172 303 C175 309 171 319 160 327 C149 324 145 309 151 298 C160 275 166 237 168 205 L165 227 L176 282 L178 397 L178 504 L183 517 L149 517 L153 504 L148 397 L146 365 L140 284 L139 284 L132 365 L130 397 L127 484 L130 503 C118 510 98 510 91 502 C93 493 97 488 104 484 L101 397 L100 365 L99 283 L103 226 C95 213 93 205 94 198 C91 225 83 263 80 286 C82 299 91 305 99 296 C102 302 98 312 88 318 C77 312 74 298 80 286 L94 198 C88 161 91 131 102 116 C106 106 111 100 119 96 Z",
    back: "M72 18 C64 36 68 59 82 72 C94 84 119 80 132 65 L134 18 Z M88 70 C99 78 118 78 128 68 L132 96 C145 99 153 107 158 119 C166 139 168 173 162 207 L178 287 C184 294 186 307 178 315 C168 316 160 306 162 294 C151 273 144 238 143 205 L148 221 L155 282 L151 365 L149 397 L143 490 L153 507 L111 507 L112 490 L115 397 L116 365 L108 284 L106 284 L103 365 L99 397 L94 489 L96 503 C84 511 60 510 52 503 L57 489 L59 397 L61 365 L65 283 L70 220 L62 207 C61 234 55 264 52 282 C54 294 62 299 70 291 C73 297 69 305 60 311 C50 306 47 293 52 282 L62 207 C54 176 54 145 64 126 C63 111 71 96 86 91 Z",
  },
} satisfies Record<BodyPerspective, Record<BodyView, string>>


const frontRegions: readonly BodyRegion[] = [
  { id: "front-head", label: "Head and face", path: "M130 16 C107 16 96 34 99 54 C102 72 113 82 130 82 C147 82 158 72 161 54 C164 34 153 16 130 16 Z" },
  { id: "front-neck", label: "Front neck", path: "M114 78 L146 78 L151 100 C141 107 119 107 109 100 Z" },
  { id: "front-left-shoulder", label: "Left shoulder", path: "M109 96 C94 92 75 98 61 112 L63 137 C75 134 85 126 93 116 L101 102 Z" },
  { id: "front-right-shoulder", label: "Right shoulder", path: "M151 96 C166 92 185 98 199 112 L197 137 C185 134 175 126 167 116 L159 102 Z" },
  { id: "front-left-chest", label: "Left chest", path: "M109 101 C114 105 121 108 128 108 L128 165 C116 166 103 162 92 156 L94 121 Z" },
  { id: "front-right-chest", label: "Right chest", path: "M151 101 C146 105 139 108 132 108 L132 165 C144 166 157 162 168 156 L166 121 Z" },
  { id: "front-abdomen", label: "Abdomen", path: "M92 158 C104 165 116 168 128 168 L132 168 C144 168 156 165 168 158 L163 226 C145 237 115 237 97 226 Z" },
  { id: "front-left-upper-arm", label: "Left upper arm", path: "M48 116 C35 129 31 158 35 202 L57 200 L61 145 L54 148 Z" },
  { id: "front-right-upper-arm", label: "Right upper arm", path: "M212 116 C225 129 229 158 225 202 L203 200 L199 145 L206 148 Z" },
  { id: "front-left-forearm", label: "Left forearm", path: "M35 206 L30 276 L50 279 L57 203 Z" },
  { id: "front-right-forearm", label: "Right forearm", path: "M225 206 L230 276 L210 279 L203 203 Z" },
  { id: "front-left-hand", label: "Left hand", path: "M29 280 C25 294 27 314 38 320 C49 314 53 296 50 282 Z" },
  { id: "front-right-hand", label: "Right hand", path: "M231 280 C235 294 233 314 222 320 C211 314 207 296 210 282 Z" },
  { id: "front-left-hip", label: "Left hip", path: "M97 230 C106 236 117 239 128 239 L126 273 L90 270 Z" },
  { id: "front-right-hip", label: "Right hip", path: "M163 230 C154 236 143 239 132 239 L134 273 L170 270 Z" },
  { id: "front-left-thigh", label: "Left thigh", path: "M90 274 L126 277 L119 365 L82 362 Z" },
  { id: "front-right-thigh", label: "Right thigh", path: "M170 274 L134 277 L141 365 L178 362 Z" },
  { id: "front-left-knee", label: "Left knee", path: "M82 366 L119 369 L117 397 L82 397 Z" },
  { id: "front-right-knee", label: "Right knee", path: "M178 366 L141 369 L143 397 L178 397 Z" },
  { id: "front-left-lower-leg", label: "Left lower leg", path: "M83 401 L116 401 L109 483 L86 483 Z" },
  { id: "front-right-lower-leg", label: "Right lower leg", path: "M177 401 L144 401 L151 483 L174 483 Z" },
  { id: "front-left-foot", label: "Left foot", path: "M86 486 L109 486 L114 506 L74 506 C75 496 78 490 86 486 Z" },
  { id: "front-right-foot", label: "Right foot", path: "M174 486 L151 486 L146 506 L186 506 C185 496 182 490 174 486 Z" },
]

const backRegions: readonly BodyRegion[] = [
  { id: "back-head", label: "Back of head", path: "M130 16 C107 16 96 34 99 54 C102 72 113 82 130 82 C147 82 158 72 161 54 C164 34 153 16 130 16 Z" },
  { id: "back-neck", label: "Back of neck", path: "M114 78 L146 78 L151 100 C141 107 119 107 109 100 Z" },
  { id: "back-left-shoulder", label: "Left shoulder", path: "M109 96 C94 92 75 98 61 112 L63 137 C75 134 85 126 93 116 L101 102 Z" },
  { id: "back-right-shoulder", label: "Right shoulder", path: "M151 96 C166 92 185 98 199 112 L197 137 C185 134 175 126 167 116 L159 102 Z" },
  { id: "back-left-upper", label: "Left upper back", path: "M109 101 C100 102 91 107 83 116 L91 159 C102 164 115 168 128 169 L128 111 C121 109 114 106 109 101 Z" },
  { id: "back-right-upper", label: "Right upper back", path: "M151 101 C160 102 169 107 177 116 L169 159 C158 164 145 168 132 169 L132 111 C139 109 146 106 151 101 Z" },
  { id: "back-left-lower", label: "Left lower back", path: "M91 162 C102 168 115 171 128 173 L128 226 C116 231 105 230 97 225 L94 195 Z" },
  { id: "back-right-lower", label: "Right lower back", path: "M169 162 C158 168 145 171 132 173 L132 226 C144 231 155 230 163 225 L166 195 Z" },
  { id: "back-left-upper-arm", label: "Left upper arm", path: "M48 116 C35 129 31 158 35 202 L57 200 L61 145 L54 148 Z" },
  { id: "back-right-upper-arm", label: "Right upper arm", path: "M212 116 C225 129 229 158 225 202 L203 200 L199 145 L206 148 Z" },
  { id: "back-left-forearm", label: "Left forearm", path: "M35 206 L30 276 L50 279 L57 203 Z" },
  { id: "back-right-forearm", label: "Right forearm", path: "M225 206 L230 276 L210 279 L203 203 Z" },
  { id: "back-left-hand", label: "Left hand", path: "M29 280 C25 294 27 314 38 320 C49 314 53 296 50 282 Z" },
  { id: "back-right-hand", label: "Right hand", path: "M231 280 C235 294 233 314 222 320 C211 314 207 296 210 282 Z" },
  { id: "back-left-glute", label: "Left glute", path: "M97 230 C106 236 117 239 128 239 L126 273 L90 270 Z" },
  { id: "back-right-glute", label: "Right glute", path: "M163 230 C154 236 143 239 132 239 L134 273 L170 270 Z" },
  { id: "back-left-thigh", label: "Left hamstring", path: "M90 274 L126 277 L119 365 L82 362 Z" },
  { id: "back-right-thigh", label: "Right hamstring", path: "M170 274 L134 277 L141 365 L178 362 Z" },
  { id: "back-left-knee", label: "Back of left knee", path: "M82 366 L119 369 L117 397 L82 397 Z" },
  { id: "back-right-knee", label: "Back of right knee", path: "M178 366 L141 369 L143 397 L178 397 Z" },
  { id: "back-left-calf", label: "Left calf", path: "M83 401 L116 401 L109 483 L86 483 Z" },
  { id: "back-right-calf", label: "Right calf", path: "M177 401 L144 401 L151 483 L174 483 Z" },
  { id: "back-left-foot", label: "Left foot", path: "M86 486 L109 486 L114 506 L74 506 C75 496 78 490 86 486 Z" },
  { id: "back-right-foot", label: "Right foot", path: "M174 486 L151 486 L146 506 L186 506 C185 496 182 490 174 486 Z" },
]

const lateralFrontRegionPaths: Readonly<Record<string, string>> = {
  "front-head": "M108 17 C99 29 98 51 108 67 C118 82 146 82 160 65 C170 50 169 29 155 17 Z",
  "front-neck": "M119 70 C128 77 145 77 153 69 L157 99 C145 108 125 107 114 98 Z",
  "front-left-shoulder": "M113 96 C98 99 91 112 91 132 L119 145 L132 106 Z",
  "front-right-shoulder": "M132 104 C151 96 178 101 190 120 L184 145 L151 140 Z",
  "front-left-chest": "M119 109 L137 105 L143 166 C132 174 116 171 108 157 Z",
  "front-right-chest": "M138 105 C158 102 177 111 181 132 L173 164 C162 173 150 171 143 166 Z",
  "front-abdomen": "M111 164 C127 174 157 173 173 163 L165 227 C150 241 119 241 103 226 Z",
  "front-left-upper-arm": "M102 116 C91 131 88 161 94 198 L112 198 L119 139 Z",
  "front-right-upper-arm": "M181 122 C193 143 194 173 187 207 L168 204 L171 145 Z",
  "front-left-forearm": "M94 198 C91 225 83 263 80 286 C82 299 91 305 99 296 L112 201 Z",
  "front-right-forearm": "M168 205 C166 237 160 275 151 299 C153 310 164 314 172 303 L187 210 Z",
  "front-left-hand": "M80 286 C74 298 77 312 88 318 C98 312 102 302 99 293 Z",
  "front-right-hand": "M151 298 C145 309 149 324 160 327 C171 319 175 309 172 301 Z",
  "front-left-hip": "M103 226 C117 238 131 241 142 239 L139 283 L99 282 Z",
  "front-right-hip": "M142 239 C151 239 160 234 165 226 L176 282 L139 283 Z",
  "front-left-thigh": "M99 283 L139 284 L132 365 L100 365 Z",
  "front-right-thigh": "M176 283 L140 284 L146 365 L177 364 Z",
  "front-left-knee": "M100 365 L132 365 L130 397 L101 397 Z",
  "front-right-knee": "M177 365 L146 365 L148 397 L178 397 Z",
  "front-left-lower-leg": "M101 397 L130 397 L127 484 L105 484 Z",
  "front-right-lower-leg": "M178 397 L148 397 L153 504 L178 504 Z",
  "front-left-foot": "M104 484 L127 484 L130 503 C118 510 98 510 91 502 C93 493 97 488 104 484 Z",
  "front-right-foot": "M153 504 L178 504 L183 517 L149 517 Z",
}

const lateralBackRegionPaths: Readonly<Record<string, string>> = {
  "back-head": "M72 18 C64 36 68 59 82 72 C94 84 119 80 132 65 L134 18 Z",
  "back-neck": "M88 70 C99 78 118 78 128 68 L132 96 C119 105 99 104 86 95 Z",
  "back-left-shoulder": "M86 91 C71 96 63 111 63 133 L94 143 L109 102 Z",
  "back-right-shoulder": "M109 100 C129 94 150 101 158 119 L153 142 L125 138 Z",
  "back-left-upper": "M88 99 L108 102 L108 166 L68 158 L64 132 Z",
  "back-right-upper": "M109 102 L128 101 C143 110 149 129 145 158 L109 166 Z",
  "back-left-lower": "M69 159 L108 167 L108 226 C94 237 78 233 70 219 Z",
  "back-right-lower": "M109 166 L145 159 L148 221 C137 234 123 237 109 226 Z",
  "back-left-upper-arm": "M64 126 C54 145 54 176 62 207 L81 203 L89 142 Z",
  "back-right-upper-arm": "M150 120 C164 139 168 173 162 207 L143 204 L145 141 Z",
  "back-left-forearm": "M62 207 C61 234 55 264 52 282 C54 294 62 299 70 291 L81 205 Z",
  "back-right-forearm": "M143 205 C144 238 151 273 162 296 C169 303 178 298 178 287 L162 208 Z",
  "back-left-hand": "M52 282 C47 293 50 306 60 311 C69 305 73 297 70 289 Z",
  "back-right-hand": "M162 294 C160 306 168 316 178 315 C186 307 184 294 178 286 Z",
  "back-left-glute": "M70 220 C82 233 95 237 108 234 L106 283 L65 282 Z",
  "back-right-glute": "M109 234 C123 237 138 232 148 221 L155 282 L107 283 Z",
  "back-left-thigh": "M65 283 L106 284 L103 365 L61 365 Z",
  "back-right-thigh": "M155 283 L108 284 L116 365 L151 364 Z",
  "back-left-knee": "M61 365 L103 365 L99 397 L59 397 Z",
  "back-right-knee": "M151 365 L116 365 L115 397 L149 397 Z",
  "back-left-calf": "M59 397 L99 397 L94 489 L57 489 Z",
  "back-right-calf": "M149 397 L115 397 L112 490 L143 490 Z",
  "back-left-foot": "M57 489 L94 489 L96 503 C84 511 60 510 52 503 Z",
  "back-right-foot": "M112 490 L143 490 L153 507 L111 507 Z",
}

/** Reuses canonical IDs and labels while substituting geometry for an anatomical perspective. */
function applyRegionPaths(
  regions: readonly BodyRegion[],
  paths: Readonly<Record<string, string>>,
): readonly BodyRegion[] {
  return regions.map((region) => ({
    ...region,
    path: paths[region.id] ?? region.path,
  }))
}

/**
 * An anterior view mirrors client laterality: anatomical left appears on the
 * reviewer's right. Preserve canonical IDs while assigning the opposite screen path.
 */
function mapAnteriorLaterality(regions: readonly BodyRegion[]): readonly BodyRegion[] {
  const pathsById = new Map(regions.map((region) => [region.id, region.path]))

  return regions.map((region) => {
    const oppositeId = region.id.includes("-left-")
      ? region.id.replace("-left-", "-right-")
      : region.id.includes("-right-")
        ? region.id.replace("-right-", "-left-")
        : region.id

    return {
      ...region,
      path: pathsById.get(oppositeId) ?? region.path,
    }
  })
}

const directFrontRegions = mapAnteriorLaterality(frontRegions)
const lateralFrontRegions = mapAnteriorLaterality(
  applyRegionPaths(frontRegions, lateralFrontRegionPaths),
)

const regionsByPerspective = {
  direct: {
    front: directFrontRegions,
    back: backRegions,
  },
  lateral: {
    front: lateralFrontRegions,
    back: applyRegionPaths(backRegions, lateralBackRegionPaths),
  },
} satisfies Record<BodyPerspective, Record<BodyView, readonly BodyRegion[]>>

/** Review-only proof that one canonical region model can support SVG now and 3D later. */
export function WellnessRegionPreview() {
  const [view, setView] = React.useState<BodyView>("back")
  const [perspective, setPerspective] = React.useState<BodyPerspective>("direct")
  const [selectedRegions, setSelectedRegions] = React.useState<string[]>(["back-left-upper"])

  const regions = regionsByPerspective[perspective][view]
  const referenceAsset = bodyPerspectiveAssets[perspective]
  const referencePlacement = referenceAsset.placement[view]
  const regionTransform = regionTransforms[perspective][view]
  const svgId = React.useId().replaceAll(":", "")
  const bodyClipPath = bodyClipPaths[perspective][view]
  const bodyClipPathId = `wellness-body-clip-${svgId}`
  const referenceFilterId = `wellness-reference-blue-${svgId}`

  function toggleRegion(regionId: string) {
    setSelectedRegions((current) => (
      current.includes(regionId)
        ? current.filter((id) => id !== regionId)
        : [...current, regionId]
    ))
  }

  function handleRegionKeyDown(event: React.KeyboardEvent<SVGPathElement>, regionId: string) {
    if (event.key !== "Enter" && event.key !== " ") {
      return
    }

    event.preventDefault()
    toggleRegion(regionId)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(17rem,0.85fr)_minmax(18rem,1.15fr)] lg:items-start">
      <div className="grid gap-3">
        <SegmentedToggleGroup
          label="Perspective"
          value={perspective}
          options={bodyPerspectiveOptions}
          size="sm"
          onValueChange={(nextPerspective) => setPerspective(nextPerspective as BodyPerspective)}
        />
        <SegmentedToggleGroup
          label="Body view"
          value={view}
          options={bodyViewOptions}
          size="sm"
          onValueChange={(nextView) => setView(nextView as BodyView)}
        />
        <div className="rounded-xl border border-border/70 bg-background/65 p-3 shadow-inner">
          <svg
            viewBox="0 0 260 520"
            className="mx-auto h-auto max-h-[36rem] w-full max-w-72"
            aria-label={view === "front" ? "Anterior body regions" : "Posterior body regions"}
          >
            <defs>
              <filter
                id={referenceFilterId}
                colorInterpolationFilters="sRGB"
                x="-10%"
                y="-10%"
                width="120%"
                height="120%"
              >
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0.231 0 0 0 0 0.510 0 0 0 0 0.965 0 0 0 1 0"
                />
              </filter>
              <clipPath id={bodyClipPathId}>
                <path d={bodyClipPath} />
              </clipPath>
            </defs>
            <image
              href={referenceAsset.src[view]}
              x={referencePlacement.x}
              y={referencePlacement.y}
              width={referencePlacement.width}
              height={referencePlacement.height}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
              filter={`url(#${referenceFilterId})`}
              className="pointer-events-none opacity-55 dark:opacity-45"
            />
            <g transform={regionTransform}>
              <g clipPath={`url(#${bodyClipPathId})`}>
                {regions.map((region) => {
                const selected = selectedRegions.includes(region.id)
                return (
                  <path
                    key={region.id}
                    d={region.path}
                    role="button"
                    vectorEffect="non-scaling-stroke"
                    tabIndex={0}
                    aria-label={region.label}
                    aria-pressed={selected}
                    data-selected={selected}
                    className={cn(
                      "cursor-pointer stroke-[2.5] outline-none transition-[fill,stroke,filter]",
                      selected
                        ? "fill-orange-500/80 stroke-orange-200 drop-shadow-[0_0_8px_rgba(249,115,22,0.48)]"
                        : "fill-transparent stroke-transparent hover:fill-blue-500/45 hover:stroke-blue-200/80",
                      "focus-visible:stroke-white focus-visible:[filter:drop-shadow(0_0_7px_rgba(255,255,255,0.82))]",
                    )}
                    onClick={() => toggleRegion(region.id)}
                    onKeyDown={(event) => handleRegionKeyDown(event, region.id)}
                  />
                )
                })}
              </g>
            </g>
          </svg>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="font-semibold">Keyboard-accessible region list</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            The anatomical SVG and compact list share canonical region IDs and selection state.
            In anterior views, the client&apos;s left appears on your right. A future 3D body can consume the same model.
          </p>
        </div>
        <div className="grid max-h-[36rem] grid-cols-2 gap-2 overflow-y-auto pr-1">
          {regions.map((region) => {
            const selected = selectedRegions.includes(region.id)
            return (
              <Button
                key={region.id}
                type="button"
                variant={selected ? "default" : "outline"}
                tone="anatomime"
                size="compact"
                className={cn(!region.id.includes("-left-") && !region.id.includes("-right-") && "col-span-2")}
                aria-pressed={selected}
                onClick={() => toggleRegion(region.id)}
              >
                {region.label}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
