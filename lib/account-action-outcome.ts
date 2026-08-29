type AccountActionOutcomeInput<Path extends string> = {
  run: () => Promise<unknown>
  successPath: Path
  failurePath: Path
}

/** Maps operational settlement to caller-owned fixed paths without redirecting. */
export async function settleAccountAction<Path extends string>({
  run,
  successPath,
  failurePath,
}: AccountActionOutcomeInput<Path>): Promise<Path> {
  try {
    await run()
    return successPath
  } catch {
    return failurePath
  }
}
