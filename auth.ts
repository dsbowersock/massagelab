import NextAuth, { CredentialsSignin } from "next-auth"
import type { NextAuthConfig } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { cookies } from "next/headers"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { googleProfileEmail, isVerifiedGoogleProfile } from "@/lib/auth-account-linking"
import { getAuthSecret, getGoogleAuthConfig, getSiteUrl } from "@/lib/auth-env"
import { verifyPasswordMethodProof } from "@/lib/auth-method-proof"
import { authRequestNetworkIdentifier } from "@/lib/auth-request"
import {
  AUTH_METHOD_INTENT_COOKIE,
  parseAuthMethodIntentBinding,
  prepareGoogleAuthentication,
} from "@/lib/auth-method-intents"
import { ensureGoogleUserState, ensureUserRole, getUserAuthState } from "@/lib/auth-users"
import { decideAuthSessionVersion } from "@/lib/auth-session-version"
import type { AccountCapabilities, AccountRole, VerificationStatus } from "@/lib/domain-types"
import { normalizeEmail } from "@/lib/auth-security"
import { buildRegistrationLegalProviderRedirectPath } from "@/lib/legal-acceptance-gate"

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
      const proof = await verifyPasswordMethodProof({
        prismaClient: prisma,
        email,
        password,
        twoFactorCode,
        networkIdentifier: authRequestNetworkIdentifier(request),
        secret: getAuthSecret(),
      })
      if (proof.status === "INVALID") throw loginError("INVALID_CREDENTIALS")
      if (proof.status !== "VERIFIED") throw loginError(proof.status)

      const user = await prisma.user.findUnique({ where: { id: proof.userId } })
      if (!user) throw loginError("INVALID_CREDENTIALS")
      await ensureUserRole(user.id, user.email)

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        passwordAuthenticatedAt: Date.now(),
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
      profile(profile) {
        const email = googleProfileEmail(profile)

        return {
          id: String(profile.sub),
          name: typeof profile.name === "string" ? profile.name : email,
          email,
          image: typeof profile.picture === "string" ? profile.picture : null,
        }
      },
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
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        // Profile verification remains the first gate; rejected OAuth callbacks
        // always land on a fixed retry surface rather than Auth.js AccessDenied.
        if (!isVerifiedGoogleProfile(profile)) return "/login?auth=google-unavailable"
        const cookieStore = await cookies()
        const binding = parseAuthMethodIntentBinding(cookieStore.get(AUTH_METHOD_INTENT_COOKIE)?.value)
        const currentSession = await auth().catch(() => null)
        const result = await prepareGoogleAuthentication({
          prismaClient: prisma,
          intentId: binding?.intentId ?? "",
          browserBindingToken: binding?.browserBindingToken ?? "",
          profile,
          account,
          currentSessionUser: currentSession?.user,
          secret: getAuthSecret(),
        })
        if (result.kind === "CONTINUE") return true
        if (result.kind === "LINK_REQUIRED") return "/account/link-google"
        // Keep a paused new-account attempt on registration so the user sees
        // launch-control guidance instead of a generic OAuth failure surface.
        if (result.kind === "REGISTRATION_PAUSED") {
          const callbackPath = buildRegistrationLegalProviderRedirectPath(result.callbackPath)
          return `/register?callbackUrl=${encodeURIComponent(callbackPath)}`
        }
        if (result.kind === "REAUTH_COMPLETE") {
          if (result.purpose === "ENROLL_TWO_FACTOR") {
            return "/account?tab=security&reauth=two-factor-enroll"
          }
          if (result.purpose === "DISABLE_TWO_FACTOR") {
            return "/account?tab=security&reauth=two-factor-disable"
          }
          if (result.purpose === "REGENERATE_TWO_FACTOR_BACKUP_CODES") {
            return "/account?tab=security&reauth=two-factor-backup-codes"
          }
          return "/account?tab=security&reauth=complete"
        }
        return result.recoveryPath
      }

      return true
    },
    async jwt({ token, user, account }) {
      const isSignIn = Boolean(user?.id)
      if (user?.id) {
        token.id = user.id
      }
      if (account?.provider === "credentials" && Number.isFinite(user?.passwordAuthenticatedAt)) {
        token.lastPasswordAuthenticatedAt = user.passwordAuthenticatedAt
      } else if (isSignIn) {
        delete token.lastPasswordAuthenticatedAt
      }

      const userId = typeof token.id === "string" ? token.id : token.sub

      if (userId) {
        token.id = userId
        try {
          if (account?.provider === "google") {
            await ensureGoogleUserState(userId, user?.email)
          }

          const state = await getUserAuthState(userId)
          const versionDecision = decideAuthSessionVersion({
            currentVersion: state.authSessionVersion,
            tokenVersion: token.authSessionVersion,
            isSignIn,
          })
          if (!versionDecision.accepted) return null

          token.authSessionVersion = versionDecision.version
          token.role = state.role
          token.roles = state.roles
          token.roleAssignments = state.roleAssignments
          token.capabilities = state.capabilities
          token.featureKeys = state.featureKeys
          token.emailVerified = state.emailVerified
          token.twoFactorEnabled = state.twoFactorEnabled
        } catch (error) {
          logAuthStateRefreshError(error)
          // If account-state refresh fails, keep identity but drop privileges until the database is readable again.
          token.role = "USER"
          token.roles = ["USER"]
          token.roleAssignments = [{ role: "USER", status: "VERIFIED" }]
          token.capabilities = defaultAccountCapabilities("USER")
          token.featureKeys = []
          token.emailVerified = false
          token.twoFactorEnabled = false
        }
      }

      return token
    },
    async session({ session, token }) {
      session.lastPasswordAuthenticatedAt = Number.isFinite(token.lastPasswordAuthenticatedAt)
        ? token.lastPasswordAuthenticatedAt
        : undefined
      if (session.user) {
        const sessionUser = session.user as {
          id: string
          role: AccountRole
          roles: AccountRole[]
          roleAssignments: Array<{ role: AccountRole; status: VerificationStatus }>
          capabilities: AccountCapabilities
          featureKeys: string[]
          emailVerified: boolean
          twoFactorEnabled: boolean
        }

        sessionUser.id = String(token.id ?? token.sub ?? "")
        sessionUser.role = (token.role ?? "USER") as AccountRole
        sessionUser.roles = Array.isArray(token.roles) ? (token.roles as AccountRole[]) : [sessionUser.role]
        sessionUser.roleAssignments = Array.isArray(token.roleAssignments)
          ? (token.roleAssignments as Array<{ role: AccountRole; status: VerificationStatus }>)
          : sessionUser.roles.map((role) => ({ role, status: "VERIFIED" as VerificationStatus }))
        sessionUser.capabilities = (token.capabilities ?? defaultAccountCapabilities(sessionUser.role)) as AccountCapabilities
        sessionUser.featureKeys = Array.isArray(token.featureKeys)
          ? token.featureKeys.filter((value): value is string => typeof value === "string")
          : []
        sessionUser.emailVerified = Boolean(token.emailVerified)
        sessionUser.twoFactorEnabled = Boolean(token.twoFactorEnabled)
      }

      return session
    },
  },
} satisfies NextAuthConfig)

