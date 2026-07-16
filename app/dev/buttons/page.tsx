import { notFound } from "next/navigation"

import { AppPageShell, AppSurface } from "@/components/ui/app-surface"
import { Notice } from "@/components/ui/notice"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ButtonGallery } from "./button-gallery"
import { CardStatusGallery } from "./card-status-gallery"
import { ChoiceGallery } from "./choice-gallery"
import { FieldGallery } from "./field-gallery"
import { ProtectedRouteGallery } from "./protected-route-gallery"
import { SurfaceNavigationGallery } from "./surface-navigation-gallery"
import { ReviewLabInteractive } from "./review-lab-interactive"

export const metadata = {
  title: "Control System Review",
  robots: {
    index: false,
    follow: false,
  },
}

const reviewSections = [
  { value: "buttons", label: "Buttons" },
  { value: "choices", label: "Choices" },
  { value: "fields", label: "Fields & color" },
  { value: "cards-status", label: "Cards & status" },
  { value: "surfaces", label: "Navigation & surfaces" },
  { value: "protected", label: "Protected routes" },
] as const

export default function ControlSystemReviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  return (
    <AppPageShell width="full" contentClassName="gap-8 pb-24">
      <header className="space-y-3">
        <p className="text-sm font-medium text-primary">Local development · visual approval gate</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">Control system review</h1>
        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
          Review every reusable control and surface family before production-route migration. Routes choose intent, tone, density, effect, and selected behavior; shared authorities own geometry and interaction mechanics.
        </p>
      </header>

      <Notice
        tone="info"
        title="Review milestone S1–S5"
        description="This lab changes shared contracts and review specimens only. Protected production visuals remain unchanged until this matrix is approved."
      />

      <AppSurface title="How to review" description="Exercise real browser states instead of relying only on static examples." variant="inset">
        <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <p><strong className="text-foreground">Pointer:</strong> hover and press interactive specimens.</p>
          <p><strong className="text-foreground">Keyboard:</strong> Tab, arrow keys, Space, Enter, and Escape.</p>
          <p><strong className="text-foreground">Viewport:</strong> compare phone, tablet, and desktop wrapping.</p>
          <p><strong className="text-foreground">Theme:</strong> inspect light and dark contrast.</p>
        </div>
      </AppSurface>

      <ReviewLabInteractive>
      <Tabs defaultValue="buttons" className="space-y-6">
        <div className="sticky top-2 z-30 -mx-2 rounded-xl border border-border/80 bg-background/90 p-2 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <TabsList
            variant="inset"
            className="flex h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Control-system review sections"
          >
            {reviewSections.map((section) => (
              <TabsTrigger
                key={section.value}
                value={section.value}
                className="shrink-0"
              >
                {section.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="buttons" className="mt-0">
          <ButtonGallery />
        </TabsContent>

        <TabsContent value="choices" className="mt-0">
          <ChoiceGallery />
        </TabsContent>

        <TabsContent value="fields" className="mt-0">
          <FieldGallery />
        </TabsContent>

        <TabsContent value="cards-status" className="mt-0">
          <CardStatusGallery />
        </TabsContent>

        <TabsContent value="surfaces" className="mt-0">
          <SurfaceNavigationGallery />
        </TabsContent>

        <TabsContent value="protected" className="mt-0">
          <ProtectedRouteGallery />
        </TabsContent>
      </Tabs>
      </ReviewLabInteractive>
    </AppPageShell>
  )
}
