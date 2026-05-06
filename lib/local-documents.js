export class LocalDocumentError extends Error {
  constructor(message) {
    super(message)
    this.name = "LocalDocumentError"
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function mergeKnownShape(defaultValue, importedValue) {
  if (Array.isArray(defaultValue)) {
    return Array.isArray(importedValue) ? importedValue : defaultValue
  }

  if (isPlainObject(defaultValue)) {
    const source = isPlainObject(importedValue) ? importedValue : {}
    return Object.fromEntries(
      Object.entries(defaultValue).map(([key, value]) => [
        key,
        hasOwn(source, key) ? mergeKnownShape(value, source[key]) : value,
      ]),
    )
  }

  if (typeof defaultValue === "string") {
    return typeof importedValue === "string" ? importedValue : defaultValue
  }

  if (typeof defaultValue === "number") {
    return Number.isFinite(importedValue) ? importedValue : defaultValue
  }

  if (typeof defaultValue === "boolean") {
    return typeof importedValue === "boolean" ? importedValue : defaultValue
  }

  return importedValue === undefined ? defaultValue : importedValue
}

export function createFilenameSlug(value, fallback = "client") {
  const slug = typeof value === "string"
    ? value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()
    : ""

  return slug || fallback
}

export function formatExportDate(value = new Date()) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === "string") {
    const dateSegment = value.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateSegment)) {
      return dateSegment
    }

    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }
  }

  return new Date().toISOString().slice(0, 10)
}

export function createLocalDocumentFilename({
  prefix,
  subject,
  extension,
  date = new Date(),
  fallbackSubject = "client",
}) {
  const safePrefix = createFilenameSlug(prefix, "massagelab-document")
  const safeSubject = createFilenameSlug(subject, fallbackSubject)
  const safeExtension = createFilenameSlug(extension, "json").replace(/^\.+/, "")

  return `${safePrefix}-${safeSubject}-${formatExportDate(date)}.${safeExtension}`
}

export function createLocalDocumentExport(data, exportedAt = new Date()) {
  const exportedAtValue = exportedAt instanceof Date ? exportedAt.toISOString() : exportedAt
  return {
    ...data,
    exportedAt: exportedAtValue || new Date().toISOString(),
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function createEditableDocumentHtml({ title, body, generatedAt = new Date() }) {
  const generatedAtValue = generatedAt instanceof Date ? generatedAt.toISOString() : String(generatedAt)

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    "<style>",
    "body{font-family:Arial,sans-serif;line-height:1.5;color:#111;margin:32px;}",
    "h1{font-size:24px;margin-bottom:8px;}",
    ".notice{border:1px solid #d97706;background:#fff7ed;padding:12px;margin:16px 0;}",
    "pre{white-space:pre-wrap;font-family:Arial,sans-serif;font-size:12pt;}",
    "</style>",
    "</head>",
    "<body>",
    `<h1>${escapeHtml(title)}</h1>`,
    `<p><strong>Generated:</strong> ${escapeHtml(generatedAtValue)}</p>`,
    '<div class="notice">Local-first export. MassageLab did not upload this clinical document. The user controls storage and sharing.</div>',
    `<pre>${escapeHtml(body)}</pre>`,
    "</body>",
    "</html>",
  ].join("")
}

export function mergeLocalDocumentData(defaults, imported, { discriminatorKey, discriminatorValue }) {
  if (!isPlainObject(imported)) {
    throw new LocalDocumentError("Expected a MassageLab JSON object.")
  }

  if (imported[discriminatorKey] !== discriminatorValue) {
    throw new LocalDocumentError(`Expected ${discriminatorKey} to be ${discriminatorValue}.`)
  }

  return mergeKnownShape(defaults, imported)
}

export function parseLocalDocumentJson(text, defaults, options) {
  let imported

  try {
    imported = JSON.parse(text)
  } catch {
    throw new LocalDocumentError("Could not parse that JSON file.")
  }

  return mergeLocalDocumentData(defaults, imported, options)
}
