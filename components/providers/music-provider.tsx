"use client"

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react"
import * as Tone from 'tone'
import createSampleProvider from '@generative-music/web-provider'
import createSampleLibrary from '@generative-music/web-library'
import type { Generator, Track } from "@/types/music"

interface MusicContextType {
  currentTrack: Track | null
  isPlaying: boolean
  isLoading: boolean
  loadingProgress: number
  error: string | null
  togglePlay: () => void
  playGenerator: (generator: Generator) => Promise<void>
  stopCurrent: () => void
}

const MusicContext = createContext<MusicContextType | undefined>(undefined)

// Sample index structure matching the library's expectations
const sampleIndex = {
  'vsco2-piano-mf': {
    'a0': 'vsco2-piano-mf-a0',
    'a1': 'vsco2-piano-mf-a1',
    'a2': 'vsco2-piano-mf-a2',
    'a3': 'vsco2-piano-mf-a3',
    'a4': 'vsco2-piano-mf-a4',
    'a5': 'vsco2-piano-mf-a5',
    'a6': 'vsco2-piano-mf-a6',
  },
  'vsco2-violin-arcvib': {
    'a3': 'vsco2-violin-arcvib-a3',
    'a4': 'vsco2-violin-arcvib-a4',
    'a5': 'vsco2-violin-arcvib-a5',
  }
}

// Create a custom provider that implements the required interface
const createCustomProvider = () => {
  const format = 'mp3' // Default to MP3
  const baseUrl = 'https://samples.generative.fm/samples/'
  const bufferCache = new Map()

  return {
    // Check if samples are available
    has: async (urls: string[]) => {
      return urls.every(url => bufferCache.has(url))
    },
    
    // Request samples
    request: async (audioContext: AudioContext, urls: string[]) => {
      const buffers = await Promise.all(
        urls.map(async (url) => {
          if (bufferCache.has(url)) {
            return bufferCache.get(url)
          }
          
          const response = await fetch(`${baseUrl}${url}.${format}`)
          const arrayBuffer = await response.arrayBuffer()
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
          bufferCache.set(url, audioBuffer)
          return audioBuffer
        })
      )
      return buffers
    },
    
    // Save samples
    save: async (entries: [string, AudioBuffer][]) => {
      entries.forEach(([url, buffer]) => {
        bufferCache.set(url, buffer)
      })
    }
  }
}

