import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import { removeForbiddenPreferenceFields } from "@/lib/account-preferences"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [noteTemplates, formTemplates, documentationPreference] = await Promise.all([
    prisma.noteTemplate.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.formTemplate.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.documentationPreference.findUnique({
      where: { userId: session.user.id },
    }),
  ])

  return NextResponse.json({
    noteTemplates,
    formTemplates,
    documentationPreference: documentationPreference?.preferences ?? {},
  })
}

export async function PUT(request: Request) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const documentationPreference = await prisma.documentationPreference.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      preferences: removeForbiddenPreferenceFields(body.documentationPreference ?? {}) as Prisma.InputJsonValue,
    },
    update: {
      preferences: removeForbiddenPreferenceFields(body.documentationPreference ?? {}) as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json({
    documentationPreference: documentationPreference.preferences,
  })
}
