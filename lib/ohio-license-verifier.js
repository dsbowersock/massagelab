// @ts-check

export const OHIO_LICENSE_LOOKUP_URL = "https://elicense.ohio.gov/OH_VerifyLicense"
export const OHIO_APEX_REMOTE_URL = "https://elicense.ohio.gov/apexremote"
export const OHIO_LICENSE_VERIFIER_NAME = "OHIO_ELICENSE_VISUALFORCE"

const OHIO_MASSAGE_BOARD = "Medical Board"
const OHIO_MASSAGE_LICENSE_TYPE = "Massage Therapist (MT)"

/**
 * @typedef {"VERIFIED" | "PENDING" | "REJECTED"} OhioVerificationStatus
 * @typedef {{
 *   licenseNumber: string,
 *   legalFirstName: string,
 *   legalMiddleName?: string | null,
 *   legalLastName: string,
 *   fetchImpl?: typeof fetch,
 *   now?: Date,
 * }} OhioVerifierInput
 * @typedef {{
 *   licenseNumber: boolean,
 *   board: boolean,
 *   licenseType: boolean,
 *   status: boolean,
 *   expiration: boolean,
 *   boardAction: boolean,
 *   firstName: boolean,
 *   middleName: boolean,
 *   lastName: boolean,
 * }} OhioMatchResult
 * @typedef {{
 *   sourceName: string,
 *   sourceUrl: string,
 *   checkedAt: string,
 *   ohioRecordId: string | null,
 *   status: string | null,
 *   board: string | null,
 *   licenseType: string | null,
 *   licenseNumber: string | null,
 *   issueDate: string | null,
 *   effectiveDate: string | null,
 *   expirationDate: string | null,
 *   boardAction: string | null,
 *   city: string | null,
 *   state: string | null,
 *   compactEligible: boolean | null,
 * }} OhioMinimalProof
 * @typedef {{
 *   status: OhioVerificationStatus,
 *   reasonCode: string,
 *   checkedAt: string,
 *   match: OhioMatchResult | null,
 *   proof: OhioMinimalProof | null,
 * }} OhioDecision
 * @typedef {{
 *   vid: string,
 *   csrf: string,
 *   authorization: string,
 * }} OhioRemotingContext
 */

export class OhioLicenseVerifierError extends Error {
  /**
   * @param {string} reasonCode
   * @param {string} message
   */
  constructor(reasonCode, message) {
    super(message)
    this.name = "OhioLicenseVerifierError"
    this.reasonCode = reasonCode
  }
}

/**
 * @param {unknown} value
 */
export function normalizeLicenseNumber(value) {
  return toText(value).toUpperCase().replace(/[^A-Z0-9]/g, "")
}

/**
 * @param {unknown} value
 */
export function normalizeNamePart(value) {
  return toText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

/**
 * @param {string} html
 * @returns {OhioRemotingContext}
 */
export function extractOhioRemotingContext(html) {
  const vid = matchFirst(html, /"vid"\s*:\s*"([^"]+)"/)
  const methodBlock = matchFirst(html, /(\{[^{}]*"name"\s*:\s*"findLicensesForOwner"[^{}]*\})/)

  if (!vid || !methodBlock) {
    throw new OhioLicenseVerifierError(
      "OHIO_CONTEXT_PARSE_FAILED",
      "Ohio eLicense did not expose the expected Visualforce remoting metadata.",
    )
  }

  const csrf = matchFirst(methodBlock, /"csrf"\s*:\s*"([^"]+)"/)
  const authorization = matchFirst(methodBlock, /"authorization"\s*:\s*"([^"]+)"/)

  if (!csrf || !authorization) {
    throw new OhioLicenseVerifierError(
      "OHIO_CONTEXT_PARSE_FAILED",
      "Ohio eLicense remoting metadata did not include csrf and authorization values.",
    )
  }

  return {
    vid,
    csrf,
    authorization,
  }
}

/**
 * @param {unknown} payload
 * @returns {unknown[]}
 */
export function extractOhioRowsFromApexResponse(payload) {
  if (!Array.isArray(payload) || payload.length !== 1) {
    throw new OhioLicenseVerifierError("OHIO_UNEXPECTED_RESPONSE", "Ohio eLicense returned an unexpected response envelope.")
  }

  const message = asRecord(payload[0])

  if (message.statusCode !== 200 || !Array.isArray(message.result)) {
    throw new OhioLicenseVerifierError("OHIO_UNEXPECTED_RESPONSE", "Ohio eLicense returned an unexpected lookup result.")
  }

  return message.result
}

