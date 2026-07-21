"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Clock3, ImageIcon, Palette, X } from "lucide-react"
import { createPortal } from "react-dom"
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import { CHIMER_CONTROL_PORTAL_SELECTOR } from "@/components/chimer-controls/GlobalColorPicker"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { triggerHapticFeedback } from "@/lib/haptics"

import { calculateDockPlacement, toVisualViewportBounds } from "./immersive-panel-layout.js"
import styles from "./immersive-panel-shell.module.css"

export type ImmersivePanelId = "clock" | "visual" | "background" | null

interface ImmersivePanelShellProps {
  activePanel: ImmersivePanelId
  onActivePanelChange: (panel: ImmersivePanelId) => void
  protectedDisplayRef: RefObject<HTMLElement | null>
  clockContent: ReactNode
  visualContent: ReactNode
  backgroundContent: ReactNode
  backgroundHeaderContent?: ReactNode
  clockHeaderAction?: ReactNode
  clockHeaderCenterAction?: ReactNode
  visualHeaderAction?: ReactNode
  visualHeaderCenterAction?: ReactNode
  visualHeaderTitle?: string
  backgroundUnavailableMessage?: string | null
  visualHintMessage?: string | null
  hapticsEnabled: boolean
  chromeVisibility: "visible" | "faded" | "hidden"
  toolbarButtonClassName: string
  toolbarButtonActiveClassName: string
}

type DockPlacement = ReturnType<typeof calculateDockPlacement>

type VisualViewportFrame = {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  centerY: number
}

type PanelKey = Exclude<ImmersivePanelId, null>

const DEFAULT_PLACEMENT: DockPlacement = {
  edge: "bottom",
  reservedPx: 0,
  maxPanelPx: 0,
}

const PANEL_CONTROLS = [
  { id: "clock", label: "Clock", icon: Clock3 },
  { id: "visual", label: "Visual", icon: Palette },
  { id: "background", label: "Background", icon: ImageIcon },
] as const

/** Reads a document-space layout offset without incorporating transforms. */
function getStableOffsetTop(element: HTMLElement) {
  let top = 0
  let current: HTMLElement | null = element

  while (current) {
    top += current.offsetTop
    current = current.offsetParent instanceof HTMLElement ? current.offsetParent : null
  }

  return top
}

/**
 * Keeps inner effect rotation out of panel placement while honoring the outer
 * primary display's intentional visual translation.
 */
function getStableVerticalBounds(element: HTMLElement) {
  const top = getStableOffsetTop(element)
  const primaryDisplay = element.closest<HTMLElement>("[data-immersive-primary-display]")
  const primaryTranslationY = primaryDisplay
    ? primaryDisplay.getBoundingClientRect().top + window.scrollY - getStableOffsetTop(primaryDisplay)
    : 0

  return {
    top: top + primaryTranslationY,
    bottom: top + primaryTranslationY + element.offsetHeight,
  }
}

const restoreToolbarFocus = (
  toolbarButtonRefs: RefObject<Partial<Record<PanelKey, HTMLButtonElement | null>>>,
  panelToRestore: PanelKey,
) => {
  window.requestAnimationFrame(() => {
    toolbarButtonRefs.current[panelToRestore]?.focus()
  })
}

/** Keeps nested portaled controls in charge of their own Escape dismissal. */
const shouldIgnoreNonmodalEscape = (target: EventTarget | null) => (
  target instanceof Element && Boolean(target.closest(CHIMER_CONTROL_PORTAL_SELECTOR))
)

