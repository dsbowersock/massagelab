declare module "@generative-music/web-provider" {
  export interface WebProvider {
    has(urls: string[]): Promise<boolean>
    request(audioContext: BaseAudioContext, urls: string[]): Promise<AudioBuffer[]>
    save(cacheEntries: Array<[string, AudioBuffer | Record<string, AudioBuffer>]>): Promise<void>
  }

  export default function createProvider(saveWorker?: Worker): WebProvider
}

declare module "@generative-music/web-library" {
  import type { WebProvider } from "@generative-music/web-provider"

  export interface WebLibrary {
    has(instruments: Array<string | string[]>): Promise<boolean>
    request(audioContext: BaseAudioContext, instruments: Array<string | string[]>): Promise<Record<string, unknown>>
    save(cacheEntries: Array<[string, AudioBuffer | Record<string, AudioBuffer>]>): Promise<void>
  }

  export default function createLibrary(config: {
    sampleIndex: Record<string, unknown>
    provider: WebProvider
  }): WebLibrary
}

declare module "@generative-music/piece-observable-streams" {
  import type { WebLibrary } from "@generative-music/web-library"

  export type GenerativeMusicStageEnd = () => unknown
  export type GenerativeMusicStageSchedule = () => GenerativeMusicStageEnd | undefined
  export type GenerativeMusicDeactivate = () => unknown

  export default function createPiece(options: {
    context: unknown
    destination: unknown
    sampleLibrary: WebLibrary
    onProgress: (progress: number) => void
  }): Promise<[GenerativeMusicDeactivate, GenerativeMusicStageSchedule]>
}

declare module "@generative-music/pieces-alex-bainter" {
  import type createPiece from "@generative-music/piece-observable-streams"

  export const byId: Record<string, typeof createPiece>

  const pieces: Array<typeof createPiece>
  export default pieces
}
