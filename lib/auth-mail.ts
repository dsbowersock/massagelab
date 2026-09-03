import nodemailer from "nodemailer-v9"
import { getSiteUrl } from "./auth-env.ts"
import { buildVerificationEmailUrl } from "./auth-registration.js"
import { consumeOperationalRateLimit } from "./operational-rate-limit.ts"

type MailResult = {
  delivered: boolean
  devLink?: string
}

type MailAttemptClass = "PUBLIC_AUTH" | "SECURITY"

const ACCOUNT_CHANGE_EMAIL_SUBJECT_MAX_LENGTH = 200
const ACCOUNT_CHANGE_EMAIL_MESSAGE_MAX_LENGTH = 5_000
const SMTP_DNS_TIMEOUT_MS = 5_000
const SMTP_CONNECTION_TIMEOUT_MS = 10_000
const SMTP_GREETING_TIMEOUT_MS = 10_000
const SMTP_SOCKET_TIMEOUT_MS = 20_000
const EXISTING_ACCOUNT_NOTICE_SUBJECT = "MassageLab account sign-in request"
const EXISTING_ACCOUNT_NOTICE_MESSAGE =
  "A password registration request was received for this MassageLab account. Sign in with your existing password, or use account recovery if you need to reset it. If you did not make this request, no action is needed."

/**
 * Enforced wall-clock deadline for one account-change SMTP attempt. Admin
 * database transactions finish before SMTP starts; this independent mail
 * deadline is intentionally larger than their short transaction timeout.
 */
export const ACCOUNT_CHANGE_EMAIL_DELIVERY_BUDGET_MS = SMTP_DNS_TIMEOUT_MS
  + SMTP_CONNECTION_TIMEOUT_MS
  + SMTP_GREETING_TIMEOUT_MS
  + SMTP_SOCKET_TIMEOUT_MS

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM && (!process.env.SMTP_USER || process.env.SMTP_PASSWORD))
}

function isMailAttemptClass(value: unknown): value is MailAttemptClass {
  return value === "PUBLIC_AUTH" || value === "SECURITY"
}

/**
 * Delivers a fixed-field text message without exposing Nodemailer's raw message
 * or attachment-loading options to callers. This boundary is intentional while
 * Auth.js does not enable its optional email provider, so MassageLab loads the
 * patched Nodemailer 9 runtime through an alias without falsifying that peer.
 */
async function sendMail(
  mailClass: MailAttemptClass,
  to: string,
  subject: string,
  text: string,
): Promise<MailResult> {
  if (!isMailAttemptClass(mailClass)) {
    return { delivered: false } satisfies MailResult
  }
  if (!hasSmtpConfig()) {
    return { delivered: false } satisfies MailResult
  }

  const decision = await consumeOperationalRateLimit({
    operation: mailClass === "PUBLIC_AUTH" ? "EMAIL_PUBLIC_AUTH" : "EMAIL_SECURITY",
  })
  if (!decision.allowed) {
    // Expected limiter denials are intentionally silent at this shared mail boundary:
    // attacker-triggered denials must not amplify into unbounded logging/Sentry cost.
    // Future aggregate or sampled caller telemetry may include only allowlisted mail class/policy and reason;
    // never recipient, subject, or decision details.
    return { delivered: false } satisfies MailResult
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    disableFileAccess: true,
    disableUrlAccess: true,
    dnsTimeout: SMTP_DNS_TIMEOUT_MS,
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        }
      : undefined,
  })

  let deliveryTimer: ReturnType<typeof setTimeout> | undefined
  try {
    const delivery = transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
    })
    const deadline = new Promise<never>((_resolve, reject) => {
      deliveryTimer = setTimeout(() => {
        try {
          transporter.close()
        } catch {
          // Closing is defensive; the generic delivery failure still wins.
        }
        reject(new Error("SMTP delivery deadline exceeded."))
      }, ACCOUNT_CHANGE_EMAIL_DELIVERY_BUDGET_MS)
    })
    // Promise.race attaches rejection handlers to delivery, so a late provider
    // rejection after the deadline cannot become an unhandled rejection.
    await Promise.race([delivery, deadline])
  } catch {
    // Mail providers can include recipient or transport details in their errors.
    // Callers only need the durable delivery result, never provider diagnostics.
    console.error("SMTP delivery failed")
    return { delivered: false } satisfies MailResult
  } finally {
    if (deliveryTimer !== undefined) clearTimeout(deliveryTimer)
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

  return sendMail("SECURITY", to, subject, message)
}

/** Sends fixed enumeration-safe copy for a password request on an existing account. */
export async function sendExistingAccountRegistrationNotice(email: string): Promise<MailResult> {
  if (!isSafeAccountChangeMailField(email, 320)) {
    return { delivered: false }
  }

  return sendMail(
    "PUBLIC_AUTH",
    email,
    EXISTING_ACCOUNT_NOTICE_SUBJECT,
    EXISTING_ACCOUNT_NOTICE_MESSAGE,
  )
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
    "PUBLIC_AUTH",
    email,
    "Verify your MassageLab email",
    `Verify your MassageLab account by opening this link:\n\n${link}\n\nThis link expires in 24 hours.`,
  )

  return process.env.NODE_ENV === "production" ? result : { ...result, devLink: link }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const link = `${getSiteUrl()}/reset-password?token=${encodeURIComponent(token)}`
  const result = await sendMail(
    "PUBLIC_AUTH",
    email,
    "Reset your MassageLab password",
    `Reset your MassageLab password by opening this link:\n\n${link}\n\nThis link expires in 60 minutes.`,
  )

  return process.env.NODE_ENV === "production" ? result : { ...result, devLink: link }
}

/** Builds one of two fixed setup messages from authoritative linked-method state. */
export function passwordSetupEmailCopy(link: string, googleLinked: boolean) {
  const subject = "Add password sign-in to your MassageLab account"
  const sharedEnding = "This link expires in 60 minutes. If you did not request this, ignore this email and nothing will change."
  const text = googleLinked
    ? `A password registration request was received for the same MassageLab account you already use with Google.\n\nComplete this secure link to add email and password sign-in to that same account:\n\n${link}\n\nThis does not create a duplicate account and does not disconnect Google sign-in. ${sharedEnding}`
    : `A password registration request was received for an existing MassageLab account.\n\nComplete this secure link to add email and password sign-in to that same account:\n\n${link}\n\nThis does not create a duplicate account. Existing sign-in methods remain connected. ${sharedEnding}`
  return { subject, text }
}

/**
 * Sends fixed same-account setup copy selected only from authoritative linked
 * Google state. The reset-token route remains the credential mutation owner.
 */
export async function sendPasswordSetupEmail(email: string, token: string, googleLinked: boolean) {
  const link = `${getSiteUrl()}/reset-password?token=${encodeURIComponent(token)}`
  const copy = passwordSetupEmailCopy(link, googleLinked)
  const result = await sendMail("PUBLIC_AUTH", email, copy.subject, copy.text)

  return process.env.NODE_ENV === "production" ? result : { ...result, devLink: link }
}
