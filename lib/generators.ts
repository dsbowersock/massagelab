import * as sevenths from '@generative-music/piece-sevenths'
import * as meditation from '@generative-music/piece-meditation'
import * as lemniscate from '@generative-music/piece-lemniscate'
import * as impact from '@generative-music/piece-impact'
import type { Generator } from '@/types/music'

export const generators: Generator[] = [
  {
    id: "sevenths",
    title: "Sevenths",
    artist: "Alex Bainter",
    description: "A generative piece based on seventh chords",
    image: "/placeholder.svg?height=400&width=400",
    playCount: 12000,
    generatorFn: async (context) => {
      const generator = await sevenths.default(context)
      return generator
    }
  },
  {
    id: "meditation",
    title: "Meditation",
    artist: "Alex Bainter",
    description: "A calming piece for meditation",
    image: "/placeholder.svg?height=400&width=400",
    playCount: 15000,
    generatorFn: async (context) => {
      const generator = await meditation.default(context)
      return generator
    }
  },
  {
    id: "lemniscate",
    title: "Lemniscate",
    artist: "Alex Bainter",
    description: "An infinite, ever-evolving ambient piece",
    image: "/placeholder.svg?height=400&width=400",
    playCount: 9000,
    generatorFn: async (context) => {
      const generator = await lemniscate.default(context)
      return generator
    }
  },
  {
    id: "impact",
    title: "Impact",
    artist: "Alex Bainter",
    description: "Rhythmic and dynamic generative music",
    image: "/placeholder.svg?height=400&width=400",
    playCount: 11000,
    generatorFn: async (context) => {
      const generator = await impact.default(context)
      return generator
    }
  }
]

