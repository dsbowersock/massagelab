import nodemailer from "nodemailer"
import { getSiteUrl } from "@/lib/auth-env"
import { safePostLegalAcceptanceCallback } from "@/lib/legal-acceptance-gate"

type MailResult = {
  delivered: boolean
  devLink?: string
}

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM && (!process.env.SMTP_USER || process.env.SMTP_PASSWORD))
}

async function sendMail(to: string, subject: string, text: string): Promise<MailResult> {
  if (!hasSmtpConfig()) {
    return { delivered: false } satisfies MailResult
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        }
      : undefined,
  })

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
    })
  } catch (error) {
    console.error("SMTP delivery failed", error)
    return { delivered: false } satisfies MailResult
  }

  return { delivered: true } satisfies MailResult
}

/**
 * Builds a verification link that can resume an app-local registration flow
 * after the user verifies their email and signs in.
 */
export function buildVerificationEmailLink(token: string, callbackUrl?: string) {
  const params = new URLSearchParams({ token })
  if (callbackUrl) {
    params.set("callbackUrl", safePostLegalAcceptanceCallback(callbackUrl))
  }
  return `${getSiteUrl()}/verify-email?${params.toString()}`
}

export async function sendVerificationEmail(email: string, token: string, callbackUrl?: string) {
  const link = buildVerificationEmailLink(token, callbackUrl)
  const result = await sendMail(
    email,
    "Verify your MassageLab email",
    `Verify your MassageLab account by opening this link:\n\n${link}\n\nThis link expires in 24 hours.`,
  )

  return process.env.NODE_ENV === "production" ? result : { ...result, devLink: link }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const link = `${getSiteUrl()}/reset-password?token=${encodeURIComponent(token)}`
  const result = await sendMail(
    email,
    "Reset your MassageLab password",
    `Reset your MassageLab password by opening this link:\n\n${link}\n\nThis link expires in 60 minutes.`,
  )

  return process.env.NODE_ENV === "production" ? result : { ...result, devLink: link }
}
