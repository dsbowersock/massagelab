"use client"

import { useEffect } from "react"

export function ServiceWorkerProvider() {
  useEffect(() => {
    const isSecureLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)

    if (
      process.env.NODE_ENV !== "production"
      || !("serviceWorker" in navigator)
      || (window.location.protocol !== "https:" && !isSecureLocalHost)
    ) {
      return
    }

    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined)
  }, [])

  return null
}
