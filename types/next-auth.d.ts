import type { Role } from "@prisma/client"
import type { DefaultSession } from "next-auth"
import type { AccountCapabilities, VerificationStatus } from "@/lib/domain-types"

declare module "next-auth" {
  interface Session {
    user: Omit<NonNullable<DefaultSession["user"]>, "emailVerified"> & {
      id: string
      role: Role
      roles: Role[]
      roleAssignments: Array<{ role: Role; status: VerificationStatus }>
      capabilities: AccountCapabilities
      emailVerified: boolean
      twoFactorEnabled: boolean
    }
  }

  interface User {
    id: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: Role
    roles?: Role[]
    roleAssignments?: Array<{ role: Role; status: VerificationStatus }>
    capabilities?: AccountCapabilities
    emailVerified?: boolean
    twoFactorEnabled?: boolean
  }
}
