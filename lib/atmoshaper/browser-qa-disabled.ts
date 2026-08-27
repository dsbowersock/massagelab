import type { AtmoShaperLayer } from "./recipe.js"

/** Marker-free production substitute for the browser-QA diagnostics owner. */
export function installAtmoShaperBrowserQaDiagnostics(getDiagnostics: () => unknown) {
  void getDiagnostics
  return () => undefined
}

/** Marker-free production substitute for browser-QA adapter failure injection. */
export function injectAtmoShaperBrowserQaFailure(layer: AtmoShaperLayer) {
  void layer
}
