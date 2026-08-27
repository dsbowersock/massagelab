import { join } from "node:path"

import speechReductionDeclaration from "@/data/atmoshaper/signature-sound-speech-reduction-auditions.json"
import retainedSpeechReductionDeclaration from "@/data/atmoshaper/signature-sound-speech-reduction-auditions-v1.json"
import wholeConceptAmendments from "@/data/atmoshaper/signature-sound-whole-concept-review-amendments.json"
import wholeConceptBatches from "@/data/atmoshaper/signature-sound-whole-concept-review-batches.json"
import wholeConceptRevisions from "@/data/atmoshaper/signature-sound-whole-concept-review-revisions.json"
import constructionReview from "@/data/atmoshaper/signature-sound-construction-review.json"
import discoveryReview from "@/data/atmoshaper/signature-sound-review.json"
import { parseDevCandidateByteRange } from "@/lib/atmoshaper/dev-candidate-audio"
import { resolveDevSignatureSoundSpeechReductionAudio } from "@/lib/atmoshaper/dev-speech-reduction-audio"
import { loadDevSignatureSoundSpeechReductionBundleForBatch } from "@/lib/atmoshaper/dev-speech-reduction-review"
import { applySignatureSoundWholeConceptReviewAmendments } from "@/lib/atmoshaper/signature-sound-whole-concept-amendment"
import { validateSignatureSoundWholeConceptReviewCatalog } from "@/lib/atmoshaper/signature-sound-whole-concept-review"
import { applySignatureSoundWholeConceptReviewRevisions } from "@/lib/atmoshaper/signature-sound-whole-concept-revision"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Serves one exact processed source only through its owning concept batch. */
export async function GET(
  request: Request,
  context: { params: Promise<{ batchId: string, outputIdentity: string }> },
) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 })
  let artifact
  try {
    const params = await context.params
    const base = validateSignatureSoundWholeConceptReviewCatalog(wholeConceptBatches, {
      constructionReview,
      discoveryReview,
    })
    const revised = applySignatureSoundWholeConceptReviewRevisions(base, wholeConceptRevisions)
    const amended = applySignatureSoundWholeConceptReviewAmendments(revised, wholeConceptAmendments)
    const bundle = await loadDevSignatureSoundSpeechReductionBundleForBatch({
      batchId: params.batchId,
      catalog: amended,
      rawDeclaration: speechReductionDeclaration,
      retainedRawDeclaration: retainedSpeechReductionDeclaration,
      discoveryReview,
      anchorPath: join(
        process.cwd(),
        "data/atmoshaper/signature-sound-speech-reduction-review-anchor.json",
      ),
      trafficAnchorPath: join(
        process.cwd(),
        "data/atmoshaper/signature-sound-speech-reduction-traffic-review-anchor.json",
      ),
      outputRoot: process.env.ATMOSHAPER_SIGNATURE_SPEECH_REDUCTION_ROOT,
      trafficOutputRoot: process.env.ATMOSHAPER_SIGNATURE_SPEECH_REDUCTION_TRAFFIC_ROOT,
      nodeEnv: process.env.NODE_ENV,
    })
    artifact = await resolveDevSignatureSoundSpeechReductionAudio({
      batchId: params.batchId,
      outputIdentity: params.outputIdentity,
      manifest: bundle.snapshot.manifest,
      outputRoot: bundle.outputRoot,
      nodeEnv: process.env.NODE_ENV,
    })
  } catch {
    return Response.json({ error: "Speech-reduced audio is unavailable." }, { status: 404 })
  }

  let byteRange
  try {
    byteRange = parseDevCandidateByteRange(request.headers.get("range"), artifact.byteSize)
  } catch {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${artifact.byteSize}` },
    })
  }
  const body = artifact.bytes.subarray(byteRange.start, byteRange.end + 1)
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Length": String(body.byteLength),
    "Content-Type": artifact.mimeType,
  })
  if (byteRange.status === 206) {
    headers.set("Content-Range", `bytes ${byteRange.start}-${byteRange.end}/${artifact.byteSize}`)
  }
  return new Response(body, { status: byteRange.status, headers })
}
