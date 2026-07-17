"use client"

import { useEffect, useState, type ReactNode } from "react"

/**
 * Exposes when the review matrix has hydrated so browser QA does not interact
 * with server-rendered controls before their client handlers are attached.
 */
export function ReviewLabInteractive({
  children,
}: {
  children: ReactNode
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  return (
    <div className="contents" data-review-lab-ready={ready ? "true" : "false"}>
      {children}
    </div>
  )
}