export function getCurrentSession() {
  // Local visual-review routes must remain usable without copying account
  // secrets into disposable worktrees. Production still always invokes Auth.js.
  if (process.env.NODE_ENV !== "production" && !getAuthSecret()) {
    return Promise.resolve(null)
  }

  return auth()
}

function defaultAccountCapabilities(role: AccountRole): AccountCapabilities {
  return {
    canAdministerAccounts: role === "ADMIN",
    canManageAnatomyContent: role === "ADMIN" || role === "ANATOMY_ADMIN",
    canManageClients: false,
    canRequestCredentials: true,
    canUseLocalClinicalTools: false,
    canUsePremiumBackgrounds: false,
    hasActiveMembershipBenefits: false,
    hostedClinicalSyncEnabled: false,
  }
}

function logAuthStateRefreshError(error: unknown) {
  console.warn("Using restricted session account state fallback", { error: summarizeAuthCallbackError(error) })
}

function summarizeAuthCallbackError(error: unknown) {
  if (!error || typeof error !== "object") {
    return { name: typeof error }
  }

  const maybeError = error as { name?: unknown; code?: unknown; cause?: unknown }
  const cause = maybeError.cause && typeof maybeError.cause === "object"
    ? maybeError.cause as { code?: unknown; kind?: unknown }
    : undefined

  return {
    name: typeof maybeError.name === "string" ? maybeError.name : "Error",
    code: typeof maybeError.code === "string" ? maybeError.code : undefined,
    causeCode: typeof cause?.code === "string" ? cause.code : undefined,
    causeKind: typeof cause?.kind === "string" ? cause.kind : undefined,
  }
}
