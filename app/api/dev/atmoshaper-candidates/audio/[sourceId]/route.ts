import manifest from "@/data/atmoshaper/signature-sound-review.json"
import {
  parseDevCandidateByteRange,
  resolveDevCandidateAudioSource,
} from "@/lib/atmoshaper/dev-candidate-audio"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  context: { params: Promise<{ sourceId: string }> },
) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 })
  const { sourceId } = await context.params
  let source
  try {
    source = await resolveDevCandidateAudioSource({
      sourceId,
      manifest,
      sourceRoot: process.env.ATMOSHAPER_SIGNATURE_SOUNDS_ROOT,
      nodeEnv: process.env.NODE_ENV,
    })
  } catch {
    return Response.json({ error: "Candidate audio source is unavailable." }, { status: 404 })
  }

  let byteRange
  try {
    byteRange = parseDevCandidateByteRange(request.headers.get("range"), source.byteSize)
  } catch {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${source.byteSize}` },
    })
  }
  const body = source.bytes.subarray(byteRange.start, byteRange.end + 1)
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Length": String(body.byteLength),
    "Content-Type": source.mimeType,
  })
  if (byteRange.status === 206) {
    headers.set("Content-Range", `bytes ${byteRange.start}-${byteRange.end}/${source.byteSize}`)
  }
  return new Response(body, {
    status: byteRange.status,
    headers,
  })
}
