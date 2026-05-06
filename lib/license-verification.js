// @ts-check

export const US_MASSAGE_JURISDICTIONS = /** @type {const} */ ([
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "District of Columbia"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
])

const JURISDICTION_OVERRIDES = Object.freeze({
  OH: {
    massageBoardName: "State Medical Board of Ohio",
    lookupUrl: "https://elicense.ohio.gov/OH_VerifyLicense",
    supportStatus: "ADAPTER_AVAILABLE",
    notes: "Ohio eLicense is the primary public lookup source and MassageLab can run an automatic verifier for Ohio massage therapy licenses.",
  },
})

/**
 * @param {unknown} value
 */
export function normalizeJurisdictionCode(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : ""
}

/**
 * @param {unknown} value
 */
export function findMassageJurisdiction(value) {
  const code = normalizeJurisdictionCode(value)
  const match = US_MASSAGE_JURISDICTIONS.find(([jurisdictionCode]) => jurisdictionCode === code)

  if (!match) {
    return null
  }

  const override = JURISDICTION_OVERRIDES[/** @type {keyof typeof JURISDICTION_OVERRIDES} */ (code)]

  return {
    jurisdictionCode: match[0],
    jurisdictionName: match[1],
    countryCode: "US",
    massageBoardName: override?.massageBoardName ?? null,
    lookupUrl: override?.lookupUrl ?? null,
    supportStatus: override?.supportStatus ?? "MANUAL_REVIEW_REQUIRED",
    compactEligible: false,
    compactStatus: "not-active",
    notes: override?.notes ?? "No automated MassageLab verifier is available yet; use pending/manual review.",
  }
}

/**
 * @param {unknown} value
 */
export function getJurisdictionVerificationPlan(value) {
  const jurisdiction = findMassageJurisdiction(value)

  if (!jurisdiction) {
    return {
      supported: false,
      jurisdictionCode: normalizeJurisdictionCode(value),
      supportStatus: "UNSUPPORTED",
      sourceType: "MANUAL_REVIEW",
      sourceUrl: null,
      message: "MassageLab does not recognize that jurisdiction yet.",
    }
  }

  return {
    supported: true,
    jurisdictionCode: jurisdiction.jurisdictionCode,
    jurisdictionName: jurisdiction.jurisdictionName,
    supportStatus: jurisdiction.supportStatus,
    sourceType: jurisdiction.lookupUrl ? "STATE_LICENSE_LOOKUP" : "MANUAL_REVIEW",
    sourceUrl: jurisdiction.lookupUrl,
    message:
      jurisdiction.supportStatus === "ADAPTER_AVAILABLE"
        ? "Automatic license verification is available for this jurisdiction."
        : jurisdiction.lookupUrl
          ? "Public license lookup is available, but MassageLab will keep the role pending until verification is completed."
          : "This jurisdiction needs pending/manual review until a reliable verifier is added.",
  }
}
