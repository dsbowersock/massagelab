import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  OHIO_APEX_REMOTE_URL,
  OHIO_LICENSE_LOOKUP_URL,
  buildOhioLicenseSearchPayload,
  decideOhioMassageLicenseVerification,
  extractOhioRemotingContext,
  extractOhioRowsFromApexResponse,
  normalizeOhioLicenseRow,
  verifyOhioMassageLicense,
} from "../lib/ohio-license-verifier.js"

const NOW = new Date("2026-05-05T12:00:00.000Z")
const MATCHING_INPUT = {
  licenseNumber: "33.123456",
  legalFirstName: "Jane",
  legalMiddleName: "Q",
  legalLastName: "Sample",
}

function activeMassageRow(overrides = {}) {
  return {
    Applicant: "Sample , Jane Q",
    Board: "Medical Board",
    BoardAction: "No;a0Record",
    City: "Columbus",
    ExpirationDate: "2027-04-01",
    LicenseId: "a0Record",
    RecNumber: "33.123456",
    State: "OH",
    Status: "Active",
    Type: "Massage Therapist (MT)",
    streetaddress: "not stored",
    zipcode: "not stored",
    license: {
      Id: "a0Record",
      Name: "33.123456",
      Applicant_Full_Name__c: "Jane Q Sample",
      Board__c: "Medical Board",
      MUSW__Type__c: "Massage Therapist (MT)",
      Applicant_City__c: "Columbus",
      Applicant_State__c: "OH",
      Board_Action__c: "No",
      MUSW__Status__c: "Active",
      MUSW__Issue_Date__c: Date.parse("2021-01-02T00:00:00.000Z"),
      MUSW__Expiration_Date__c: Date.parse("2027-04-01T00:00:00.000Z"),
      Effective_Date__c: Date.parse("2025-03-06T00:00:00.000Z"),
      Compact_Eligible__c: false,
      MUSW__Applicant__r: {
        FirstName: "Jane",
        MiddleName: "Q",
        LastName: "Sample",
        Aliases__c: "not stored",
      },
    },
    ...overrides,
  }
}

function decide(rows, input = MATCHING_INPUT) {
  return decideOhioMassageLicenseVerification({
    rows,
    input,
    now: NOW,
    checkedAt: NOW.toISOString(),
  })
}

