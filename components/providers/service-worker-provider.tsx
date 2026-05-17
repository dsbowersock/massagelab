"use client"

import { useEffect } from "react"

export function ServiceWorkerProvider() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production"
      || !("serviceWorker" in navigator)
      || (window.location.protocol !== "https:" && window.location.hostname !== "localhost")
    ) {
      return
    }

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined)
  }, [])

  return null
}
