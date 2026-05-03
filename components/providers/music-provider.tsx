"use client"

import { createContext, useContext } from "react"

interface MusicContextType {
  currentTrack: null
  isPlaying: false
  isLoading: false
  loadingProgress: 0
  error: string | null
  togglePlay: () => void
  playGenerator: () => Promise<void>
  stopCurrent: () => void
}

const MusicContext = createContext<MusicContextType>({
  currentTrack: null,
  isPlaying: false,
  isLoading: false,
  loadingProgress: 0,
  error: null,
  togglePlay: () => undefined,
  playGenerator: async () => undefined,
  stopCurrent: () => undefined,
})

export function MusicProvider({ children }: { children: React.ReactNode }) {
  return <MusicContext.Provider value={useContext(MusicContext)}>{children}</MusicContext.Provider>
}

export function useMusic() {
  return useContext(MusicContext)
}