describe("Ohio eLicense verifier", () => {
  it("extracts Visualforce remoting values and builds the public lookup payload", () => {
    const html = `
      <script>
        Visualforce.remoting.Manager.add({
          "vf":{"vid":"066TEST"},
          "actions":{"OH_VerifyLicenseCtlr":{"ms":[
            {"name":"findLicensesForOwner","len":1,"ns":"","ver":41,"csrf":"CSRFTEST","authorization":"AUTHTEST"}
          ]}}
        })
      </script>
    `

    const context = extractOhioRemotingContext(html)
    const payload = buildOhioLicenseSearchPayload({
      context,
      licenseNumber: "33.123456",
      legalFirstName: "Jane",
      legalMiddleName: "Q",
      legalLastName: "Sample",
    })

    assert.deepEqual(context, {
      vid: "066TEST",
      csrf: "CSRFTEST",
      authorization: "AUTHTEST",
    })
    assert.equal(payload[0].action, "OH_VerifyLicenseCtlr")
    assert.equal(payload[0].method, "findLicensesForOwner")
    assert.equal(payload[0].data[0].board, "Medical Board")
    assert.equal(payload[0].data[0].licenseType, "Massage Therapist (MT)")
    assert.equal(payload[0].data[0].licenseNumber, "33.123456")
    assert.equal(payload[0].data[0].searchType, "individual")
  })

  it("normalizes Ohio rows to minimal proof without address, alias, license object, or raw response storage", () => {
    const normalized = normalizeOhioLicenseRow(activeMassageRow(), NOW.toISOString())

    assert.equal(normalized.proof.sourceName, "Ohio eLicense")
    assert.equal(normalized.proof.ohioRecordId, "a0Record")
    assert.equal(normalized.proof.licenseNumber, "33.123456")
    assert.equal(normalized.proof.issueDate, "2021-01-02")
    assert.equal(normalized.proof.effectiveDate, "2025-03-06")
    assert.equal(normalized.proof.expirationDate, "2027-04-01")
    assert.equal(Object.hasOwn(normalized.proof, "streetaddress"), false)
    assert.equal(Object.hasOwn(normalized.proof, "zipcode"), false)
    assert.equal(Object.hasOwn(normalized.proof, "license"), false)
    assert.equal(Object.hasOwn(normalized.proof, "Aliases__c"), false)
  })

  it("verifies an active unexpired Medical Board massage therapist license with matching legal name", () => {
    const result = decide([activeMassageRow()])

    assert.equal(result.status, "VERIFIED")
    assert.equal(result.reasonCode, "OHIO_VERIFIED")
    assert.equal(result.match?.firstName, true)
    assert.equal(result.match?.middleName, true)
    assert.equal(result.match?.lastName, true)
    assert.equal(result.proof?.boardAction, "No")
  })

  it("keeps name mismatches pending", () => {
    const result = decide([activeMassageRow()], {
      ...MATCHING_INPUT,
      legalLastName: "Different",
    })

    assert.equal(result.status, "PENDING")
    assert.equal(result.reasonCode, "NAME_MISMATCH")
    assert.equal(result.match?.lastName, false)
  })

  it("keeps board actions pending for manual review", () => {
    const row = activeMassageRow({
      BoardAction: "Yes;a0Record",
      license: {
        ...activeMassageRow().license,
        Board_Action__c: "Yes",
      },
    })
    const result = decide([row])

    assert.equal(result.status, "PENDING")
    assert.equal(result.reasonCode, "BOARD_ACTION_REVIEW")
    assert.equal(result.match?.boardAction, false)
  })

  it("rejects expired and inactive licenses", () => {
    const expired = decide([
      activeMassageRow({
        ExpirationDate: "2024-01-01",
        license: {
          ...activeMassageRow().license,
          MUSW__Expiration_Date__c: Date.parse("2024-01-01T00:00:00.000Z"),
        },
      }),
    ])
    const inactive = decide([
      activeMassageRow({
        Status: "Inactive",
        license: {
          ...activeMassageRow().license,
          MUSW__Status__c: "Inactive",
        },
      }),
    ])

    assert.equal(expired.status, "REJECTED")
    assert.equal(expired.reasonCode, "EXPIRED_LICENSE")
    assert.equal(inactive.status, "REJECTED")
    assert.equal(inactive.reasonCode, "INACTIVE_LICENSE")
  })

  it("rejects wrong board and wrong license type records", () => {
    const wrongBoard = decide([
      activeMassageRow({
        Board: "Nursing Board",
        license: {
          ...activeMassageRow().license,
          Board__c: "Nursing Board",
        },
      }),
    ])
    const wrongType = decide([
      activeMassageRow({
        Type: "Physician (MD)",
        license: {
          ...activeMassageRow().license,
          MUSW__Type__c: "Physician (MD)",
        },
      }),
    ])

    assert.equal(wrongBoard.status, "REJECTED")
    assert.equal(wrongBoard.reasonCode, "WRONG_BOARD")
    assert.equal(wrongType.status, "REJECTED")
    assert.equal(wrongType.reasonCode, "WRONG_LICENSE_TYPE")
  })

  it("keeps multiple possible records pending", () => {
    const result = decide([
      activeMassageRow(),
      activeMassageRow({
        LicenseId: "a0Second",
        license: {
          ...activeMassageRow().license,
          Id: "a0Second",
        },
      }),
    ])

    assert.equal(result.status, "PENDING")
    assert.equal(result.reasonCode, "MULTIPLE_MATCHING_LICENSES")
  })

  it("extracts result rows from the Visualforce remoting envelope", () => {
    const row = activeMassageRow()
    const rows = extractOhioRowsFromApexResponse([
      {
        statusCode: 200,
        result: [row],
      },
    ])

    assert.deepEqual(rows, [row])
  })

  it("runs the fetch-based verifier without browser automation", async () => {
    const html = `
      {"vid":"066TEST"}
      {"name":"findLicensesForOwner","csrf":"CSRFTEST","authorization":"AUTHTEST"}
    `
    const calls = []
    const fetchImpl = async (url, init = {}) => {
      calls.push({ url, init })

      if (url === OHIO_LICENSE_LOOKUP_URL) {
        return {
          ok: true,
          text: async () => html,
        }
      }

      if (url === OHIO_APEX_REMOTE_URL) {
        return {
          ok: true,
          json: async () => [
            {
              statusCode: 200,
              result: [activeMassageRow()],
            },
          ],
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    }

    const result = await verifyOhioMassageLicense({
      ...MATCHING_INPUT,
      fetchImpl,
      now: NOW,
    })
    const postedBody = JSON.parse(calls[1].init.body)

    assert.equal(result.status, "VERIFIED")
    assert.equal(calls[0].url, OHIO_LICENSE_LOOKUP_URL)
    assert.equal(calls[1].url, OHIO_APEX_REMOTE_URL)
    assert.equal(calls[1].init.method, "POST")
    assert.equal(postedBody[0].data[0].board, "Medical Board")
    assert.equal(postedBody[0].data[0].licenseType, "Massage Therapist (MT)")
  })
})