/**
 * @param {{
 *   context: OhioRemotingContext,
 *   licenseNumber: string,
 *   legalFirstName?: string | null,
 *   legalMiddleName?: string | null,
 *   legalLastName?: string | null,
 * }} input
 */
export function buildOhioLicenseSearchPayload(input) {
  return [
    {
      action: "OH_VerifyLicenseCtlr",
      method: "findLicensesForOwner",
      data: [
        {
          firstName: input.legalFirstName ?? "",
          lastName: input.legalLastName ?? "",
          middleName: input.legalMiddleName ?? "",
          contactAlias: "",
          board: OHIO_MASSAGE_BOARD,
          licenseType: OHIO_MASSAGE_LICENSE_TYPE,
          licenseNumber: input.licenseNumber,
          city: "",
          state: "",
          county: "",
          businessBoard: "",
          businessLicenseType: "",
          businessLicenseNumber: "",
          businessCity: "",
          businessState: "",
          businessCounty: "",
          businessName: "",
          dbafileld: "",
          searchType: "individual",
        },
      ],
      type: "rpc",
      tid: 2,
      ctx: {
        csrf: input.context.csrf,
        vid: input.context.vid,
        ns: "",
        ver: 41,
        authorization: input.context.authorization,
      },
    },
  ]
}

/**
 * @param {unknown} row
 * @param {string | Date} [checkedAt]
 */
export function normalizeOhioLicenseRow(row, checkedAt = new Date()) {
  const record = asRecord(row)
  const license = asRecord(record.license)
  const applicant = asRecord(license.MUSW__Applicant__r)
  const parsedName = parseApplicantName(record, license, applicant)
  const boardAction = normalizeBoardAction(firstText(license.Board_Action__c, record.BoardAction))
  const expirationDate = firstText(record.ExpirationDate, asIsoDate(license.MUSW__Expiration_Date__c))

  return {
    ohioRecordId: firstText(record.LicenseId, license.Id),
    licenseNumber: firstText(record.RecNumber, license.Name),
    board: firstText(record.Board, license.Board__c),
    licenseType: firstText(record.Type, license.MUSW__Type__c),
    status: firstText(record.Status, license.MUSW__Status__c),
    issueDate: asIsoDate(license.MUSW__Issue_Date__c),
    effectiveDate: asIsoDate(license.Effective_Date__c),
    expirationDate,
    boardAction,
    city: firstText(record.City, license.Applicant_City__c),
    state: firstText(record.State, license.Applicant_State__c),
    compactEligible: typeof license.Compact_Eligible__c === "boolean" ? license.Compact_Eligible__c : null,
    applicantFirstName: parsedName.firstName,
    applicantMiddleName: parsedName.middleName,
    applicantLastName: parsedName.lastName,
    proof: {
      sourceName: "Ohio eLicense",
      sourceUrl: OHIO_LICENSE_LOOKUP_URL,
      checkedAt: checkedAt instanceof Date ? checkedAt.toISOString() : checkedAt,
      ohioRecordId: firstText(record.LicenseId, license.Id),
      status: firstText(record.Status, license.MUSW__Status__c),
      board: firstText(record.Board, license.Board__c),
      licenseType: firstText(record.Type, license.MUSW__Type__c),
      licenseNumber: firstText(record.RecNumber, license.Name),
      issueDate: asIsoDate(license.MUSW__Issue_Date__c),
      effectiveDate: asIsoDate(license.Effective_Date__c),
      expirationDate,
      boardAction,
      city: firstText(record.City, license.Applicant_City__c),
      state: firstText(record.State, license.Applicant_State__c),
      compactEligible: typeof license.Compact_Eligible__c === "boolean" ? license.Compact_Eligible__c : null,
    },
  }
}

/**
 * @param {{
 *   rows: unknown[],
 *   input: {
 *     licenseNumber: string,
 *     legalFirstName: string,
 *     legalMiddleName?: string | null,
 *     legalLastName: string,
 *   },
 *   now?: Date,
 *   checkedAt?: string,
 * }} params
 * @returns {OhioDecision}
 */
