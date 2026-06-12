"use client"

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"

type AnatomyBrowserStickyFrameProps = {
  toolbar: ReactNode
  children: ReactNode
}

export function AnatomyBrowserStickyFrame({ toolbar, children }: AnatomyBrowserStickyFrameProps) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [toolbarHeight, setToolbarHeight] = useState(0)
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    const updateToolbarHeight = () => {
      setToolbarHeight(Math.ceil(toolbarRef.current?.getBoundingClientRect().height ?? 0))
    }

    updateToolbarHeight()

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateToolbarHeight)
    if (toolbarRef.current) {
      resizeObserver?.observe(toolbarRef.current)
    }
    window.addEventListener("resize", updateToolbarHeight)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener("resize", updateToolbarHeight)
    }
  }, [])

  useEffect(() => {
    const toolbarElement = toolbarRef.current
    const scrollRoot = toolbarElement?.closest(".ml-app-scroll")
    const scrollElement = scrollRoot instanceof HTMLElement ? scrollRoot : null
    const compactOffset = 96
    const updateCompactState = () => {
      const scrollTop = scrollElement ? scrollElement.scrollTop : window.scrollY
      setIsCompact(scrollTop > compactOffset)
    }

    updateCompactState()

    if (scrollElement) {
      scrollElement.addEventListener("scroll", updateCompactState, { passive: true })
      return () => scrollElement.removeEventListener("scroll", updateCompactState)
    }

    window.addEventListener("scroll", updateCompactState, { passive: true })
    return () => window.removeEventListener("scroll", updateCompactState)
  }, [])

  return (
    <div
      data-anatomy-browser-frame
      className="space-y-5"
      style={{ "--anatomy-browser-sticky-offset": `${toolbarHeight}px` } as CSSProperties}
    >
      <div
        ref={toolbarRef}
        data-anatomy-browser-toolbar
        data-compact={isCompact}
        className="group/anatomy-toolbar sticky top-0 z-40 mx-0 space-y-2 rounded-md border border-border/80 bg-card p-1 shadow-lg shadow-black/25 transition-all sm:-mx-1 sm:space-y-4 sm:p-3"
      >
        {toolbar}
      </div>
      {children}
    </div>
  )
}
