import nodemailer from "nodemailer-v9"
import { getSiteUrl } from "./auth-env.ts"
import { buildVerificationEmailUrl } from "./auth-registration.js"

type MailResult = {
  delivered: boolean
  devLink?: string
}

const ACCOUNT_CHANGE_EMAIL_SUBJECT_MAX_LENGTH = 200
const ACCOUNT_CHANGE_EMAIL_MESSAGE_MAX_LENGTH = 5_000

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM && (!process.env.SMTP_USER || process.env.SMTP_PASSWORD))
}

/**
 * Delivers a fixed-field text message without exposing Nodemailer's raw message
 * or attachment-loading options to callers. This boundary is intentional while
 * Auth.js does not enable its optional email provider, so MassageLab loads the
 * patched Nodemailer 9 runtime through an alias without falsifying that peer.
 */
async function sendMail(to: string, subject: string, text: string): Promise<MailResult> {
  if (!hasSmtpConfig()) {
    return { delivered: false } satisfies MailResult
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    disableFileAccess: true,
    disableUrlAccess: true,
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
  } catch {
    // Mail providers can include recipient or transport details in their errors.
    // Callers only need the durable delivery result, never provider diagnostics.
    console.error("SMTP delivery failed")
    return { delivered: false } satisfies MailResult
  }

  return { delivered: true } satisfies MailResult
}

/**
 * Sends the bounded, plain-text account-change notification already persisted
 * by the admin-operation service. This is intentionally not a general mail
 * API: no HTML, attachments, provider options, or provider error details cross
 * the account-operation boundary.
 */
export async function sendAccountChangeEmail(to: string, subject: string, message: string): Promise<MailResult> {
  if (!isSafeAccountChangeMailField(to, 320) || !isSafeAccountChangeMailField(subject, ACCOUNT_CHANGE_EMAIL_SUBJECT_MAX_LENGTH)
    || !isSafeAccountChangeMailField(message, ACCOUNT_CHANGE_EMAIL_MESSAGE_MAX_LENGTH, true)) {
    return { delivered: false }
  }

  return sendMail(to, subject, message)
}

function isSafeAccountChangeMailField(value: string, maxLength: number, allowLineBreaks = false): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && (allowLineBreaks || !/[\r\n]/.test(value))
}

/**
 * Builds the verification URL for a token and optional post-login callback.
 *
 * @param token Opaque email-verification token placed in the verification URL.
 * @param callbackUrl Optional app-local destination to resume after sign-in.
 * @returns An absolute MassageLab verification URL. Unsafe callback values are
 * replaced by the account flow's safe fallback destination.
 */
export function buildVerificationEmailLink(token: string, callbackUrl?: string) {
  return buildVerificationEmailUrl(getSiteUrl(), token, callbackUrl)
}

/**
 * Sends an account-verification email with an optional post-login destination.
 *
 * @param email Recipient email address.
 * @param token Opaque verification token.
 * @param callbackUrl Optional app-local destination; verification-link
 * generation sanitizes unsafe values to the account flow's fallback.
 */
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
