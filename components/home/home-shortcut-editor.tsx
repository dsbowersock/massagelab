"use client"

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"

type HomeToolShortcutOption = {
  key: string
  title: string
  description: string
  status: string
}

const maxToolSelections = 6

export function HomeShortcutEditor({
  tools,
  defaultSelection,
  fieldName,
  maxSelections = maxToolSelections,
}: {
  tools: ReadonlyArray<HomeToolShortcutOption>
  defaultSelection: ReadonlyArray<string>
  fieldName: string
  maxSelections?: number
}) {
  const byKey = useMemo(() => new Map(tools.map((tool) => [tool.key, tool])), [tools])
  const sanitizeSelection = (selection: ReadonlyArray<string>) => {
    const seen = new Set<string>()
    const ordered = []
    for (const key of selection) {
      if (seen.has(key) || !byKey.has(key)) {
        continue
      }
      seen.add(key)
      ordered.push(key)
      if (ordered.length >= maxSelections) {
        break
      }
    }
    return ordered
  }

  const [selection, setSelection] = useState<string[]>(() => sanitizeSelection(defaultSelection))

  const selectedSet = useMemo(() => new Set(selection), [selection])
  const availableTools = tools.filter((tool) => !selectedSet.has(tool.key))

  function moveUp(index: number) {
    if (index === 0) {
      return
    }

    setSelection((current) => {
      if (index <= 0 || index >= current.length) return current
      const next = [...current]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  function moveDown(index: number) {
    if (index >= selection.length - 1) {
      return
    }

    setSelection((current) => {
      if (index < 0 || index >= current.length - 1) return current
      const next = [...current]
      ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
      return next
    })
  }

  function toggleTool(toolKey: string, enabled: boolean) {
    setSelection((current) => {
      const hasKey = current.includes(toolKey)
      if (enabled && !hasKey) {
        if (current.length >= maxSelections) {
          return current
        }
        return [...current, toolKey]
      }

      if (!enabled) {
        return current.filter((value) => value !== toolKey)
      }

      return current
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          Reorder these picks to decide which tools appear first on your signed-in home.
        </p>
        {selection.length === 0 ? (
          <p className="mb-2 text-sm text-destructive">No tools selected yet. We will use a safe default for your role.</p>
        ) : (
          <p className="mb-2 text-xs text-muted-foreground">Selected tools are sent in this order.</p>
        )}
      </div>

      <div className="space-y-2">
        {selection.map((toolKey, index) => {
          const tool = byKey.get(toolKey)
          if (!tool) {
            return null
          }

          return (
            <div
              key={tool.key}
              className="flex items-start justify-between gap-3 rounded-md border border-border/80 bg-background/80 p-2"
            >
              <div>
                <p className="text-sm font-medium">{tool.title}</p>
                <p className="text-xs text-muted-foreground">{tool.status}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={`Move ${tool.title} up`}
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={`Move ${tool.title} down`}
                  onClick={() => moveDown(index)}
                  disabled={index === selection.length - 1}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleTool(tool.key, false)}
                  className="ml-1"
                >
                  Remove
                </Button>
              </div>
            </div>
          )
        })}

        {selection.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/50 p-3 text-sm text-muted-foreground">
            No saved shortcut selections yet. This account will still use smart defaults.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Available tools to add</p>
        {availableTools.map((tool) => (
          <label
            key={tool.key}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border/80 bg-background/80 p-2 text-sm"
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-primary"
              checked={selectedSet.has(tool.key)}
              disabled={selection.length >= maxSelections && !selectedSet.has(tool.key)}
              onChange={(event) => toggleTool(tool.key, event.target.checked)}
            />
            <span className="min-w-0">
              <span className="block font-medium">{tool.title}</span>
              <span className="text-xs text-muted-foreground">{tool.description}</span>
            </span>
          </label>
        ))}
      </div>

      {selection.length > 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden="true" />
          Tip: Use “Move up/down” to shape the order before saving.
        </div>
      ) : null}

      {selection.map((toolKey) => (
        <input key={toolKey} type="hidden" name={fieldName} value={toolKey} />
      ))}
    </div>
  )
}