export function ImmersivePanelShell({
  activePanel,
  onActivePanelChange,
  protectedDisplayRef,
  clockContent,
  visualContent,
  backgroundContent,
  backgroundHeaderContent,
  clockHeaderAction,
  clockHeaderCenterAction,
  visualHeaderAction,
  visualHeaderCenterAction,
  visualHeaderTitle,
  backgroundUnavailableMessage,
  visualHintMessage,
  hapticsEnabled,
  chromeVisibility,
  toolbarButtonClassName,
  toolbarButtonActiveClassName,
}: ImmersivePanelShellProps) {
  const visualHintId = useId()
  const dockRef = useRef<HTMLDivElement | null>(null)
  const dockInsetProbeRef = useRef<HTMLSpanElement | null>(null)
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const toolbarButtonRefs = useRef<Partial<Record<PanelKey, HTMLButtonElement | null>>>({})
  const [placement, setPlacement] = useState<DockPlacement>(DEFAULT_PLACEMENT)
  const [visualViewportFrame, setVisualViewportFrame] = useState<VisualViewportFrame | null>(null)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const nonmodalPanel = activePanel === "clock" || activePanel === "visual" ? activePanel : null
  const activePanelLabel = nonmodalPanel === "clock" ? "Clock" : "Visual"
  const activeHeaderTitle = nonmodalPanel === "clock" ? "Clock" : (visualHeaderTitle ?? "Visual")
  const activeHeaderAction = nonmodalPanel === "clock" ? clockHeaderAction : visualHeaderAction
  const activeHeaderCenterAction = nonmodalPanel === "clock" ? clockHeaderCenterAction : visualHeaderCenterAction

  useLayoutEffect(() => {
    setPortalTarget(document.body)
  }, [])

  const closeNonmodalPanel = useCallback((restoreFocus: boolean) => {
    if (!nonmodalPanel) {
      return
    }

    const panelToRestore = nonmodalPanel
    onActivePanelChange(null)
    if (restoreFocus) {
      restoreToolbarFocus(toolbarButtonRefs, panelToRestore)
    }
  }, [nonmodalPanel, onActivePanelChange])

  useLayoutEffect(() => {
    const protectedDisplay = protectedDisplayRef.current
    const dock = dockRef.current
    const dockInsetProbe = dockInsetProbeRef.current
    // The body portal cannot discover the timer stage through DOM ancestry,
    // and Music visualizer may intentionally render without a protected clock.
    const stage = protectedDisplay?.closest<HTMLElement>("[data-immersive-stage]")
      ?? document.querySelector<HTMLElement>("[data-immersive-stage]")

    if (!dock || !dockInsetProbe || !stage || !nonmodalPanel) {
      setPlacement(DEFAULT_PLACEMENT)
      stage?.style.setProperty("--immersive-reserved-top", "0px")
      stage?.style.setProperty("--immersive-reserved-bottom", "0px")
      stage?.style.removeProperty("--immersive-panel-max-height")
      return
    }

    let animationFrame = 0
    let observedProtectedDisplay = protectedDisplay
    let resizeObserver: ResizeObserver | null = null
    const measure = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => {
        const currentProtectedDisplay = protectedDisplayRef.current
        if (currentProtectedDisplay !== observedProtectedDisplay) {
          if (observedProtectedDisplay) {
            resizeObserver?.unobserve(observedProtectedDisplay)
          }
          if (currentProtectedDisplay) {
            resizeObserver?.observe(currentProtectedDisplay)
          }
          observedProtectedDisplay = currentProtectedDisplay
        }

        const insetStyles = window.getComputedStyle(dockInsetProbe)
        const dockInsets = {
          top: Number.parseFloat(insetStyles.paddingTop) || 0,
          bottom: Number.parseFloat(insetStyles.paddingBottom) || 0,
        }
        const visualViewport = window.visualViewport
        const viewportTop = visualViewport?.offsetTop ?? 0
        const viewportLeft = visualViewport?.offsetLeft ?? 0
        const viewportWidth = visualViewport?.width ?? window.innerWidth
        const viewportHeight = visualViewport?.height ?? window.innerHeight
        const nextVisualViewportFrame = {
          top: viewportTop,
          left: viewportLeft,
          right: Math.max(0, window.innerWidth - viewportLeft - viewportWidth),
          bottom: Math.max(0, window.innerHeight - viewportTop - viewportHeight),
          width: viewportWidth,
          centerY: viewportTop + (viewportHeight / 2),
        }
        setVisualViewportFrame((current) => (
          current
          && Object.entries(nextVisualViewportFrame).every(
            ([key, value]) => Math.abs(current[key as keyof VisualViewportFrame] - value) < 1,
          )
            ? current
            : nextVisualViewportFrame
        ))
        // Without a visible clock, protect the toolbar itself. A zero-height
        // region lets a full-height bottom dock rise underneath the toolbar,
        // making header controls visible but impossible to click on phones.
        const toolbarBottom = toolbarRef.current
          ? toolbarRef.current.getBoundingClientRect().bottom - viewportTop
          : dockInsets.top
        const displayBounds = currentProtectedDisplay
          ? (() => {
              // Layout offsets remain stable when an inner glow or rotation layer transforms visually.
              const stableDisplayBounds = getStableVerticalBounds(currentProtectedDisplay)
              return toVisualViewportBounds({
                layoutTop: stableDisplayBounds.top,
                layoutBottom: stableDisplayBounds.bottom,
                windowScrollY: window.scrollY,
                visualViewportOffsetTop: visualViewport?.offsetTop ?? 0,
              })
            })()
          : {
              top: dockInsets.top,
              bottom: Math.max(dockInsets.top, toolbarBottom),
            }
        const nextPlacement = calculateDockPlacement({
          viewportHeight,
          displayTop: displayBounds.top,
          displayBottom: displayBounds.bottom,
          panelHeight: dock.scrollHeight,
          topInset: dockInsets.top,
          bottomInset: dockInsets.bottom,
        })

        setPlacement((current) => (
          current.edge === nextPlacement.edge
          && Math.abs(current.reservedPx - nextPlacement.reservedPx) < 1
          && Math.abs(current.maxPanelPx - nextPlacement.maxPanelPx) < 1
            ? current
            : nextPlacement
        ))
        stage.style.setProperty(
          "--immersive-reserved-top",
          nextPlacement.edge === "top" ? `${nextPlacement.reservedPx}px` : "0px",
        )
        stage.style.setProperty(
          "--immersive-reserved-bottom",
          nextPlacement.edge === "bottom" ? `${nextPlacement.reservedPx}px` : "0px",
        )
        stage.style.setProperty("--immersive-panel-max-height", `${nextPlacement.maxPanelPx}px`)
      })
    }

    measure()
    resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure)
    if (protectedDisplay) {
      resizeObserver?.observe(protectedDisplay)
    }
    resizeObserver?.observe(dock)
    window.addEventListener("resize", measure)
    window.addEventListener("orientationchange", measure)
    window.visualViewport?.addEventListener("resize", measure)
    window.visualViewport?.addEventListener("scroll", measure)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      window.removeEventListener("resize", measure)
      window.removeEventListener("orientationchange", measure)
      window.visualViewport?.removeEventListener("resize", measure)
      window.visualViewport?.removeEventListener("scroll", measure)
      stage.style.setProperty("--immersive-reserved-top", "0px")
      stage.style.setProperty("--immersive-reserved-bottom", "0px")
      stage.style.removeProperty("--immersive-panel-max-height")
    }
  }, [nonmodalPanel, protectedDisplayRef])

  useLayoutEffect(() => {
    if (!nonmodalPanel) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }

      if (dockRef.current?.contains(target) || toolbarRef.current?.contains(target)) {
        return
      }

      if (target instanceof Element && target.closest(CHIMER_CONTROL_PORTAL_SELECTOR)) {
        return
      }

      closeNonmodalPanel(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || shouldIgnoreNonmodalEscape(event.target)) {
        return
      }

      event.preventDefault()
      closeNonmodalPanel(true)
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [closeNonmodalPanel, nonmodalPanel])

  const handleBackgroundCloseAutoFocus = (event: Event) => {
    event.preventDefault()
    restoreToolbarFocus(toolbarButtonRefs, "background")
  }

  const rootStyle = {
    "--immersive-reserved-top": placement.edge === "top" ? `${placement.reservedPx}px` : "0px",
    "--immersive-reserved-bottom": placement.edge === "bottom" ? `${placement.reservedPx}px` : "0px",
    "--immersive-panel-max-height": `${placement.maxPanelPx}px`,
    ...(visualViewportFrame ? {
      "--immersive-visual-viewport-top": `${visualViewportFrame.top}px`,
      "--immersive-visual-viewport-left": `${visualViewportFrame.left}px`,
      "--immersive-visual-viewport-right": `${visualViewportFrame.right}px`,
      "--immersive-visual-viewport-bottom": `${visualViewportFrame.bottom}px`,
      "--immersive-visual-viewport-width": `${visualViewportFrame.width}px`,
      "--immersive-visual-viewport-center-y": `${visualViewportFrame.centerY}px`,
    } : {}),
  } as CSSProperties

  if (!portalTarget) {
    return null
  }

  return createPortal((
    <div
      className={[
        styles.root,
        chromeVisibility === "faded" ? styles.rootFaded : "",
        chromeVisibility === "hidden" ? styles.rootHidden : "",
      ].filter(Boolean).join(" ")}
      style={rootStyle}
      data-chimer-control="true"
      data-immersive-shell
    >
      <span
        ref={dockInsetProbeRef}
        className={styles.dockInsetProbe}
        aria-hidden="true"
        data-immersive-inset-probe
      />
      <TooltipProvider delayDuration={180}>
        <div ref={toolbarRef} className={styles.toolbar} role="group" aria-label="Immersive display controls">
          {PANEL_CONTROLS.map(({ id, label, icon: Icon }) => {
            const isActive = activePanel === id
            const panelId = `immersive-${id}-panel`
            return (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <button
                    ref={(node) => {
                      toolbarButtonRefs.current[id] = node
                    }}
                    type="button"
                    className={[
                      styles.toolbarButton,
                      toolbarButtonClassName,
                      isActive ? toolbarButtonActiveClassName : "",
                      id === "visual" && visualHintMessage ? styles.visualHintActive : "",
                    ].filter(Boolean).join(" ")}
                    aria-label={label}
                    aria-expanded={isActive}
                    aria-controls={panelId}
                    aria-describedby={id === "visual" && visualHintMessage ? visualHintId : undefined}
                    onFocus={(event) => {
                      // At high zoom the toolbar is horizontally scrollable; expose the
                      // complete focus outline instead of leaving a partly clipped button.
                      event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })
                    }}
                    onClick={() => {
                      triggerHapticFeedback(hapticsEnabled)
                      onActivePanelChange(isActive ? null : id)
                    }}
                  >
                    <Icon className={styles.toolbarIcon} aria-hidden="true" />
                    <span className={styles.toolbarLabel}>{label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{label}</TooltipContent>
              </Tooltip>
            )
          })}
          {visualHintMessage ? (
            <div
              id={visualHintId}
              className={styles.visualHint}
              role="status"
              aria-label={visualHintMessage}
              data-visual-hint
            >
              {visualHintMessage}
            </div>
          ) : null}
        </div>
      </TooltipProvider>

      {nonmodalPanel ? (
        <div
          ref={dockRef}
          id={`immersive-${nonmodalPanel}-panel`}
          className={styles.dock}
          role="dialog"
          aria-modal="false"
          aria-label={`${activePanelLabel} controls`}
          data-immersive-panel={nonmodalPanel}
          data-immersive-dock={placement.edge}
        >
          <div className={styles.dockHeader} data-immersive-dock-header>
            <h2>{activeHeaderTitle}</h2>
            {activeHeaderAction ? (
              <div className={styles.dockHeaderAction}>{activeHeaderAction}</div>
            ) : null}
            {activeHeaderCenterAction ? (
              <div className={styles.dockHeaderCenterAction}>{activeHeaderCenterAction}</div>
            ) : null}
            <div className={styles.dockHeaderClose}>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                hapticsEnabled={hapticsEnabled}
                aria-label={`Close ${activePanelLabel} panel`}
                onClick={() => closeNonmodalPanel(true)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className={styles.dockScroller} data-immersive-dock-scroller>
            {nonmodalPanel === "clock" ? clockContent : visualContent}
          </div>
        </div>
      ) : null}

      <DialogPrimitive.Root
        open={activePanel === "background"}
        onOpenChange={(open) => {
          if (!open) {
            onActivePanelChange(null)
          }
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className={styles.backgroundOverlay} />
          <DialogPrimitive.Content
            id="immersive-background-panel"
            className={styles.backgroundPanel}
            aria-describedby={undefined}
            data-immersive-panel="background"
            onCloseAutoFocus={handleBackgroundCloseAutoFocus}
          >
            <div className={styles.backgroundHeader}>
              <DialogPrimitive.Title className={styles.backgroundHeaderTitle}>Background</DialogPrimitive.Title>
              <div className={styles.backgroundHeaderFilters}>{backgroundHeaderContent}</div>
              <DialogPrimitive.Close asChild>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  hapticsEnabled={hapticsEnabled}
                  aria-label="Close Background panel"
                  title="Close Background panel"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DialogPrimitive.Close>
            </div>
            {backgroundUnavailableMessage ? (
              <p className={styles.unavailableMessage} role="status">{backgroundUnavailableMessage}</p>
            ) : null}
            <div className={styles.backgroundScroller}>{backgroundContent}</div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  ), portalTarget)
}
