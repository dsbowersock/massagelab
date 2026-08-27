export type ActiveVoiceTelemetry = {
  voiceId: string
  sourceId: string
  relativePath: string
  currentTime: number
  duration: number | null
  laneId?: string | null
  regionStartSeconds?: number | null
  regionEndSeconds?: number | null
  playing: boolean
  ended: boolean
}

/** Shows a seekable non-live timeline for every currently active recording. */
export function ActiveVoiceTimelines({ voices, onSeek, emptyMessage = "Start the concept to load its recording timeline." }: {
  voices: ActiveVoiceTelemetry[]
  onSeek: (voiceId: string, seconds: number) => void
  emptyMessage?: string
}) {
  if (voices.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="space-y-3 rounded-xl border bg-background/50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-medium">Active recording timelines</h4>
        {voices.filter(({ playing }) => playing).length > 1 ? (
          <p className="text-sm text-primary">
            {voices.filter(({ playing }) => playing).length} recordings overlap right now.
          </p>
        ) : null}
      </div>
      {voices.map((voice, index) => {
        const maximum = voice.duration ?? Math.max(voice.currentTime, 1)
        const value = Math.min(maximum, Math.max(0, voice.currentTime))
        return (
          <div key={voice.voiceId} className="space-y-2 rounded-lg border p-3">
            <p className="break-all text-sm font-medium">
              Recording {index + 1}{voice.laneId ? ` · ${voice.laneId}` : ""}: {voice.relativePath}
            </p>
            {voice.regionStartSeconds !== null && voice.regionStartSeconds !== undefined &&
              voice.regionEndSeconds !== null && voice.regionEndSeconds !== undefined ? (
                <p className="text-xs text-primary">
                  Active source window: {formatAudioTime(voice.regionStartSeconds)}–{formatAudioTime(voice.regionEndSeconds)}
                </p>
              ) : null}
            <input
              type="range"
              min={0}
              max={maximum}
              step={0.01}
              value={value}
              aria-label={`Seek Recording ${index + 1}: ${voice.relativePath}`}
              aria-valuetext={`Elapsed ${formatAudioTime(voice.currentTime)} of ${voice.duration === null
                ? "loading duration"
                : formatAudioTime(voice.duration)}`}
              onChange={(event) => onSeek(voice.voiceId, Number(event.currentTarget.value))}
              className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground">
              Elapsed {formatAudioTime(voice.currentTime)} / {voice.duration === null
                ? "loading duration"
                : formatAudioTime(voice.duration)}
              {voice.ended ? " · finished" : voice.playing ? " · playing" : " · paused"}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function formatAudioTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds - minutes * 60
  return `${minutes}:${remainder.toFixed(1).padStart(4, "0")}`
}
