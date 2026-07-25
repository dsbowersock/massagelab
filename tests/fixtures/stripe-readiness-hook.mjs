import { registerHooks } from "node:module"

const stripeStubUrl = new URL("./stripe-readiness-stripe-stub.mjs", import.meta.url).href

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "stripe") {
      return {
        shortCircuit: true,
        url: stripeStubUrl,
      }
    }
    return nextResolve(specifier, context)
  },
})