export function decideOhioMassageLicenseVerification(params) {
  const now = params.now ?? new Date()
  const checkedAt = params.checkedAt ?? now.toISOString()
  const normalizedRows = params.rows.map((row) => normalizeOhioLicenseRow(row, checkedAt))

  if (normalizedRows.length === 0) {
    return decision("REJECTED", "NO_MATCHING_LICENSE", checkedAt, null, null)
  }

  if (normalizedRows.length > 1) {
    return decision("PENDING", "MULTIPLE_MATCHING_LICENSES", checkedAt, null, null)
  }

  const record = normalizedRows[0]
  const match = buildMatchResult(record, params.input, now)

  if (!match.licenseNumber) {
    return decision("REJECTED", "NO_MATCHING_LICENSE", checkedAt, match, record.proof)
  }

  if (!match.board) {
    return decision("REJECTED", "WRONG_BOARD", checkedAt, match, record.proof)
  }

  if (!match.licenseType) {
    return decision("REJECTED", "WRONG_LICENSE_TYPE", checkedAt, match, record.proof)
  }

  if (!match.status) {
    return decision("REJECTED", "INACTIVE_LICENSE", checkedAt, match, record.proof)
  }

  if (!record.expirationDate) {
    return decision("PENDING", "OHIO_UNEXPECTED_RESPONSE", checkedAt, match, record.proof)
  }

  if (!match.expiration) {
    return decision("REJECTED", "EXPIRED_LICENSE", checkedAt, match, record.proof)
  }

  if (!match.boardAction) {
    return decision("PENDING", "BOARD_ACTION_REVIEW", checkedAt, match, record.proof)
  }

  if (!match.firstName || !match.middleName || !match.lastName) {
    return decision("PENDING", "NAME_MISMATCH", checkedAt, match, record.proof)
  }

  return decision("VERIFIED", "OHIO_VERIFIED", checkedAt, match, record.proof)
}

/**
 * @param {OhioVerifierInput} input
 * @returns {Promise<OhioDecision>}
 */
export async function verifyOhioMassageLicense(input) {
  const now = input.now ?? new Date()
  const checkedAt = now.toISOString()

  if (!input.licenseNumber || !input.legalFirstName || !input.legalLastName) {
    return decision("PENDING", "MISSING_REQUIRED_VERIFICATION_INPUT", checkedAt, null, null)
  }

  const fetchImpl = input.fetchImpl ?? fetch

  try {
    const pageResponse = await fetchImpl(OHIO_LICENSE_LOOKUP_URL, {
      cache: "no-store",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    })

    if (!pageResponse.ok) {
      return decision("PENDING", "OHIO_LOOKUP_UNAVAILABLE", checkedAt, null, null)
    }

    const html = await pageResponse.text()
    const context = extractOhioRemotingContext(html)
    const remoteResponse = await fetchImpl(OHIO_APEX_REMOTE_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json; charset=UTF-8",
        Origin: "https://elicense.ohio.gov",
        Referer: OHIO_LICENSE_LOOKUP_URL,
      },
      body: JSON.stringify(
        buildOhioLicenseSearchPayload({
          context,
          licenseNumber: input.licenseNumber,
          legalFirstName: input.legalFirstName,
          legalMiddleName: input.legalMiddleName,
          legalLastName: input.legalLastName,
        }),
      ),
    })

    if (!remoteResponse.ok) {
      return decision("PENDING", "OHIO_LOOKUP_UNAVAILABLE", checkedAt, null, null)
    }

    const payload = await remoteResponse.json()
    const rows = extractOhioRowsFromApexResponse(payload)

    return decideOhioMassageLicenseVerification({
      rows,
      input,
      now,
      checkedAt,
    })
  } catch (error) {
    if (error instanceof OhioLicenseVerifierError) {
      return decision("PENDING", error.reasonCode, checkedAt, null, null)
    }

    return decision("PENDING", "OHIO_LOOKUP_UNAVAILABLE", checkedAt, null, null)
  }
}

/**
 * @param {string | null | undefined} value
 */
export function ohioExpirationDateToDate(value) {
  if (!value) return null

  const date = new Date(`${value}T23:59:59.999Z`)

  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * @param {unknown} value
 */
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? /** @type {Record<string, unknown>} */ (value) : {}
}

/**
 * @param {unknown} value
 */
function toText(value) {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number") return String(value)
  return ""
}

/**
 * @param {string} value
 * @param {RegExp} pattern
 */
function matchFirst(value, pattern) {
  const match = value.match(pattern)
  return match?.[1] ?? ""
}

/**
 * @param {...unknown} values
 */
function firstText(...values) {
  for (const value of values) {
    const text = toText(value)

    if (text) return text
  }

  return null
}

