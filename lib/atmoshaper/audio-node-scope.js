// @ts-check

/** @typedef {{ stop?: () => unknown, dispose: () => unknown }} DisposableAudioNode */

/** Tracks audio allocations so partial construction and terminal cleanup share one safe path. */
export class AtmoShaperNodeScope {
  constructor() {
    /** @type {DisposableAudioNode[]} */
    this.nodes = []
    this.disposed = false
  }

  /** @template {DisposableAudioNode} Node @param {Node} node @returns {Node} */
  track(node) {
    if (this.disposed) {
      disposeAudioNode(node)
      throw new Error("Cannot add an audio node to a disposed AtmoShaper scope")
    }
    this.nodes.push(node)
    return node
  }

  /** Best-effort terminal cleanup continues even when an individual Tone node throws. */
  disposeAll() {
    if (this.disposed) return
    this.disposed = true
    for (const node of this.nodes.reverse()) disposeAudioNode(node)
    this.nodes.length = 0
  }
}

/**
 * Rolls back every tracked allocation when graph construction fails.
 *
 * @template Value
 * @param {(scope: AtmoShaperNodeScope) => Value} createValue
 * @returns {{ value: Value, disposeAll: () => void }}
 */
export function withAtmoShaperNodeScope(createValue) {
  const scope = new AtmoShaperNodeScope()
  try {
    return { value: createValue(scope), disposeAll: () => scope.disposeAll() }
  } catch (error) {
    scope.disposeAll()
    throw error
  }
}

/** @param {DisposableAudioNode} node */
function disposeAudioNode(node) {
  try {
    node.stop?.()
  } catch {
    // Terminal cleanup must continue through every remaining node.
  }
  try {
    node.dispose()
  } catch {
    // The scope has no live recovery path after terminal disposal.
  }
}
