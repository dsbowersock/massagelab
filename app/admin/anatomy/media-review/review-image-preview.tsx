"use client"

import { useEffect, useMemo, useState } from "react"

type ReviewImagePreviewProps = {
  alt: string
  fallbackUrl?: string
  primaryUrl?: string
}

/**
 * Renders admin review media with a source-url fallback so a bad stored URL does
 * not silently become a blank review card.
 */
export function ReviewImagePreview({ alt, fallbackUrl, primaryUrl }: ReviewImagePreviewProps) {
  const urls = useMemo(() => uniqueUrls([primaryUrl, fallbackUrl]), [fallbackUrl, primaryUrl])
  const [failedUrls, setFailedUrls] = useState<string[]>([])
  const activeUrl = urls.find((url) => !failedUrls.includes(url)) ?? ""

  useEffect(() => {
    setFailedUrls([])
  }, [urls])

  if (!activeUrl) {
    return (
      <div className="grid min-h-[18rem] place-items-center p-4 text-center text-sm text-muted-foreground">
        This image URL could not be loaded.
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- admin review previews can come from R2 or BodyParts3D source URLs.
    <img
      src={activeUrl}
      alt={alt}
      className="h-auto max-h-[68vh] min-h-[18rem] w-full object-contain p-2"
      referrerPolicy="no-referrer"
      onError={() => setFailedUrls((current) => current.includes(activeUrl) ? current : [...current, activeUrl])}
    />
  )
}

function uniqueUrls(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
}
