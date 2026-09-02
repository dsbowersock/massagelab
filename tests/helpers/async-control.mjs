/** Creates a resolve-only manual Promise gate for deterministic concurrency tests. */
export function deferred() {
  let resolve
  const promise = new Promise((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

/** Bounds a label-based manual gate while clearing its timer on every outcome. */
export async function boundedLatch(promise, label, timeoutMs = 1_000) {
  return settleBeforeTimeout(promise, timeoutMs, `${label} timed out`)
}

/** Bounds an operation with the caller's exact failure message. */
export async function settlesWithin(promise, timeoutMs, message) {
  return settleBeforeTimeout(promise, timeoutMs, message)
}

async function settleBeforeTimeout(promise, timeoutMs, message) {
  let timeout
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}
