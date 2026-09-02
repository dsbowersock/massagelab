import "server-only"

import { getCurrentSession } from "@/auth"
import { getCurrentSession as getCurrentSessionWithProof } from "@/lib/rsc-session-proof"
import { cache } from "react"

// Only the isolated Browser-QA build selects the content-free entry counter;
// route handlers and mutations continue importing the direct auth owner.
const loadCurrentRscSession = process.env.NEXT_PUBLIC_RSC_SESSION_PROOF === "1"
  ? getCurrentSessionWithProof
  : getCurrentSession

/** Shares one selected auth-loader result only within the current React Server Component request. */
export const getCurrentRscSession = cache(loadCurrentRscSession)
