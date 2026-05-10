import type { Breadcrumb, ErrorEvent, Options, SpanJSON, TransactionEvent } from "@sentry/core"
import {
  getSentryEnvironment,
  getSentryTracesSampleRate,
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  sanitizeSentrySpan,
  sanitizeSentryTransaction,
} from "./lib/sentry-privacy"

export function getSentryOptions(): Options {
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN

  return {
    dsn: sentryDsn,
    enabled: Boolean(sentryDsn),
    environment: getSentryEnvironment(),
    sampleRate: 1.0,
    sendDefaultPii: false,
    tracesSampleRate: getSentryTracesSampleRate(),
    maxBreadcrumbs: 20,
    beforeSend(event: ErrorEvent) {
      return sanitizeSentryEvent(event) as ErrorEvent
    },
    beforeSendTransaction(event: TransactionEvent) {
      return sanitizeSentryTransaction(event) as TransactionEvent
    },
    beforeSendSpan(span: SpanJSON) {
      return sanitizeSentrySpan(span) as SpanJSON
    },
    beforeBreadcrumb(breadcrumb: Breadcrumb) {
      return sanitizeSentryBreadcrumb(breadcrumb) as Breadcrumb | null
    },
  }
}
