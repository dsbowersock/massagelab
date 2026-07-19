"use client"

import * as React from "react"
import { isIosSafariNavigator, resolvePwaInstallStatus } from "@/lib/pwa-install"

type PwaInstallStatus = "prompt" | "instructions" | "installed" | "unsupported"
type InstallRequestResult = "accepted" | "dismissed" | "instructions" | "unavailable" | "failed"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

type NavigatorWithStandalone = Navigator & { standalone?: boolean }

const PwaInstallContext = React.createContext<{
  status: PwaInstallStatus
  requestInstall: () => Promise<InstallRequestResult>
} | null>(null)

export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const promptRef = React.useRef<BeforeInstallPromptEvent | null>(null)
  const [hasPrompt, setHasPrompt] = React.useState(false)
  const [isStandalone, setIsStandalone] = React.useState(false)
  const [isIosSafari, setIsIosSafari] = React.useState(false)

  React.useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)")
    const readInstalledState = () => {
      setIsStandalone(displayMode.matches || Boolean((navigator as NavigatorWithStandalone).standalone))
    }
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      promptRef.current = event as BeforeInstallPromptEvent
      setHasPrompt(true)
    }
    const handleInstalled = () => {
      promptRef.current = null
      setHasPrompt(false)
      setIsStandalone(true)
    }

    setIsIosSafari(isIosSafariNavigator(navigator))
    readInstalledState()
    displayMode.addEventListener?.("change", readInstalledState)
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleInstalled)

    return () => {
      displayMode.removeEventListener?.("change", readInstalledState)
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleInstalled)
    }
  }, [])

  const status = resolvePwaInstallStatus({ hasPrompt, isStandalone, isIosSafari }) as PwaInstallStatus

  const requestInstall = React.useCallback(async (): Promise<InstallRequestResult> => {
    if (status === "instructions") return "instructions"
    const event = promptRef.current
    if (status !== "prompt" || !event) return "unavailable"

    try {
      await event.prompt()
      const choice = await event.userChoice
      promptRef.current = null
      setHasPrompt(false)
      return choice.outcome
    } catch {
      promptRef.current = null
      setHasPrompt(false)
      return "failed"
    }
  }, [status])

  return <PwaInstallContext.Provider value={{ status, requestInstall }}>{children}</PwaInstallContext.Provider>
}

export function usePwaInstall() {
  const value = React.useContext(PwaInstallContext)
  if (!value) throw new Error("usePwaInstall must be used within PwaInstallProvider")
  return value
}
