import { safeErrorCode } from "@/lib/safe-error-code"

type AccountActionOperation = "profile-save" | "credential-submission"

type AccountActionOutcomeInput<Path extends string> = {
  operation: AccountActionOperation
  run: () => Promise<unknown>
  successPath: Path
  failurePath: Path
}

/**
 * Executes the caller-owned asynchronous `run`; its resolved value is ignored.
 * Returns exactly `successPath` on resolution or `failurePath` on rejection.
 * Failure logs must stay limited to the allowlisted operation and sanitized code.
 */
export async function settleAccountAction<Path extends string>({
  operation,
  run,
  successPath,
  failurePath,
}: AccountActionOutcomeInput<Path>): Promise<Path> {
  try {
    await run()
    return successPath
  } catch (error) {
    console.error("Account action settlement failed", { operation, code: safeErrorCode(error) })
    return failurePath
  }
}
