/**
 * Frozen recipes accepted during the representative pilot. Keeping these
 * values separate from the candidate seeder prevents catalog expansion from
 * silently retiming already approved previews.
 */
function approvedRecipe(backgroundId, durationMs, posterTimeMs, loopStrategy, crossfadeMs, fps) {
  return Object.freeze({
    backgroundId,
    mediaKind: "animated",
    recipeRevision: "recipe-1",
    reviewStatus: "approved",
    warmupMs: 2200,
    durationMs,
    posterTimeMs,
    loopStrategy,
    crossfadeMs,
    fps,
    passiveCaptureState: "default",
    framing: Object.freeze({ landscape: null, square: null, vertical: null }),
  })
}

export const APPROVED_PILOT_RECIPES = Object.freeze({
  "massage-lab-moving-gradient": approvedRecipe("massage-lab-moving-gradient", 12000, 4000, "crossfade", 900, 24),
  "massage-lab-silk": approvedRecipe("massage-lab-silk", 10000, 3333, "crossfade", 800, 24),
  "massage-lab-wave-current": approvedRecipe("massage-lab-wave-current", 10000, 3333, "crossfade", 800, 24),
  "massage-lab-dna": approvedRecipe("massage-lab-dna", 18000, 6000, "crossfade", 1000, 24),
  "massage-lab-twisted-cubes": approvedRecipe("massage-lab-twisted-cubes", 12000, 4000, "natural", 0, 24),
  "massage-lab-galaxy": approvedRecipe("massage-lab-galaxy", 12000, 4000, "crossfade", 900, 30),
  "massage-lab-faulty-terminal": approvedRecipe("massage-lab-faulty-terminal", 8000, 2667, "crossfade", 600, 30),
  "massage-lab-tile-grid": approvedRecipe("massage-lab-tile-grid", 12000, 4000, "crossfade", 900, 24),
})
