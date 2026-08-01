import assert from "node:assert/strict"
import test from "node:test"

import { extractInterfaceBody } from "./helpers/source-structure.mjs"

test("interface extraction ignores braces in comments and quoted types", () => {
  const source = `
    // A non-BMP marker before the declaration must not shift UTF-16 offsets: 🧬
    /** {@link Example} keeps a documentation brace. */
    export interface Example {
      literal: "}";
      template: \`value-{still-text}\`;
      nested: { enabled: boolean };
      // A trailing { comment must not affect balancing.
      final: number;
    }

    export interface Later { unrelated: true }
  `

  const body = extractInterfaceBody(source, "Example")
  assert.match(body, /literal: "}"/)
  assert.match(body, /nested: \{ enabled: boolean \}/)
  assert.match(body, /final: number/)
  assert.doesNotMatch(body, /unrelated/)
})
