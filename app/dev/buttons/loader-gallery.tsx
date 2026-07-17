import { AppSurface } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import { Loader } from "@/components/ui/loader"

const loaderExamples = [
  {
    label: "Compact",
    note: "Inline wait states and compact controls.",
    size: 26,
    // Sphere+dither leaves more empty canvas than swirl+dither, so this gallery
    // uses a calibrated sphere canvas to compare visual footprint instead of raw pixels.
    sphereComparisonSize: 42,
    speed: 0.8,
    swirlSpeed: 0.35,
    rippleSpeed: 0.35,
    color: "hsl(var(--ml-site-blue))",
  },
  {
    label: "Default",
    note: "General indeterminate loading state.",
    size: 44,
    sphereComparisonSize: 76,
    speed: 1,
    swirlSpeed: 0.45,
    rippleSpeed: 0.45,
    color: "#ea580c",
  },
  {
    label: "Large and calm",
    note: "Focused preparation or import surfaces.",
    size: 64,
    sphereComparisonSize: 106,
    speed: 0.35,
    swirlSpeed: 0.35,
    rippleSpeed: 0.35,
    color: "hsl(var(--button-cta-face))",
  },
]
const buttonLoaderSize = 18
const buttonLoaderShapes = ["sphere", "swirl", "ripple"] as const


export function LoaderGallery() {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="loader-gallery-heading">
      <div className="flex flex-col gap-1">
        <h2 id="loader-gallery-heading" className="text-2xl font-semibold">
          Indeterminate loader
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Omit the shape to choose Sphere, Swirl, or Ripple randomly for each default wait. Fixed shapes remain available when a context needs consistency.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AppSurface
          title="Sizes and color"
          description="The canonical orange treatment accepts context colors without changing its silhouette."
        >
          <div className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {loaderExamples.map((example) => (
                <div
                  key={example.label}
                  className="grid min-h-28 place-items-center gap-3 rounded-md border border-border/80 bg-background/70 p-4 text-center"
                >
                  <Loader
                    label={`${example.label} sphere loader example`}
                    shape="sphere"
                    variant="dither"
                    size={example.sphereComparisonSize}
                    speed={example.speed}
                    color={example.color}
                  />
                  <div className="grid gap-1">
                    <p className="text-sm font-medium">{example.label}</p>
                    <p className="text-xs leading-5 text-muted-foreground">{example.note}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Button-sized shapes
              </p>
              <div className="flex flex-wrap gap-3">
                {buttonLoaderShapes.map((shape) => (
                  <Button
                    key={shape}
                    aria-busy="true"
                    disabled
                    size="compact"
                    className="disabled:opacity-100"
                  >
                    <Loader
                      aria-hidden="true"
                      label={shape + " button loader"}
                      shape={shape}
                      variant="dither"
                      size={buttonLoaderSize}
                      color="currentColor"
                    />
                    {shape.charAt(0).toUpperCase() + shape.slice(1)}
                  </Button>
                ))}
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Each fixed shape has a mini treatment; omit shape in real loading buttons to randomize it.
              </p>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Swirl comparison
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {loaderExamples.map((example) => (
                  <div
                    key={`${example.label}-swirl`}
                    className="grid min-h-28 place-items-center gap-3 rounded-md border border-border/80 bg-background/70 p-4 text-center"
                  >
                    <Loader
                      label={`${example.label} swirl loader example`}
                      shape="swirl"
                      variant="dither"
                      size={example.size}
                      speed={example.swirlSpeed}
                      color={example.color}
                    />
                    <div className="grid gap-1">
                      <p className="text-sm font-medium">{example.label}</p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        Swirl shape with the same size and color at a slower pace.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Ripple comparison
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {loaderExamples.map((example) => (
                  <div
                    key={`${example.label}-ripple`}
                    className="grid min-h-28 place-items-center gap-3 rounded-md border border-border/80 bg-background/70 p-4 text-center"
                  >
                    <Loader
                      label={`${example.label} ripple loader example`}
                      shape="ripple"
                      variant="dither"
                      size={example.size}
                      speed={example.rippleSpeed}
                      color={example.color}
                    />
                    <div className="grid gap-1">
                      <p className="text-sm font-medium">{example.label}</p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        Ripple shape with the same size and color at a slower pace.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AppSurface>

        <AppSurface
          title="Inline action state"
          description="Visible button text owns the accessible action name, so the nested loader is decorative."
        >
          <div className="flex min-h-28 items-center justify-center">
            <Button disabled>
              <Loader
                aria-hidden="true"
                label="Saving"
                variant="dither"
                size={18}
                color="currentColor"
              />
              Saving...
            </Button>
          </div>
        </AppSurface>
      </div>
    </section>
  )
}
