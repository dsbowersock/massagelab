import { NextResponse } from "next/server"

import { noStoreJsonHeaders } from "@/lib/account-security-request"
import type { parseTrustedAccountSecurityJson } from "@/lib/account-security-request"
import { AUTH_METHOD_INTENT_COOKIE } from "@/lib/auth-method-intents"
import type { TwoFactorManagementFailureCode } from "@/lib/account-two-factor-management"

type ManageBody =
  | { proofMethod: "PASSWORD"; password: string; twoFactorCode: string; confirmed: true }
  | { proofMethod: "GOOGLE"; twoFactorCode: string; confirmed: true }

/** Parses the exact shared PASSWORD/GOOGLE body accepted by destructive 2FA management routes. */
export async function parseManageRequest(
  request: Request,
  expectedSiteUrl: string,
  parseRequest: typeof parseTrustedAccountSecurityJson,
): Promise<{ ok: true; body: ManageBody } | { ok: false; code: "UNTRUSTED_REQUEST" | "INVALID_REQUEST" }> {
  const parsed = await parseRequest({
    request,
    expectedSiteUrl,
    allowedKeySets: [
      ["proofMethod", "twoFactorCode", "confirmed"],
      ["proofMethod", "password", "twoFactorCode", "confirmed"],
    ],
  })
  if (!parsed.ok) return parsed
  if (
    parsed.body.proofMethod === "GOOGLE"
    && !Object.hasOwn(parsed.body, "password")
    && typeof parsed.body.twoFactorCode === "string"
    && parsed.body.confirmed === true
  ) {
    return {
      ok: true,
      body: { proofMethod: "GOOGLE", twoFactorCode: parsed.body.twoFactorCode, confirmed: true },
    }
  }
  if (
    parsed.body.proofMethod !== "PASSWORD"
    || typeof parsed.body.password !== "string"
    || typeof parsed.body.twoFactorCode !== "string"
    || parsed.body.confirmed !== true
  ) {
    return { ok: false, code: "INVALID_REQUEST" }
  }
  return {
    ok: true,
    body: {
      proofMethod: "PASSWORD",
      password: parsed.body.password,
      twoFactorCode: parsed.body.twoFactorCode,
      confirmed: true,
    },
  }
}

/** Maps request-boundary rejections to the shared code-only, no-store response contract. */
export function requestFailure(code: "UNTRUSTED_REQUEST" | "INVALID_REQUEST") {
  return jsonCode(code, code === "UNTRUSTED_REQUEST" ? 403 : 400)
}

/** Maps private service outcomes onto the shared allowlisted public status contract. */
export function serviceFailure(
  code: TwoFactorManagementFailureCode | "AUTHENTICATION_REQUIRED",
  retryAfterSeconds?: number,
) {
  if (code === "RATE_LIMITED") {
    return jsonCode("RATE_LIMITED", 429, { "Retry-After": retryAfterHeader(retryAfterSeconds) })
  }
  const status = failureStatus(code)
  return status === null ? jsonCode("CONFLICT", 409) : jsonCode(code, status)
}

/** Reads one cookie without widening the routes' accepted request surface. */
export function readCookie(request: Request, name: string) {
  const prefix = `${name}=`
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length) ?? ""
}

/** Retires the one-use Google proof binding only after its consuming mutation commits. */
export function clearGoogleBindingCookie(response: ReturnType<typeof NextResponse.json>, secure: boolean) {
  response.cookies.set(AUTH_METHOD_INTENT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    secure,
    path: "/",
  })
}

function retryAfterHeader(value?: number) {
  return String(Number.isSafeInteger(value) && (value ?? 0) > 0 ? Math.min(value ?? 1, 900) : 1)
}

function failureStatus(code: TwoFactorManagementFailureCode | "AUTHENTICATION_REQUIRED"): number | null {
  if (code === "AUTHENTICATION_REQUIRED") return 401
  if (code === "INVALID_REQUEST" || code === "TWO_FACTOR_REQUIRED") return 400
  if (
    code === "PRIMARY_PROOF_INVALID"
    || code === "GOOGLE_PROOF_EXPIRED"
    || code === "TWO_FACTOR_INVALID"
    || code === "ENROLLMENT_EXPIRED"
  ) return 403
  if (code === "PASSWORD_REQUIRED" || code === "ALREADY_ENABLED" || code === "NOT_ENABLED" || code === "CONFLICT") return 409
  return null
}

function jsonCode(code: string, status: number, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json({ code }, {
    status,
    headers: { ...noStoreJsonHeaders(), ...extraHeaders },
  })
}
