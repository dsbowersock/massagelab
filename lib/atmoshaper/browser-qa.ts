import type { AtmoShaperLayer } from "./recipe.js"

type BrowserQaRequest = {
  enabled?: unknown
  failNextSourceIds?: unknown
  getDiagnostics?: () => unknown
}

function requestOnLoopback() {
  if (typeof window === "undefined") return null
  if (!["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) return null
  const request = Reflect.get(window, "__massagelabAtmoShaperBrowserQa") as BrowserQaRequest | undefined
  return request?.enabled === true ? request : null
}

/** Installs a provider-owned snapshot reader only in an explicit loopback QA build. */
export function installAtmoShaperBrowserQaDiagnostics(getDiagnostics: () => unknown) {
  const request = requestOnLoopback()
  if (!request) return () => undefined
  request.getDiagnostics = getDiagnostics
  return () => {
    if (request.getDiagnostics === getDiagnostics) delete request.getDiagnostics
  }
}

/** Throws one requested adapter failure only in an explicit loopback QA build. */
export function injectAtmoShaperBrowserQaFailure(layer: AtmoShaperLayer) {
  const request = requestOnLoopback()
  if (!request || !Array.isArray(request.failNextSourceIds)) return
  const failureIndex = request.failNextSourceIds.indexOf(layer.sourceId)
  if (failureIndex === -1) return
  request.failNextSourceIds.splice(failureIndex, 1)
  throw new Error(`Browser QA injected failure for ${layer.sourceId}.`)
}
