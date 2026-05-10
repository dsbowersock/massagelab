import * as Sentry from "@sentry/nextjs"
import { getSentryOptions } from "./sentry.options"

Sentry.init(getSentryOptions())
