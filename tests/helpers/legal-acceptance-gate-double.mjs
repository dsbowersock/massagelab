/** Creates an isolated legal-gate double with resettable provider-redirect invocation history. */
export function createStrictLegalAcceptanceGateDouble() {
  const legalRedirectInvocations = []
  const strictLegalAcceptanceGate = {
    buildRegistrationLegalProviderRedirectPath(...args) {
      legalRedirectInvocations.push(args)
      return "/register?callbackUrl=%2F"
    },
  }

  return {
    legalRedirectInvocations,
    resetLegalRedirectInvocations() {
      legalRedirectInvocations.length = 0
    },
    strictLegalAcceptanceGate,
  }
}
