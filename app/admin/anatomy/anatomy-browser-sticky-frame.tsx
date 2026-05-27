"use client"

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"

type AnatomyBrowserStickyFrameProps = {
  toolbar: ReactNode
  children: ReactNode
}

export function AnatomyBrowserStickyFrame({ toolbar, children }: AnatomyBrowserStickyFrameProps) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [toolbarHeight, setToolbarHeight] = useState(0)

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

  return (
    <div
      data-anatomy-browser-frame
      className="space-y-5"
      style={{ "--anatomy-browser-sticky-offset": `${toolbarHeight}px` } as CSSProperties}
    >
      <div
        ref={toolbarRef}
        data-anatomy-browser-toolbar
        className="sticky top-0 z-40 -mx-1 space-y-4 rounded-md border border-border/80 bg-card p-3 shadow-lg shadow-black/25"
      >
        {toolbar}
      </div>
      {children}
    </div>
  )
}