// Create sample library with proper configuration
const createAudioLibrary = () => {
  console.log('Creating audio library...')
  const provider = createCustomProvider()
  
  const library = createSampleLibrary({ 
    sampleIndex,
    provider,
    audioContext: Tone.context
  })
  
  console.log('Library created:', library)
  return library
}

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const activeGenerator = useRef<any>(null)
  const isInitialized = useRef(false)
  const library = useRef<any>(null)

  const initializeTone = useCallback(async () => {
    if (!isInitialized.current) {
      try {
        console.log('Initializing Tone.js...')
        await Tone.start()
        Tone.Transport.start()
        isInitialized.current = true
        console.log('Tone.js initialized')
      } catch (error) {
        console.error('Error initializing Tone:', error)
        setError('Failed to initialize audio system')
        throw error
      }
    }
  }, [])

  const stopCurrent = useCallback(() => {
    if (activeGenerator.current) {
      try {
        console.log('Stopping current generator...')
        activeGenerator.current.stop()
        activeGenerator.current.dispose()
        console.log('Generator stopped and disposed')
      } catch (error) {
        console.error('Error stopping generator:', error)
        setError('Failed to stop current generator')
      }
      activeGenerator.current = null
    }
    setIsPlaying(false)
    setCurrentTrack(null)
  }, [])

  const getLibrary = useCallback(async () => {
    if (!library.current) {
      console.log('Creating new library instance...')
      try {
        library.current = createAudioLibrary()
        
        // Test the library methods
        const testInstrument = 'vsco2-piano-mf'
        const hasInstrument = await library.current.has([testInstrument])
        console.log(`Library has ${testInstrument}:`, hasInstrument)
        
        console.log('Library instance created:', library.current)
      } catch (error) {
        console.error('Error creating library:', error)
        setError('Failed to create audio library')
        throw error
      }
    }
    return library.current
  }, [])

  const playGenerator = useCallback(async (generator: Generator) => {
    setError(null)
    try {
      console.log('Starting playback of generator:', generator.title)
      setIsLoading(true)
      setLoadingProgress(0)
      
      // Stop any currently playing generator
      stopCurrent()

      // Initialize Tone if needed
      await initializeTone()

      // Get or create sample library
      const sampleLibrary = await getLibrary()
      console.log('Sample library retrieved:', sampleLibrary)

      // Set master volume
      Tone.Destination.volume.value = -10

      console.log('Creating generator context...')
      // Create the context with all required properties
      const context = {
        audioContext: Tone.context,
        destination: Tone.Destination,
        sampleLibrary,
        master: Tone.Destination,
        instruments: {},
        effects: {},
        parts: {},
        connections: new Map(),
        parameters: {
          bpm: Tone.Transport.bpm.value,
          volume: Tone.Destination.volume.value
        }
      }
      
      console.log('Initializing generator with context:', context)
      // Initialize the generator
      let instance
      try {
        instance = await generator.generatorFn(context)
        
        if (!instance) {
          throw new Error('Generator returned null or undefined')
        }
        
        if (typeof instance.start !== 'function') {
          throw new Error('Generator missing required start() method')
        }
        
        if (typeof instance.stop !== 'function') {
          throw new Error('Generator missing required stop() method')
        }
      } catch (error: any) {
        throw new Error(`Generator initialization failed: ${error.message || 'Unknown error'}`)
      }

      console.log('Generator instance created:', instance)

      if (!instance) {
        throw new Error('Generator failed to initialize')
      }

      activeGenerator.current = instance

      // Start playback
      if (typeof instance.start === 'function') {
        console.log('Starting generator playback...')
        await instance.start()
        console.log('Generator playback started')
      } else {
        throw new Error('Generator has no start method')
      }

      // Update state
      setCurrentTrack({
        id: generator.id,
        title: generator.title,
        artist: generator.artist,
        url: '',
        image: generator.image
      })
      setIsPlaying(true)
    } catch (error: any) {
      console.error('Error playing generator:', error)
      const errorMessage = error?.message || 
        (typeof error === 'string' ? error : 'Failed to initialize audio playback')
      setError(errorMessage)
      stopCurrent()
      // Rethrow with more context
      throw new Error(`Failed to play generator: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }, [stopCurrent, initializeTone, getLibrary])

  const togglePlay = useCallback(async () => {
    if (activeGenerator.current) {
      try {
        await initializeTone()
        
        if (isPlaying) {
          console.log('Pausing playback...')
          if (typeof activeGenerator.current.stop === 'function') {
            activeGenerator.current.stop()
          }
        } else {
          console.log('Resuming playback...')
          if (typeof activeGenerator.current.start === 'function') {
            activeGenerator.current.start()
          }
        }
        setIsPlaying(!isPlaying)
      } catch (error: any) {
        console.error('Error toggling playback:', error)
        const errorMessage = error?.message || 'Failed to toggle playback'
        setError(errorMessage)
        stopCurrent()
      }
    }
  }, [isPlaying, stopCurrent, initializeTone])

  // Initialize library on mount
  useEffect(() => {
    console.log('Initializing library on mount...')
    getLibrary().catch(console.error)
  }, [getLibrary])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('Cleaning up...')
      stopCurrent()
      if (isInitialized.current) {
        Tone.Transport.stop()
        isInitialized.current = false
      }
    }
  }, [stopCurrent])

  return (
    <MusicContext.Provider value={{ 
      currentTrack, 
      isPlaying,
      isLoading,
      loadingProgress,
      error,
      togglePlay,
      playGenerator,
      stopCurrent
    }}>
      {children}
    </MusicContext.Provider>
  )
}

export function useMusic() {
  const context = useContext(MusicContext)
  if (context === undefined) {
    throw new Error("useMusic must be used within a MusicProvider")
  }
  return context
}

