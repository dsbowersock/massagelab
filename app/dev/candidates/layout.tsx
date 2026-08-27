import type { ReactNode } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"

export const metadata = {
  title: "AtmoShaper Sound Candidates",
  robots: { index: false, follow: false },
}

/** Keeps the review routes development-only without loading their large manifests on the lightweight hub. */
export default function CandidateReviewLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound()
  return (
    <>
      <nav className="mx-auto flex w-full max-w-[96rem] flex-wrap gap-3 px-4 pt-5 sm:px-6" aria-label="Candidate review pages">
        <Link className="rounded-lg border px-3 py-2 text-sm font-medium" href="/dev/candidates">Review home</Link>
        <Link className="rounded-lg border px-3 py-2 text-sm font-medium" href="/dev/candidates/recordings">Recording review</Link>
        <Link className="rounded-lg border px-3 py-2 text-sm font-medium" href="/dev/candidates/concepts">Concept review</Link>
        <Link className="rounded-lg border px-3 py-2 text-sm font-medium" href="/dev/candidates/processing">Processed audio</Link>
        <Link className="rounded-lg border px-3 py-2 text-sm font-medium" href="/dev/candidates/prepared">Prepared concepts</Link>
      </nav>
      {children}
    </>
  )
}
