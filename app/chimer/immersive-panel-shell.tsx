"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Clock3, ImageIcon, Palette, X } from "lucide-react"
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

import { calculateDockPlacement } from "./immersive-panel-layout.js"
import styles from "./immersive-panel-shell.module.css"

export type ImmersivePanelId = "clock" | "visual" | "background" | null

interface ImmersivePanelShellProps {
  activePanel: ImmersivePanelId
  onActivePanelChange: (panel: ImmersivePanelId) => void
  protectedDisplayRef: RefObject<HTMLElement | null>
  clockContent: ReactNode
  visualContent: ReactNode
  backgroundContent: ReactNode
  backgroundUnavailableMessage?: string | null
  visualHintMessage?: string | null
  hapticsEnabled: boolean
}

type DockPlacement = ReturnType<typeof calculateDockPlacement>

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

/** Reads layout offsets and dimensions without incorporating ancestor transforms. */
function getStableVerticalBounds(element: HTMLElement) {
  let top = 0
  let current: HTMLElement | null = element

  while (current) {
    top += current.offsetTop
    current = current.offsetParent instanceof HTMLElement ? current.offsetParent : null
  }

  return {
    top,
    bottom: top + element.offsetHeight,
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
  backgroundUnavailableMessage,
  visualHintMessage,
  hapticsEnabled,
}: ImmersivePanelShellProps) {
  const visualHintId = useId()
  const dockRef = useRef<HTMLDivElement | null>(null)
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const toolbarButtonRefs = useRef<Partial<Record<PanelKey, HTMLButtonElement | null>>>({})
  const [placement, setPlacement] = useState<DockPlacement>(DEFAULT_PLACEMENT)
  const nonmodalPanel = activePanel === "clock" || activePanel === "visual" ? activePanel : null
  const activePanelLabel = nonmodalPanel === "clock" ? "Clock" : "Visual"

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
    const stage = protectedDisplay?.closest<HTMLElement>("[data-immersive-stage]")

    if (!protectedDisplay || !dock || !stage || !nonmodalPanel) {
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
        const currentProtectedDisplay = protectedDisplayRef.current ?? observedProtectedDisplay
        if (currentProtectedDisplay !== observedProtectedDisplay) {
          resizeObserver?.unobserve(observedProtectedDisplay)
          resizeObserver?.observe(currentProtectedDisplay)
          observedProtectedDisplay = currentProtectedDisplay
        }

        // Layout offsets remain stable when an inner glow or rotation layer transforms visually.
        const displayBounds = getStableVerticalBounds(currentProtectedDisplay)
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight
        const nextPlacement = calculateDockPlacement({
          viewportHeight,
          displayTop: displayBounds.top,
          displayBottom: displayBounds.bottom,
          panelHeight: dock.scrollHeight,
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
    resizeObserver?.observe(protectedDisplay)
    resizeObserver?.observe(dock)
    window.addEventListener("resize", measure)
    window.addEventListener("orientationchange", measure)
    window.visualViewport?.addEventListener("resize", measure)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      window.removeEventListener("resize", measure)
      window.removeEventListener("orientationchange", measure)
      window.visualViewport?.removeEventListener("resize", measure)
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
  } as CSSProperties

  return (
    <div className={styles.root} style={rootStyle} data-chimer-control="true" data-immersive-shell>
      <TooltipProvider delayDuration={180}>
        <div ref={toolbarRef} className={styles.toolbar} role="group" aria-label="Immersive display controls">
          {PANEL_CONTROLS.map(({ id, label, icon: Icon }) => {
            const isActive = activePanel === id
            const panelId = `immersive-${id}-panel`
            return (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <Button
                    ref={(node) => {
                      toolbarButtonRefs.current[id] = node
                    }}
                    type="button"
                    variant={isActive ? "ctaBlue" : "secondary"}
                    size="compact"
                    className={`${styles.toolbarButton} ${id === "visual" && visualHintMessage ? styles.visualHintActive : ""}`}
                    hapticsEnabled={hapticsEnabled}
                    aria-label={label}
                    aria-expanded={isActive}
                    aria-controls={panelId}
                    aria-describedby={id === "visual" && visualHintMessage ? visualHintId : undefined}
                    onClick={() => onActivePanelChange(isActive ? null : id)}
                  >
                    <Icon className={styles.toolbarIcon} aria-hidden="true" />
                    <span className={styles.toolbarLabel}>{label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">{label}</TooltipContent>
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
          <div className={styles.dockHeader}>
            <h2>{activePanelLabel}</h2>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              hapticsEnabled={hapticsEnabled}
              aria-label={`Close ${activePanelLabel} panel`}
              onClick={() => closeNonmodalPanel(true)}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <div className={styles.dockScroller}>
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
              <DialogPrimitive.Title>Background</DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  hapticsEnabled={hapticsEnabled}
                  aria-label="Close Background panel"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  <span>Close</span>
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
  )
}
