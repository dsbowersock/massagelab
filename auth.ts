import NextAuth, { CredentialsSignin } from "next-auth"
import type { NextAuthConfig } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { getAuthSecret, getGoogleAuthConfig, getSiteUrl } from "@/lib/auth-env"
import { assertRateLimit, clearAttempts, rateLimitKey, recordFailedAttempt } from "@/lib/auth-rate-limit"
import { ensureGoogleUserState, ensureUserRole, getUserAuthState } from "@/lib/auth-users"
import type { AccountRole } from "@/lib/domain-types"
import {
  decryptSecret,
  normalizeEmail,
  verifyBackupCode,
  verifyPassword,
  verifyTotpCode,
} from "@/lib/auth-security"

if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = getSiteUrl()
}

type LoginErrorCode =
  | "EMAIL_UNVERIFIED"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "TWO_FACTOR_INVALID"
  | "TWO_FACTOR_REQUIRED"

class LoginCredentialsError extends CredentialsSignin {
  code: string

  constructor(code: LoginErrorCode) {
    super()
    this.code = code
  }
}

function loginError(code: LoginErrorCode) {
  return new LoginCredentialsError(code)
}

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown"
}

const providers: NextAuthConfig["providers"] = [
  CredentialsProvider({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      twoFactorCode: { label: "Authenticator or backup code", type: "text" },
    },
    async authorize(credentials, request) {
      const email = normalizeEmail(credentials?.email)
      const password = typeof credentials?.password === "string" ? credentials.password : ""
      const twoFactorCode = typeof credentials?.twoFactorCode === "string" ? credentials.twoFactorCode : ""
      const key = rateLimitKey(email, requestIp(request))

      try {
        await assertRateLimit("LOGIN", key)
      } catch {
        throw loginError("RATE_LIMITED")
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          passwordCredential: true,
          roles: true,
          twoFactorSecret: true,
          backupCodes: {
            where: { usedAt: null },
            orderBy: { createdAt: "asc" },
          },
        },
      })

      const passwordIsValid = user?.passwordCredential
        ? await verifyPassword(user.passwordCredential.passwordHash, password)
        : false

      if (!user || !passwordIsValid) {
        await recordFailedAttempt("LOGIN", key)
        throw loginError("INVALID_CREDENTIALS")
      }

      if (!user.emailVerified) {
        await recordFailedAttempt("LOGIN", key)
        throw loginError("EMAIL_UNVERIFIED")
      }

      if (user.twoFactorSecret?.enabledAt) {
        if (!twoFactorCode) {
          throw loginError("TWO_FACTOR_REQUIRED")
        }

        const secret = decryptSecret(user.twoFactorSecret.encryptedSecret)
        const validTotp = verifyTotpCode(secret, twoFactorCode)
        let validBackupCodeId: string | null = null

        if (!validTotp) {
          for (const backupCode of user.backupCodes) {
            if (await verifyBackupCode(backupCode.codeHash, twoFactorCode)) {
              validBackupCodeId = backupCode.id
              break
            }
          }
        }

        if (!validTotp && !validBackupCodeId) {
          await recordFailedAttempt("TWO_FACTOR", key)
          throw loginError("TWO_FACTOR_INVALID")
        }

        if (validBackupCodeId) {
          await prisma.backupCode.update({
            where: { id: validBackupCodeId },
            data: { usedAt: new Date() },
          })
        }
      }

      await clearAttempts("LOGIN", key)
      await clearAttempts("TWO_FACTOR", key)
      await ensureUserRole(user.id, user.email)

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      }
    },
  }),
]

const googleAuthConfig = getGoogleAuthConfig()

if (googleAuthConfig) {
  providers.push(
    GoogleProvider({
      clientId: googleAuthConfig.clientId,
      clientSecret: googleAuthConfig.clientSecret,
    }),
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: getAuthSecret(),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  providers,
  callbacks: {
    async signIn() {
      return true
    },
    async jwt({ token, user, account }) {
      if (user?.id) {
        token.id = user.id
      }

      const userId = typeof token.id === "string" ? token.id : token.sub

      if (userId) {
        if (account?.provider === "google") {
          await ensureGoogleUserState(userId, user?.email)
        }

        const state = await getUserAuthState(userId)
        token.id = userId
        token.role = state.role
        token.emailVerified = state.emailVerified
        token.twoFactorEnabled = state.twoFactorEnabled
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const sessionUser = session.user as {
          id: string
          role: AccountRole
          emailVerified: boolean
          twoFactorEnabled: boolean
        }

        sessionUser.id = String(token.id ?? token.sub ?? "")
        sessionUser.role = (token.role ?? "USER") as AccountRole
        sessionUser.emailVerified = Boolean(token.emailVerified)
        sessionUser.twoFactorEnabled = Boolean(token.twoFactorEnabled)
      }

      return session
    },
  },
} satisfies NextAuthConfig)

export function getCurrentSession() {
  return auth()
}
