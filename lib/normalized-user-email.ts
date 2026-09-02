import { Prisma, type PrismaClient } from "@prisma/client"

type NormalizedEmailClient = Pick<PrismaClient, "$queryRaw">

/**
 * Resolves a User ID through the exact expression enforced by
 * `User_normalized_email_key`. Tagged SQL keeps the email bound as a query
 * parameter; callers perform any richer read by the returned ID.
 */
export async function resolveNormalizedUserId({
  prismaClient,
  email,
}: {
  prismaClient: NormalizedEmailClient
  email: string
}): Promise<string | null> {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : ""
  if (!normalizedEmail || normalizedEmail.length > 320) return null

  const rows = await prismaClient.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "User"
    WHERE "email" IS NOT NULL
      AND lower(btrim("email")) = ${normalizedEmail}
    LIMIT 1
  `)
  return typeof rows[0]?.id === "string" ? rows[0].id : null
}
