import { safeErrorCode } from "@/lib/safe-error-code"

type AccountActionOperation = "profile-save" | "credential-submission"

type AccountActionOutcomeInput<Path extends string> = {
  operation: AccountActionOperation
  run: () => Promise<unknown>
  successPath: Path
  failurePath: Path
}

/** Maps operational settlement to caller-owned fixed paths without redirecting. */
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
