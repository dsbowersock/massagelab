import { redirect } from "next/navigation"

export const RETIRED_PROCESSED_BATCH_IDS = new Set(["batch-01-campfire-boiling-water"])

/** Keeps removed review identities useful by sending their old links to the replacement concept. */
export function redirectRetiredProcessingBatch(batchId: string | string[] | undefined) {
  if (batchId === "batch-01-campfire-boiling-water") {
    redirect("/dev/candidates/processing?batch=batch-30-fireplace")
  }
}
