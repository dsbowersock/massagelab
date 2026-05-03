import type { AuthAttemptPurpose } from "@prisma/client"
import { prisma } from "@/lib/prisma"

const WINDOW_MS = 15 * 60 * 1000
const BLOCK_MS = 15 * 60 * 1000

const MAX_ATTEMPTS: Record<AuthAttemptPurpose, number> = {
  LOGIN: 8,
  REGISTER: 5,
  PASSWORD_RESET: 5,
  TWO_FACTOR: 8,
}

export function rateLimitKey(email: string, ip = "unknown") {
  return `${email}:${ip}`
}

export async function assertRateLimit(purpose: AuthAttemptPurpose, key: string) {
  const now = new Date()
  const attempt = await prisma.authAttempt.findUnique({
    where: {
      purpose_key: {
        purpose,
        key,
      },
    },
  })

  if (attempt?.blockedUntil && attempt.blockedUntil > now) {
    throw new Error("RATE_LIMITED")
  }
}

export async function recordFailedAttempt(purpose: AuthAttemptPurpose, key: string) {
  const now = new Date()
  const windowStart = new Date(now.getTime() - WINDOW_MS)
  const existing = await prisma.authAttempt.findUnique({
    where: {
      purpose_key: {
        purpose,
        key,
      },
    },
  })

  const count = !existing || existing.windowStart < windowStart ? 1 : existing.count + 1
  const blockedUntil = count >= MAX_ATTEMPTS[purpose] ? new Date(now.getTime() + BLOCK_MS) : null

  await prisma.authAttempt.upsert({
    where: {
      purpose_key: {
        purpose,
        key,
      },
    },
    create: {
      purpose,
      key,
      count,
      windowStart: now,
      blockedUntil,
    },
    update: {
      count,
      windowStart: !existing || existing.windowStart < windowStart ? now : existing.windowStart,
      blockedUntil,
    },
  })
}

export async function clearAttempts(purpose: AuthAttemptPurpose, key: string) {
  await prisma.authAttempt.deleteMany({
    where: {
      purpose,
      key,
    },
  })
}
