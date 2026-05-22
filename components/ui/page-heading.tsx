interface PageHeadingProps {
  children: React.ReactNode
  description?: React.ReactNode
  align?: "left" | "center"
  as?: "h1" | "h2"
  className?: string
}

export function PageHeading({
  children,
  description,
  align = "center",
  as: Component = "h1",
  className,
}: PageHeadingProps) {
  return (
    <div className={className}>
      <Component className={`text-2xl font-semibold tracking-normal text-brand-orange ${align === "center" ? "text-center" : "text-left"}`}>
        {children}
      </Component>
      {description ? (
        <p className={`mt-2 text-sm leading-6 text-muted-foreground ${align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl text-left"}`}>
          {description}
        </p>
      ) : null}
    </div>
  )
}

