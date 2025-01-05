export interface Generator {
  id: string
  title: string
  artist: string
  description?: string
  image: string
  playCount: number
  generatorFn: (context: GeneratorContext) => Promise<any>
}

export interface Track {
  id: string
  title: string
  artist: string
  url: string
  image?: string
}

export interface GeneratorContext {
  audioContext: AudioContext
  destination: any
  sampleLibrary: {
    load: () => Promise<boolean>
  }
}

