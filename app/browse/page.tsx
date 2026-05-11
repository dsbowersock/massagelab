import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeading } from "@/components/ui/page-heading"

export default function BrowsePage() {
  return (
    <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeading>Music Browser</PageHeading>
        <Card className="border-neutral-800 bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle>Music tools are not part of the private alpha</CardTitle>
            <CardDescription>
              This route is intentionally gated until audio playback can be made reliable without external sample-service assumptions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-primary hover:bg-brand-orange-glow">
              <Link href="/chimer">Open Chimer</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
