import "server-only"

import { getCurrentSession } from "@/auth"
import { cache } from "react"

/** Shares one auth loader result only within the current React Server Component request. */
export const getCurrentRscSession = cache(getCurrentSession)
