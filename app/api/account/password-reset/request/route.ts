import { NextResponse } from "next/server"
import { getAuthSecret } from "@/lib/auth-env"
import { sendPasswordResetEmail } from "@/lib/auth-mail"
import { consumeEmailWorkRateLimit } from "@/lib/auth-rate-limit"
import { generateRandomToken, hashToken, normalizeEmail, tokenExpiresIn } from "@/lib/auth-security"
import { prisma } from "@/lib/prisma"

const PASSWORD_RESET_MESSAGE = "If that email is registered, a reset link has been sent."
const RATE_LIMIT_MESSAGE = "Too many requests. Please try again later."

type PasswordResetRequestDependencies = {
  prismaClient: typeof prisma
  secret: string
  clock?: () => Date
  shouldPrune?: () => boolean
  resetWork?: (email: string) => Promise<{ devLink?: string }>
}

/** Builds the route orchestration with injectable work so limiter ordering is testable. */
export function createPasswordResetRequestHandler({
  prismaClient,
  secret,
  clock = () => new Date(),
  shouldPrune,
  resetWork = performPasswordResetWork,
}: PasswordResetRequestDependencies) {
  return async function passwordResetRequestHandler(request: Request) {
    const body = await request.json().catch(() => ({}))
    const email = normalizeEmail(body.email)
    const decision = await consumeEmailWorkRateLimit({
      prismaClient,
      purpose: "PASSWORD_RESET",
      email,
      networkIdentifier: requestIp(request),
      secret,
      now: clock(),
      shouldPrune,
    })

    if (!decision.allowed) {
      return NextResponse.json(
        { message: RATE_LIMIT_MESSAGE },
        { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } },
      )
    }
    if (!email) return NextResponse.json({ message: PASSWORD_RESET_MESSAGE })

    const result = await resetWork(email)
    return NextResponse.json({ message: PASSWORD_RESET_MESSAGE, ...result })
  }
}

async function performPasswordResetWork(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user?.emailVerified) return {}

  const resetToken = generateRandomToken()
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(resetToken),
      expiresAt: tokenExpiresIn(60),
    },
  })
  const mailResult = await sendPasswordResetEmail(email, resetToken)
  return mailResult.devLink ? { devLink: mailResult.devLink } : {}
}

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown"
}

export const POST = createPasswordResetRequestHandler({
  prismaClient: prisma,
  secret: getAuthSecret(),
})
