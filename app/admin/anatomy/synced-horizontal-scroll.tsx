"use client"

import { useEffect, useRef, useState, type ReactNode, type UIEvent } from "react"

type SyncedHorizontalScrollProps = {
  children: ReactNode
  stickyHeader?: ReactNode
  minWidth?: number
}

export function SyncedHorizontalScroll({ children, stickyHeader, minWidth = 760 }: SyncedHorizontalScrollProps) {
  const topScrollRef = useRef<HTMLDivElement>(null)
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bottomScrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)
  const [scrollWidth, setScrollWidth] = useState(minWidth)

  useEffect(() => {
    const updateScrollWidth = () => {
      setScrollWidth(Math.max(minWidth, contentRef.current?.scrollWidth ?? minWidth))
    }

    updateScrollWidth()

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScrollWidth)
    if (contentRef.current) {
      resizeObserver?.observe(contentRef.current)
      if (contentRef.current.firstElementChild) {
        resizeObserver?.observe(contentRef.current.firstElementChild)
      }
    }
    window.addEventListener("resize", updateScrollWidth)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener("resize", updateScrollWidth)
    }
  }, [minWidth])

  const syncScroll = (source: HTMLDivElement, targets: Array<HTMLDivElement | null>) => {
    if (syncingRef.current) {
      return
    }

    syncingRef.current = true
    for (const target of targets) {
      if (target && target !== source) {
        target.scrollLeft = source.scrollLeft
      }
    }
    window.requestAnimationFrame(() => {
      syncingRef.current = false
    })
  }

  const handleTopScroll = (event: UIEvent<HTMLDivElement>) => {
    syncScroll(event.currentTarget, [headerScrollRef.current, bottomScrollRef.current])
  }

  const handleHeaderScroll = (event: UIEvent<HTMLDivElement>) => {
    syncScroll(event.currentTarget, [topScrollRef.current, bottomScrollRef.current])
  }

  const handleBottomScroll = (event: UIEvent<HTMLDivElement>) => {
    syncScroll(event.currentTarget, [topScrollRef.current, headerScrollRef.current])
  }

  return (
    <div className="rounded-md border border-border/80">
      <div
        ref={topScrollRef}
        data-anatomy-table-scroll="top"
        aria-label="Table horizontal scroll"
        className="sticky z-30 overflow-x-auto overflow-y-hidden rounded-t-md border-b border-border/80 bg-muted"
        onScroll={handleTopScroll}
        style={{ top: "var(--anatomy-browser-sticky-offset, 0px)" }}
        tabIndex={0}
      >
        <div aria-hidden="true" className="h-3" style={{ minWidth, width: scrollWidth }} />
      </div>
      {stickyHeader ? (
        <div
          ref={headerScrollRef}
          data-anatomy-table-header-scroll
          className="sticky z-20 overflow-x-hidden border-b border-border/80 bg-muted shadow-sm shadow-black/20"
          onScroll={handleHeaderScroll}
          style={{ top: "calc(var(--anatomy-browser-sticky-offset, 0px) + 28px)" }}
        >
          <div style={{ minWidth, width: scrollWidth }}>{stickyHeader}</div>
        </div>
      ) : null}
      <div ref={bottomScrollRef} data-anatomy-table-scroll="bottom" className="overflow-x-auto" onScroll={handleBottomScroll}>
        <div ref={contentRef} data-anatomy-table-inner style={{ minWidth }}>
          {children}
        </div>
      </div>
    </div>
  )
}
