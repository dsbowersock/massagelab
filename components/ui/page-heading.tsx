interface PageHeadingProps {
  children: React.ReactNode
}

export function PageHeading({ children }: PageHeadingProps) {
  return (
    <h2 className="text-2xl font-bold text-brand-orange text-center mb-4">
      {children}
    </h2>
  )
}

