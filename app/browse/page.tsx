import Link from "next/link"
import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"

export default function BrowsePage() {
  return (
    <AppPageShell title="Music Browser" width="prose">
        <AppSurface
          title="Music tools are not part of the private alpha"
          description={
            <>
              This route is intentionally gated until audio playback can be made reliable without external sample-service assumptions.
            </>
          }
        >
            <Button asChild className="bg-primary hover:bg-brand-orange-glow">
              <Link href="/chimer">Open Chimer</Link>
            </Button>
        </AppSurface>
    </AppPageShell>
  )
}
