"use client"

import { useEffect, useState, type Dispatch, type ReactElement, type SetStateAction } from "react"
import { Loader } from "@/components/ui/loader"

type RouteLoadingFeedbackOwner = "root" | "link"

export type RouteLoadingFeedbackProps = {
  label?: string
  loaderDelayMs?: number
  owner?: "root" | "link"
}

type RouteFeedbackRegistration = {
  loaderReady: boolean
  owner: RouteLoadingFeedbackOwner
  setPresentation: Dispatch<SetStateAction<RouteFeedbackPresentation>>
}

type RouteFeedbackPresentation = {
  active: boolean
  announce: boolean
}

const routeFeedbackOwnerPriorities: Record<RouteLoadingFeedbackOwner, number> = {
  root: 0,
  link: 1,
}
const routeFeedbackOwners = new Map<symbol, RouteFeedbackRegistration>()
let routeFeedbackAnnouncementOwnerId: symbol | null = null
let routeFeedbackAnnouncementResetTimeoutId: ReturnType<typeof setTimeout> | null = null

/** Preserve one announcement across React's same-turn effect teardown/setup handoff. */
function cancelRouteFeedbackAnnouncementReset() {
  if (routeFeedbackAnnouncementResetTimeoutId === null) return

  clearTimeout(routeFeedbackAnnouncementResetTimeoutId)
  routeFeedbackAnnouncementResetTimeoutId = null
}

/** Clear the journey claim only after the registry remains empty for a task. */
function scheduleRouteFeedbackAnnouncementReset() {
  cancelRouteFeedbackAnnouncementReset()
  routeFeedbackAnnouncementResetTimeoutId = setTimeout(() => {
    routeFeedbackAnnouncementResetTimeoutId = null
    if (routeFeedbackOwners.size === 0) {
      routeFeedbackAnnouncementOwnerId = null
    }
  }, 0)
}

/**
 * Elects one visible feedback surface across a link-owned pending lifetime and
 * any later Next loading fallback. Link ownership wins while present; root
 * ownership remains available for navigations without an instrumented Link.
 */
function publishActiveRouteFeedbackOwner() {
  let activeOwnerId: symbol | null = null
  let activePriority = Number.NEGATIVE_INFINITY

  for (const [ownerId, registration] of routeFeedbackOwners) {
    const priority = routeFeedbackOwnerPriorities[registration.owner]
    if (priority > activePriority) {
      activeOwnerId = ownerId
      activePriority = priority
    }
  }

  const activeRegistration = activeOwnerId
    ? routeFeedbackOwners.get(activeOwnerId)
    : undefined
  if (
    !routeFeedbackAnnouncementOwnerId
    && activeOwnerId
    && activeRegistration?.loaderReady
  ) {
    routeFeedbackAnnouncementOwnerId = activeOwnerId
  }

  for (const [ownerId, registration] of routeFeedbackOwners) {
    const nextPresentation = {
      active: ownerId === activeOwnerId,
      announce: ownerId === activeOwnerId
        && ownerId === routeFeedbackAnnouncementOwnerId,
    }
    registration.setPresentation((currentPresentation) => (
      currentPresentation.active === nextPresentation.active
      && currentPresentation.announce === nextPresentation.announce
        ? currentPresentation
        : nextPresentation
    ))
  }
}

/** Register a pending feedback instance and remove it on settlement/unmount. */
function registerRouteFeedbackOwner(
  ownerId: symbol,
  registration: RouteFeedbackRegistration,
) {
  cancelRouteFeedbackAnnouncementReset()
  routeFeedbackOwners.set(ownerId, registration)
  publishActiveRouteFeedbackOwner()

  return () => {
    routeFeedbackOwners.delete(ownerId)
    if (routeFeedbackOwners.size === 0) {
      scheduleRouteFeedbackAnnouncementReset()
    }
    publishActiveRouteFeedbackOwner()
  }
}

/** Mark an owner's real Loader as delay-ready before electing one announcer. */
function markRouteFeedbackLoaderReady(ownerId: symbol) {
  const registration = routeFeedbackOwners.get(ownerId)
  if (!registration) return

  registration.loaderReady = true
  publishActiveRouteFeedbackOwner()
}

/**
 * Keeps route-segment loading feedback inside Next's loading boundary so the
 * persistent application shell and its long-lived providers never remount.
 */
export function RouteLoadingFeedback({
  label = "Loading page",
  loaderDelayMs = 180,
  owner = "root",
}: RouteLoadingFeedbackProps): ReactElement {
  const [ownerId] = useState(() => Symbol(owner))
  const [presentation, setPresentation] = useState<RouteFeedbackPresentation>({
    active: false,
    announce: false,
  })
  const [showLoader, setShowLoader] = useState(false)

  useEffect(
    () => registerRouteFeedbackOwner(ownerId, {
      loaderReady: false,
      owner,
      setPresentation,
    }),
    [owner, ownerId],
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setShowLoader(true)
      markRouteFeedbackLoaderReady(ownerId)
    }, loaderDelayMs)
    return () => window.clearTimeout(timeout)
  }, [loaderDelayMs, ownerId])

  if (!presentation.active) return <></>

  return (
    <div
      aria-busy="true"
      data-route-feedback-announcement={presentation.announce ? "live" : "visual-only"}
      data-route-feedback-owner={owner}
      data-route-progress="pending"
      className="pointer-events-none fixed inset-x-0 top-0 z-[10030] h-[3px] overflow-visible bg-primary/35 motion-reduce:animate-none"
    >
      <div aria-hidden="true" className="h-full w-2/5 animate-pulse bg-primary motion-reduce:animate-none" />
      {showLoader ? (
        <Loader
          aria-hidden={presentation.announce ? undefined : "true"}
          data-route-loader="shell-safe"
          label={label}
          size={16}
          className="fixed left-1/2 top-20 -translate-x-1/2 text-primary"
        />
      ) : null}
    </div>
  )
}
