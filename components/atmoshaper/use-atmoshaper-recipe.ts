"use client"

import { useCallback, useEffect, useReducer } from "react"

import { useMusic } from "@/components/providers/music-provider"
import {
  addAtmoShaperLayer,
  createAtmoShaperRecipe,
  moveAtmoShaperLayer,
  removeAtmoShaperLayer,
  updateAtmoShaperLayer,
  type AtmoShaperLayer,
  type AtmoShaperRecipe,
} from "@/lib/atmoshaper/recipe.js"

export type AtmoShaperLayerPatch = Partial<AtmoShaperLayer>

export type AtmoShaperRecipeActions = {
  addLayer(layer: AtmoShaperLayer): void
  updateLayer(layerId: string, patch: AtmoShaperLayerPatch): void
  removeLayer(layerId: string): void
  moveLayer(layerId: string, toIndex: number): void
  reset(): void
}

type RecipeOwnerState = {
  announcement: { id: number, message: string } | null
  recipe: AtmoShaperRecipe
}

type RecipeOwnerAction =
  | { type: "add", layer: AtmoShaperLayer }
  | { type: "announce", message: string }
  | { type: "move", layerId: string, toIndex: number }
  | { type: "remove", layerId: string }
  | { type: "reset" }
  | { type: "update", layerId: string, patch: AtmoShaperLayerPatch }

function nextAnnouncement(state: RecipeOwnerState, message: string) {
  return { id: (state.announcement?.id ?? 0) + 1, message }
}

/**
 * Keeps the live recipe as the sole UI-owned state and delegates every recipe
 * mutation to the canonical immutable domain helpers. Audio remains owned by
 * MusicProvider, whose stopped-update path deliberately stays silent.
 */
function recipeOwnerReducer(state: RecipeOwnerState, action: RecipeOwnerAction): RecipeOwnerState {
  switch (action.type) {
    case "add":
      return {
        recipe: addAtmoShaperLayer(state.recipe, action.layer),
        announcement: nextAnnouncement(state, "Layer added."),
      }
    case "update":
      return {
        ...state,
        recipe: updateAtmoShaperLayer(state.recipe, action.layerId, action.patch),
      }
    case "remove":
      return {
        recipe: removeAtmoShaperLayer(state.recipe, action.layerId),
        announcement: nextAnnouncement(state, "Layer removed."),
      }
    case "move":
      return {
        ...state,
        recipe: moveAtmoShaperLayer(state.recipe, action.layerId, action.toIndex),
      }
    case "reset":
      return {
        recipe: createAtmoShaperRecipe({ id: state.recipe.id }),
        announcement: nextAnnouncement(state, "Current mix cleared."),
      }
    case "announce":
      return { ...state, announcement: nextAnnouncement(state, action.message) }
  }
}

export function useAtmoShaperRecipe() {
  const music = useMusic()
  const { updateAtmoShaper } = music
  const [state, dispatch] = useReducer(recipeOwnerReducer, undefined, () => ({
    recipe: createAtmoShaperRecipe({ id: crypto.randomUUID() }),
    announcement: null,
  }))
  const { recipe } = state

  useEffect(() => {
    void updateAtmoShaper(recipe)
  }, [recipe, updateAtmoShaper])

  const actions: AtmoShaperRecipeActions = {
    addLayer(layer) {
      dispatch({ type: "add", layer })
    },
    updateLayer(layerId, patch) {
      dispatch({ type: "update", layerId, patch })
    },
    removeLayer(layerId) {
      dispatch({ type: "remove", layerId })
    },
    moveLayer(layerId, toIndex) {
      dispatch({ type: "move", layerId, toIndex })
    },
    reset() {
      dispatch({ type: "reset" })
    },
  }

  const announce = useCallback((message: string) => {
    dispatch({ type: "announce", message })
  }, [])

  return {
    actions,
    announce,
    announcement: state.announcement,
    music,
    recipe,
  }
}
