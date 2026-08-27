type PlaybackConfiguration = {
  strategyId: string
  previewSettings: Record<string, unknown>
  constructionPolicy: {
    minimumSelectionsBeforeRepeat: number | null
    transitionDurationRange: { minimumSeconds: number; maximumSeconds: number } | null
    cadenceBoundary: { mode: string; crossfadeSeconds: number } | null
    overlapNextEvent: boolean
    preserveFullLengthOverlaps?: boolean
  }
}

/** Translates the exact scheduler configuration into concrete reviewer language. */
export function WholeConceptPolicySummary({ configuration, runtimePolicy = null, sourceSelection = null, levelMatch = null }: {
  configuration: PlaybackConfiguration
  runtimePolicy?: Record<string, unknown> | null
  sourceSelection?: { kind: "single-source-loop" } | null
  levelMatch?: { targetIntegratedLoudnessLufs: number } | null
}) {
  const playbackLines = sourceSelection?.kind === "single-source-loop"
    ? describeSingleSourceLoop(configuration)
    : runtimePolicy
      ? describeRuntimePolicy(runtimePolicy)
      : describePolicy(configuration)
  const lines = levelMatch
    ? [...playbackLines, {
        term: "Volume",
        description: `Constant gain per recording targets ${Number(levelMatch.targetIntegratedLoudnessLufs)} LUFS; no compression or within-recording dynamics processing is applied.`,
      }]
    : playbackLines
  return (
    <section className="space-y-2 rounded-xl border bg-muted/30 p-4" aria-labelledby="current-playback-policy">
      <h3 id="current-playback-policy" className="font-medium">Current playback policy</h3>
      <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
        {lines.map(({ term, description }) => (
          <div key={term} className="contents">
            <dt className="font-medium">{term}</dt>
            <dd className="text-muted-foreground">{description}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function describeSingleSourceLoop(configuration: PlaybackConfiguration) {
  const settings = configuration.previewSettings
  const overlap = settings.transitionMode === "overlap"
  return [
    { term: "Strategy", description: "The reviewer chooses exactly one recording from the concept pool." },
    { term: "Playback", description: "Only the chosen recording repeats; the other pool recordings remain silent." },
    { term: "Return seam", description: overlap
      ? `Start a fresh instance ${Number(settings.transitionSeconds)} seconds before the current copy ends. Both copies play at full level with no fade.`
      : `${Number(settings.transitionSeconds)}-second crossfade into a fresh instance of the same recording.` },
  ]
}

function describeRuntimePolicy(policy: Record<string, unknown>) {
  if (policy.kind === "fixed-region-loop") {
    return [
      { term: "Strategy", description: "Play the source opening once, then repeat one exact regional loop." },
      { term: "First pass", description: `${formatSeconds(policy.firstPassStartSeconds)}–${formatSeconds(policy.loopEndSeconds)}.` },
      { term: "Repeating region", description: `${formatSeconds(policy.loopStartSeconds)}–${formatSeconds(policy.loopEndSeconds)}.` },
      { term: "Return seam", description: `${Number(policy.crossfadeSeconds)}-second crossfade back to the loop start.` },
    ]
  }
  if (policy.kind === "random-region-loop") {
    const requestedMinimum = Number(policy.minimumLoopSeconds)
    const crossfadeSeconds = Number(policy.crossfadeSeconds)
    const effectiveMinimum = Math.max(requestedMinimum, crossfadeSeconds * 2)
    return [
      { term: "Strategy", description: "Choose a new bounded source window at every loop boundary." },
      { term: "Allowed region", description: `${formatSeconds(policy.regionStartSeconds)}–${formatSeconds(policy.regionEndSeconds)}.` },
      {
        term: "Window",
        description: effectiveMinimum === requestedMinimum
          ? `Every selected window is at least ${requestedMinimum} seconds.`
          : `Requested minimum ${requestedMinimum} seconds; this preview uses at least ${effectiveMinimum} seconds so the entrance and exit crossfades do not collide.`,
      },
      { term: "Return seam", description: `${crossfadeSeconds}-second crossfade into the next independently selected window.` },
    ]
  }
  if (policy.kind === "pause-separated-sequence") {
    return [
      { term: "Strategy", description: "Play one complete recording at a time with no overlap." },
      { term: "Pause", description: `Wait randomly ${Number(policy.minimumGapSeconds)}–${Number(policy.maximumGapSeconds)} seconds after it ends.` },
      { term: "Boundary", description: `${Number(policy.fadeInSeconds)}-second fade in and ${Number(policy.fadeOutSeconds)}-second fade out on each recording.` },
    ]
  }
  if (policy.kind === "layered-sequence") {
    return [
      { term: "Strategy", description: "Trigger independently selected complete recordings in layered playback." },
      { term: "Strict cap", description: `At most ${Number(policy.maximumConcurrentVoices)} recordings are audible, including a source entering or leaving a crossfade.` },
      { term: "Startup", description: `Layer starts are randomized within ${Number(policy.initialStartWindowSeconds)} seconds.` },
      { term: "Boundary", description: `${Number(policy.transitionSeconds)}-second ${String(policy.transitionMode)}; a full recording is never evicted to make room.` },
    ]
  }
  if (policy.kind === "multi-lane-sequence") {
    const lanes = Array.isArray(policy.lanes) ? policy.lanes as Array<Record<string, unknown>> : []
    return [
      { term: "Strategy", description: `${lanes.length} independent logical tracks play together.` },
      ...lanes.map((lane, index) => ({
        term: `Track ${index + 1}`,
        description: lane.boundaryMode === "crossfade"
          ? `${Array.isArray(lane.sourceIds) ? lane.sourceIds.length : 0} sources, random order, ${Number(lane.transitionSeconds)}-second crossfades.`
          : `${Array.isArray(lane.sourceIds) ? lane.sourceIds.length : 0} sources, random order, ${Number(lane.minimumGapSeconds)}–${Number(lane.maximumGapSeconds)} second pauses.`,
      })),
    ]
  }
  if (policy.kind === "repeat-source-sequence") {
    const minimumPlays = Number(policy.minimumConsecutivePlays)
    const maximumPlays = Number(policy.maximumConsecutivePlays)
    const beatsPerMinute = Number(policy.beatsPerMinute)
    const crossfadeBeats = Number(policy.crossfadeBeats)
    const crossfadeSeconds = crossfadeBeats * 60 / beatsPerMinute
    const fourBeatBars = crossfadeBeats / 4
    const shortSourceIds = Array.isArray(policy.shortSourceIds) ? policy.shortSourceIds : []
    const shortCrossfadeBeats = Number(policy.shortCrossfadeBeats)
    const shortCrossfadeSeconds = shortCrossfadeBeats * 60 / beatsPerMinute
    const shortFourBeatBars = shortCrossfadeBeats / 4
    return [
      { term: "Strategy", description: "Play one complete recording at a time from one randomized pool." },
      { term: "Repeat block", description: `Each selected recording gets ${minimumPlays}–${maximumPlays} consecutive plays total before switching to a different recording.` },
      { term: "Standard boundary", description: `Use ${fourBeatBars} four-beat bars at ${beatsPerMinute} BPM (${crossfadeBeats} beats, ${crossfadeSeconds.toFixed(3)} seconds).` },
      ...(shortSourceIds.length > 0 ? [{
        term: "Short recordings",
        description: `${shortSourceIds.length} shorter recordings use ${shortFourBeatBars} four-beat bars (${shortCrossfadeBeats} beats, ${shortCrossfadeSeconds.toFixed(3)} seconds) so the boundary does not consume the whole recording.`,
      }] : []),
    ]
  }
  return [{ term: "Strategy", description: "Reviewer-directed runtime policy." }]
}

function describePolicy(configuration: PlaybackConfiguration) {
  const { strategyId, previewSettings: settings, constructionPolicy: policy } = configuration
  const selection = policy.minimumSelectionsBeforeRepeat
    ? `A recording cannot repeat until ${policy.minimumSelectionsBeforeRepeat} other selections intervene.`
    : "Avoid an immediate repeat when more than one recording is available."

  if (strategyId === "walking-cadence-sequence") {
    const stepsPerMinute = Number(settings.stepsPerMinute)
    const jitterPercent = Number(settings.jitterPercent)
    return [
      { term: "Strategy", description: "Trigger whole footstep/event recordings at a walking cadence." },
      { term: "Selection", description: selection },
      { term: "Timing", description: `${stepsPerMinute} events per minute with up to ${jitterPercent}% random timing variation.` },
      { term: "Boundary", description: policy.overlapNextEvent
        ? "A triggered event may continue while the next event begins."
        : "The prior event is retired at the next cadence boundary unless an explicit overlap policy says otherwise." },
    ]
  }

  if (strategyId === "spaced-event-sequence") {
    return [
      { term: "Strategy", description: "Play a complete event recording, then wait before choosing another." },
      { term: "Selection", description: selection },
      { term: "Timing", description: `Wait randomly ${Number(settings.minimumGapSeconds)}–${Number(settings.maximumGapSeconds)} seconds after an event ends.` },
      { term: "Boundary", description: "Events play at full level; this strategy does not crossfade them." },
    ]
  }

  const mode = String(settings.transitionMode)
  const range = policy.transitionDurationRange
  const timing = range
    ? `Choose a fresh ${range.minimumSeconds}–${range.maximumSeconds} second transition lead at every boundary.`
    : mode === "end-to-end"
      ? "Start the next recording after the current recording ends."
      : `Start the next recording ${Number(settings.transitionSeconds)} seconds before the current recording ends.`
  const boundary = mode === "crossfade"
    ? "Fade the outgoing recording down while fading the incoming recording up."
    : mode === "overlap"
      ? policy.preserveFullLengthOverlaps
        ? "Plain overlap with no fade; every triggered recording may finish naturally."
        : "Plain overlap with no fade between the recordings."
      : "No overlap or crossfade."
  return [
    { term: "Strategy", description: "Sequence complete source recordings continuously." },
    { term: "Selection", description: selection },
    { term: "Timing", description: timing },
    { term: "Boundary", description: boundary },
  ]
}

function formatSeconds(value: unknown) {
  const seconds = Math.max(0, Number(value))
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
}
