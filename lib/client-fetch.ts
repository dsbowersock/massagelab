export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 1500) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: init.signal ?? controller.signal,
    })
  } finally {
    window.clearTimeout(timeoutId)
  }
}
