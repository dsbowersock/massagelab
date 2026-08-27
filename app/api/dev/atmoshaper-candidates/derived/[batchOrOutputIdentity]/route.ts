import batch01Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batches.json"
import batch02Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-02-air-traffic-control.json"
import batch03Declaration from "@/data/atmoshaper/signature-sound-derived-audio-batch-03-sci-fi-whistles-treatment-audition.json"
import manifestAnchors from "@/data/atmoshaper/signature-sound-derived-audio-manifests.json"
import constructionReview from "@/data/atmoshaper/signature-sound-construction-review.json"
import discoveryReview from "@/data/atmoshaper/signature-sound-review.json"
import { parseDevCandidateByteRange } from "@/lib/atmoshaper/dev-candidate-audio"
import {
  loadDevSignatureDerivedManifestSnapshot,
  resolveDevSignatureDerivedAudio,
} from "@/lib/atmoshaper/dev-derived-audio"
import {
  validateSignatureSoundDerivedAudioBatch,
  validateSignatureSoundDerivedManifest,
} from "@/lib/atmoshaper/signature-sound-derived-audio"
import {
  validateSignatureSoundTreatmentAuditionBatch,
  validateSignatureSoundTreatmentAuditionManifest,
} from "@/lib/atmoshaper/signature-sound-treatment-audition"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Retains the historical one-segment output-identity endpoint. */
export async function GET(
  request: Request,
  context: { params: Promise<{ batchOrOutputIdentity: string }> },
) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 })
  let artifact
  try {
    const batches = [batch01Declaration, batch02Declaration].map((declaration) => (
      validateSignatureSoundDerivedAudioBatch(declaration, { constructionReview, discoveryReview })
    ))
    const treatmentBatch = validateSignatureSoundTreatmentAuditionBatch(batch03Declaration, {
      constructionReview,
      discoveryReview,
    })
    const snapshot = await loadDevSignatureDerivedManifestSnapshot({
      outputRoot: process.env.ATMOSHAPER_SIGNATURE_DERIVED_ROOT,
      manifestEntries: manifestAnchors.entries,
      nodeEnv: process.env.NODE_ENV,
    })
    const batch = batches.find((candidate) => candidate.batchDeclarationSha256 === snapshot.manifestEntry.batchDeclarationSha256)
    const manifest = snapshot.manifestEntry.batchDeclarationSha256 === treatmentBatch.batchDeclarationSha256
      ? validateSignatureSoundTreatmentAuditionManifest(snapshot.manifest, treatmentBatch)
      : batch
        ? validateSignatureSoundDerivedManifest(snapshot.manifest, batch)
        : (() => { throw new Error("Derived-audio batch declaration is missing") })()
    artifact = await resolveDevSignatureDerivedAudio({
      outputIdentity: (await context.params).batchOrOutputIdentity,
      manifest,
      outputRoot: process.env.ATMOSHAPER_SIGNATURE_DERIVED_ROOT,
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
