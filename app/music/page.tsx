import { AtmosphereWorkspace } from "@/app/browse/workspace"
import { createPublicPageMetadata } from "@/lib/seo"

export const metadata = createPublicPageMetadata("/music")

export default function MusicPage() {
  return <AtmosphereWorkspace layout="rails" />
}
