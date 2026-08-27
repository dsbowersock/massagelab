"use client"

import { useCallback, useEffect, useReducer } from "react"

import {
  useMusic,
  type AtmoShaperPromotionResult,
} from "@/components/providers/music-provider"
import {
  addAtmoShaperLayer,
  createAtmoShaperRecipe,
  moveAtmoShaperLayer,
  removeAtmoShaperLayer,
  updateAtmoShaperLayer,
  type AtmoShaperLayer,
  type AtmoShaperRecipe,
} from "@/lib/atmoshaper/recipe.js"
import {
  initializeAtmoShaperWorkspaceRecipe,
  removeRetainedAtmoShaperLayer,
  restoreRetainedAtmoShaperLayer,
  shouldSyncAtmoShaperWorkspaceRecipe,
} from "./workspace-model.js"
import { resolveSoundLibraryPromotionSettlement } from "./sound-library-model.js"

export type AtmoShaperLayerPatch = Partial<AtmoShaperLayer>

export type AtmoShaperPromotionTransaction = {
  generation: number
  sourceKey: string
  sourceName: string
  priorRecipe: AtmoShaperRecipe
  optimisticRecipe: AtmoShaperRecipe
}

export type AtmoShaperRecipeActions = {
  addLayer(layer: AtmoShaperLayer, options?: { announce?: boolean }): AtmoShaperRecipe
  updateLayer(layerId: string, patch: AtmoShaperLayerPatch): void
  removeLayer(layerId: string): void
  moveLayer(layerId: string, toIndex: number, layerName: string): void
  removeRetainedLayer(layer: AtmoShaperLayer): void
  reset(): void
  restoreRetainedLayer(layer: AtmoShaperLayer, patch: AtmoShaperLayerPatch): void
  settleLayerPromotion(
    transaction: AtmoShaperPromotionTransaction,
    settlement: AtmoShaperPromotionResult,
  ): void
}

type RecipeOwnerState = {
  announcement: { id: number, message: string } | null
  recipe: AtmoShaperRecipe
  syncRevision: number
}

type RecipeOwnerAction =
  | { type: "add", recipe: AtmoShaperRecipe, announce: boolean }
  | { type: "announce", message: string }
  | { type: "move", layerId: string, toIndex: number, layerName: string }
  | { type: "remove", layerId: string }
  | { type: "remove-retained", layer: AtmoShaperLayer }
  | { type: "reset" }
  | { type: "restore-retained", layer: AtmoShaperLayer, patch: AtmoShaperLayerPatch }
  | {
    type: "settle-promotion"
    transaction: AtmoShaperPromotionTransaction
    settlement: AtmoShaperPromotionResult
  }
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
        ...state,
        recipe: action.recipe,
        announcement: action.announce
          ? nextAnnouncement(state, "Layer added.")
          : state.announcement,
      }
    case "settle-promotion": {
      const resolution = resolveSoundLibraryPromotionSettlement(
        state.recipe,
        action.transaction,
        action.settlement,
      )
      return {
        ...state,
        recipe: resolution.recipe,
        announcement: resolution.announcement
          ? nextAnnouncement(state, resolution.announcement)
          : state.announcement,
        syncRevision: state.syncRevision + resolution.syncRevisionDelta,
      }
    }
    case "update":
      return {
        ...state,
        recipe: updateAtmoShaperLayer(state.recipe, action.layerId, action.patch),
      }
    case "remove":
      return {
        ...state,
        recipe: removeAtmoShaperLayer(state.recipe, action.layerId),
        announcement: nextAnnouncement(state, "Layer removed."),
      }
    case "move":
      return {
        ...state,
        recipe: moveAtmoShaperLayer(state.recipe, action.layerId, action.toIndex),
        announcement: nextAnnouncement(
          state,
          `${action.layerName} moved to position ${action.toIndex + 1}.`,
        ),
      }
    case "restore-retained":
      return {
        ...state,
        recipe: restoreRetainedAtmoShaperLayer(state.recipe, action.layer, action.patch),
      }
    case "remove-retained":
      return {
        ...state,
        recipe: removeRetainedAtmoShaperLayer(state.recipe, action.layer),
        announcement: nextAnnouncement(state, "Layer removed."),
      }
    case "reset":
      return {
        ...state,
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
    recipe: initializeAtmoShaperWorkspaceRecipe({
      activePlaybackKind: music.activePlaybackKind,
      retainedRecipe: music.atmoShaperSnapshot?.recipe ?? null,
      createId: () => crypto.randomUUID(),
    }),
    announcement: null,
    syncRevision: 0,
  }))
  const { recipe, syncRevision } = state

  useEffect(() => {
    if (!shouldSyncAtmoShaperWorkspaceRecipe({
      activePlaybackKind: music.activePlaybackKind,
      localRecipeId: recipe.id,
      providerRecipeId: music.atmoShaperSnapshot?.recipe?.id ?? null,
    })) return
    void updateAtmoShaper(recipe)
  }, [
    music.activePlaybackKind,
    music.atmoShaperSnapshot?.recipe?.id,
    recipe,
    syncRevision,
    updateAtmoShaper,
  ])

  const actions: AtmoShaperRecipeActions = {
    addLayer(layer, options) {
      const nextRecipe = addAtmoShaperLayer(recipe, layer)
      dispatch({ type: "add", recipe: nextRecipe, announce: options?.announce !== false })
      return nextRecipe
    },
    updateLayer(layerId, patch) {
      dispatch({ type: "update", layerId, patch })
    },
    removeLayer(layerId) {
      dispatch({ type: "remove", layerId })
    },
    moveLayer(layerId, toIndex, layerName) {
      dispatch({ type: "move", layerId, toIndex, layerName })
    },
    restoreRetainedLayer(layer, patch) {
      dispatch({ type: "restore-retained", layer, patch })
    },
    removeRetainedLayer(layer) {
      dispatch({ type: "remove-retained", layer })
    },
    reset() {
      dispatch({ type: "reset" })
    },
    settleLayerPromotion(transaction, settlement) {
      dispatch({ type: "settle-promotion", transaction, settlement })
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
