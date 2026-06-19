// @ts-check

/**
 * User-facing station groups for the Atmosphere browser.
 *
 * The grouping is intentionally independent of sample hosting and package
 * metadata: it describes how a listener would choose a station in a room.
 */
export const ATMOSPHERE_STATION_GROUP_DEFINITIONS = Object.freeze([
  {
    id: "treatment-room-starters",
    title: "Treatment room starters",
    description: "Reliable first choices for a calm room, quiet study, or gentle background bed.",
    stationIds: Object.freeze([
      "mlab-proof-drone",
      "observable-streams-probe",
      "generative-fm-aisatsana",
      "generative-fm-at-sunrise",
      "generative-fm-day-dream",
      "generative-fm-eno-machine",
      "generative-fm-lemniscate",
      "generative-fm-peace",
      "generative-fm-trees",
    ]),
  },
  {
    id: "piano-bells-mallets",
    title: "Piano, bells, and mallets",
    description: "Sparse keys, glockenspiel, vibraphone, marimba, and glassy tones.",
    stationIds: Object.freeze([
      "generative-fm-agua-ravine",
      "generative-fm-buttafingers",
      "generative-fm-expand-collapse",
      "generative-fm-little-bells",
      "generative-fm-no-refrain",
      "generative-fm-oxalis-1",
      "generative-fm-pinwheels",
      "generative-fm-remembering",
      "generative-fm-return-to-form",
      "generative-fm-sevenths",
      "generative-fm-splash",
      "generative-fm-substrate",
      "generative-fm-timbral-oscillations",
      "generative-fm-transmission",
      "generative-fm-uun",
      "generative-fm-western-medicine",
      "generative-fm-yesterday",
    ]),
  },
  {
    id: "drones-strings-cinematic",
    title: "Drones, strings, and cinematic beds",
    description: "Sustained tones, bowed strings, brass, and slow cinematic movement.",
    stationIds: Object.freeze([
      "generative-fm-a-viable-system",
      "generative-fm-above-the-rain",
      "generative-fm-apoapsis",
      "generative-fm-bhairav",
      "generative-fm-documentary-films",
      "generative-fm-drones",
      "generative-fm-drones-2",
      "generative-fm-enough",
      "generative-fm-homage",
      "generative-fm-nakaii",
      "generative-fm-pulse-code-modulation",
      "generative-fm-soundtrack",
      "generative-fm-spring-again",
    ]),
  },
  {
    id: "nature-field-textures",
    title: "Water, nature, and field textures",
    description: "Oceanic, outdoor, bowl, and field-recording colors for more atmospheric rooms.",
    stationIds: Object.freeze([
      "generative-fm-420hz-gamma-waves-for-big-brain",
      "generative-fm-animalia-chordata",
      "generative-fm-beneath-waves",
      "generative-fm-last-transit",
      "generative-fm-lullaby",
      "generative-fm-meditation",
      "generative-fm-zed",
    ]),
  },
  {
    id: "rhythm-experimental",
    title: "Rhythm and experimental texture",
    description: "More distinctive, darker, or rhythmic stations for specific moods rather than default calm.",
    stationIds: Object.freeze([
      "generative-fm-awash",
      "generative-fm-didgeridoobeats",
      "generative-fm-eyes-closed",
      "generative-fm-impact",
      "generative-fm-moment",
      "generative-fm-neuroplasticity",
      "generative-fm-otherness",
      "generative-fm-ritual",
      "generative-fm-skyline",
      "generative-fm-stratospheric",
      "generative-fm-stream-of-consciousness",
      "generative-fm-townsend",
    ]),
  },
])

/**
 * Partitions visible Atmosphere stations into listener-facing groups.
 * Stations not named in the current grouping are retained in a final fallback
 * group so adding a catalog entry cannot silently hide it from the UI.
 *
 * @template {{ id: string }} TStation
 * @param {TStation[]} stations
 * @returns {Array<{ id: string, title: string, description: string, stations: TStation[] }>}
 */
export function groupAtmosphereStations(stations) {
  const stationsById = new Map(stations.map((station) => [station.id, station]))
  const groupedStationIds = new Set()

  const groups = ATMOSPHERE_STATION_GROUP_DEFINITIONS
    .map((definition) => {
      /** @type {TStation[]} */
      const groupStations = []
      for (const stationId of definition.stationIds) {
        const station = stationsById.get(stationId)
        if (station) {
          groupedStationIds.add(station.id)
          groupStations.push(station)
        }
      }

      return {
        id: definition.id,
        title: definition.title,
        description: definition.description,
        stations: groupStations,
      }
    })
    .filter((group) => group.stations.length > 0)

  const ungroupedStations = stations.filter((station) => !groupedStationIds.has(station.id))
  if (ungroupedStations.length > 0) {
    groups.push({
      id: "more-stations",
      title: "More stations",
      description: "Additional playable Atmosphere stations.",
      stations: ungroupedStations,
    })
  }

  return groups
}