/**
 * @param {unknown} value
 */
function asIsoDate(value) {
  if (typeof value === "number") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
  }

  const text = toText(value)

  if (!text) return null

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10)
  }

  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

/**
 * @param {unknown} value
 */
function normalizeBoardAction(value) {
  const text = toText(value)
  if (!text) return null
  return text.split(";")[0].trim() || null
}

/**
 * @param {Record<string, unknown>} record
 * @param {Record<string, unknown>} license
 * @param {Record<string, unknown>} applicant
 */
function parseApplicantName(record, license, applicant) {
  const firstName = firstText(applicant.FirstName)
  const middleName = firstText(applicant.MiddleName)
  const lastName = firstText(applicant.LastName)

  if (firstName || lastName) {
    return {
      firstName,
      middleName,
      lastName,
    }
  }

  const fullName = firstText(license.Applicant_Full_Name__c, applicant.Name, license.Licensee_Name__c)
  const parsedFullName = fullName ? parseFullName(fullName) : null

  if (parsedFullName) return parsedFullName

  const applicantLabel = firstText(record.Applicant, record.Name)
  const parsedApplicantLabel = applicantLabel ? parseCommaName(applicantLabel) : null

  return (
    parsedApplicantLabel ?? {
      firstName: null,
      middleName: null,
      lastName: null,
    }
  )
}

/**
 * @param {string} value
 */
function parseFullName(value) {
  const parts = value.split(/\s+/).filter(Boolean)

  if (parts.length < 2) return null

  return {
    firstName: parts[0],
    middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : null,
    lastName: parts[parts.length - 1],
  }
}

/**
 * @param {string} value
 */
function parseCommaName(value) {
  const [lastName, rest = ""] = value.split(",")
  const parts = rest.trim().split(/\s+/).filter(Boolean)

  if (!lastName.trim() || parts.length === 0) return null

  return {
    firstName: parts[0],
    middleName: parts.length > 1 ? parts.slice(1).join(" ") : null,
    lastName: lastName.trim(),
  }
}

/**
 * @param {ReturnType<typeof normalizeOhioLicenseRow>} record
 * @param {{
 *   licenseNumber: string,
 *   legalFirstName: string,
 *   legalMiddleName?: string | null,
 *   legalLastName: string,
 * }} input
 * @param {Date} now
 * @returns {OhioMatchResult}
 */
function buildMatchResult(record, input, now) {
  const normalizedExpiration = record.expirationDate ? ohioExpirationDateToDate(record.expirationDate) : null

  return {
    licenseNumber: normalizeLicenseNumber(record.licenseNumber) === normalizeLicenseNumber(input.licenseNumber),
    board: normalizeNamePart(record.board) === normalizeNamePart(OHIO_MASSAGE_BOARD),
    licenseType: normalizeNamePart(record.licenseType) === normalizeNamePart(OHIO_MASSAGE_LICENSE_TYPE),
    status: normalizeNamePart(record.status) === "active",
    expiration: normalizedExpiration ? normalizedExpiration.getTime() >= startOfUtcDay(now).getTime() : false,
    boardAction: normalizeNamePart(record.boardAction) === "no",
    firstName: normalizeNamePart(record.applicantFirstName) === normalizeNamePart(input.legalFirstName),
    middleName: middleNameMatches(input.legalMiddleName, record.applicantMiddleName),
    lastName: normalizeNamePart(record.applicantLastName) === normalizeNamePart(input.legalLastName),
  }
}

/**
 * @param {string | null | undefined} inputMiddleName
 * @param {string | null | undefined} recordMiddleName
 */
function middleNameMatches(inputMiddleName, recordMiddleName) {
  const input = normalizeNamePart(inputMiddleName)

  if (!input) return true

  const record = normalizeNamePart(recordMiddleName)

  if (!record) return false
  if (record === input) return true

  return input.length === 1 ? record.startsWith(input) : record.length === 1 && input.startsWith(record)
}

/**
 * @param {Date} date
 */
function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/**
 * @param {OhioVerificationStatus} status
 * @param {string} reasonCode
 * @param {string} checkedAt
 * @param {OhioMatchResult | null} match
 * @param {OhioMinimalProof | null} proof
 * @returns {OhioDecision}
 */
function decision(status, reasonCode, checkedAt, match, proof) {
  return {
    status,
    reasonCode,
    checkedAt,
    match,
    proof,
  }
}
