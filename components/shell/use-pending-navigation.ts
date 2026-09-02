"use client"

import { useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"

/**
 * Wraps ordinary imperative App Router navigation in a transition while each
 * caller remains responsible for its own disabled and status treatment.
 */
export function usePendingNavigation() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const push = useCallback((href: string) => {
    startTransition(() => router.push(href))
  }, [router, startTransition])

  const replace = useCallback((href: string) => {
    startTransition(() => router.replace(href))
  }, [router, startTransition])

  return { isPending, push, replace }
}
