import batch01Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batches.json"
import batch02Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-02-air-traffic-control.json"
import batch03Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-03-sci-fi-whistles-treatment-audition.json"
import batch04Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-04-boiling-water-edit-audition.json"
import batch05Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-05-dryer-trim-audition.json"
import batchRegistry from "@/data/atmoshaper/signature-sound-derived-audio-batch-registry.json"
import manifestAnchors from "@/data/atmoshaper/signature-sound-derived-audio-manifests.json"
import constructionReview from "@/data/atmoshaper/signature-sound-construction-review.json"
import discoveryReview from "@/data/atmoshaper/signature-sound-review.json"
import { parseDevCandidateByteRange } from "@/lib/atmoshaper/dev-candidate-audio"
import {
  loadDevSignatureDerivedCatalogBatch,
  resolveDevSignatureDerivedAudio,
} from "@/lib/atmoshaper/dev-derived-audio"
import {
  validateSignatureSoundDerivedAudioBatch,
  validateSignatureSoundDerivedManifest,
} from "@/lib/atmoshaper/signature-sound-derived-audio"
import {
  validateSignatureSoundEditAuditionBatch,
  validateSignatureSoundEditAuditionManifest,
} from "@/lib/atmoshaper/signature-sound-edit-audition"
import {
  validateSignatureSoundTreatmentAuditionBatch,
  validateSignatureSoundTreatmentAuditionManifest,
} from "@/lib/atmoshaper/signature-sound-treatment-audition"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const EXTERNAL_DIRECTORY_NAMES = {
  [batch01Declaration.batchId]: "batch-01-campfire-boiling-water",
  [batch02Declaration.batchId]: "batch-02-air-traffic-control",
  [batch03Declaration.batchId]: "batch-03-sci-fi-whistles-treatment-audition-v2",
  [batch04Declaration.batchId]: "batch-04-boiling-water-edit-audition-v2",
  [batch05Declaration.batchId]: "batch-05-dryer-trim-audition",
}

/** Serves one exact artifact from a closed server-selected immutable batch. */
export async function GET(
  request: Request,
  context: { params: Promise<{ batchOrOutputIdentity: string, outputIdentity: string }> },
) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 })
  let artifact
  try {
    const params = await context.params
    const selected = await loadDevSignatureDerivedCatalogBatch({
      batchId: params.batchOrOutputIdentity,
      catalogRoot: process.env.ATMOSHAPER_SIGNATURE_DERIVED_CATALOG_ROOT,
      outputRoot: process.env.ATMOSHAPER_SIGNATURE_DERIVED_ROOT,
      batchRegistry,
      manifestEntries: manifestAnchors.entries,
      externalDirectoryNames: EXTERNAL_DIRECTORY_NAMES,
      nodeEnv: process.env.NODE_ENV,
    })
    const batches = [batch01Declaration, batch02Declaration, batch05Declaration].map((declaration) => (
      validateSignatureSoundDerivedAudioBatch(declaration, { constructionReview, discoveryReview })
    ))
    const treatmentBatch = validateSignatureSoundTreatmentAuditionBatch(batch03Declaration, {
      constructionReview,
      discoveryReview,
    })
    const editBatch = validateSignatureSoundEditAuditionBatch(batch04Declaration, {
      constructionReview,
      discoveryReview,
    })
    const declarationSha256 = selected.manifestEntry.batchDeclarationSha256
    let manifest
    if (declarationSha256 === treatmentBatch.batchDeclarationSha256) {
      manifest = validateSignatureSoundTreatmentAuditionManifest(selected.manifest, treatmentBatch)
    } else if (declarationSha256 === editBatch.batchDeclarationSha256) {
      manifest = validateSignatureSoundEditAuditionManifest(selected.manifest, editBatch)
    } else {
      const batch = batches.find((candidate) => candidate.batchDeclarationSha256 === declarationSha256)
      if (!batch) throw new Error("Derived-audio batch declaration is missing")
      manifest = validateSignatureSoundDerivedManifest(selected.manifest, batch)
    }
    artifact = await resolveDevSignatureDerivedAudio({
      outputIdentity: params.outputIdentity,
      manifest,
      outputRoot: selected.outputRoot,
      nodeEnv: process.env.NODE_ENV,
    })
  } catch {
    return Response.json({ error: "Derived audio is unavailable." }, { status: 404 })
  }

  let byteRange
  try {
    byteRange = parseDevCandidateByteRange(request.headers.get("range"), artifact.byteSize)
  } catch {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${artifact.byteSize}` } })
  }
  const body = artifact.bytes.subarray(byteRange.start, byteRange.end + 1)
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Length": String(body.byteLength),
    "Content-Type": artifact.mimeType,
  })
  if (byteRange.status === 206) headers.set("Content-Range", `bytes ${byteRange.start}-${byteRange.end}/${artifact.byteSize}`)
  return new Response(body, { status: byteRange.status, headers })
}
