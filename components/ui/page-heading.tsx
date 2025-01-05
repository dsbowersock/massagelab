interface PageHeadingProps {
  children: React.ReactNode
}

export function PageHeading({ children }: PageHeadingProps) {
  return (
    <h2 className="text-2xl font-bold text-[#ff7043] text-center mb-4">
      {children}
    </h2>
  )
}

