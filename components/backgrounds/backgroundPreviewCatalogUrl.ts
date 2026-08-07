/** Resolves development catalog media without importing the checked-in JSON payload. */
export function resolveCatalogPreviewUrl(url: string): string {
  if (/^(?:https?:)?\/\//.test(url) || url.startsWith("/")) return url
  return `/chimer/background-preview-catalog/${url}`
}
