import { AtmosphereWorkspace } from "./workspace"
import { createNoindexPageMetadata } from "@/lib/seo"

export const metadata = createNoindexPageMetadata({
  title: "Music Browser | MassageLab",
  description: "MassageLab music browser compatibility route.",
  canonicalPath: "/music",
})

export default function BrowsePage() {
  return <AtmosphereWorkspace />
}
