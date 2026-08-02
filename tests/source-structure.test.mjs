import assert from "node:assert/strict"
import test from "node:test"

import { extractInterfaceBody, maskCssComments, maskSourceComments } from "./helpers/source-structure.mjs"

test("comment masking preserves quoted program text and JSX apostrophes", () => {
  const source = `
    const doubleQuoted = "// executable";
    const singleQuoted = '/* executable */';
    const template = \`// executable template\`;
    const pattern = /executable regex/;
    const urlPattern = /https?:\\/\\/example\\.test\\/path/;
    const jsx = <p>DNA isn't random by color.</p>;
    // masked line comment
    /* masked block comment */
  `

  const masked = maskSourceComments(source)
  assert.match(masked, /"\/\/ executable"/)
  assert.match(masked, /'\/\* executable \*\/'/)
  assert.match(masked, /`\/\/ executable template`/)
  assert.match(masked, /executable regex/)
  assert.ok(masked.includes(String.raw`const urlPattern = /https?:\/\/example\.test\/path/;`))
  assert.match(masked, /DNA isn't random by color/)
  assert.doesNotMatch(masked, /masked line comment|masked block comment/)
})

test("interface extraction ignores braces in comments and quoted types", () => {
  const source = `
    // A non-BMP marker before the declaration must not shift UTF-16 offsets: 🧬
    /** {@link Example} keeps a documentation brace. */
    export interface Example {
      literal: "}";
      singleQuoted: '{still-text}';
      template: \`value-{still-text}\`;
      nested: { enabled: boolean };
      // A trailing { comment must not affect balancing.
      final: number;
    }

    export interface ExampleExtra { unrelated: false }
    export interface Later { unrelated: true }
  `

  const body = extractInterfaceBody(source, "Example")
  assert.match(body, /literal: "}"/)
  assert.match(body, /singleQuoted: '\{still-text\}'/)
  assert.match(body, /nested: \{ enabled: boolean \}/)
  assert.match(body, /final: number/)
  assert.doesNotMatch(body, /unrelated/)
})

test("interface extraction skips object types in generic extends clauses", () => {
  const source = `
    interface Base<T> { base: T }
    export interface Example extends Base<{ nested: string }> {
      actual: number
    }
  `

  const body = extractInterfaceBody(source, "Example", "generic fixture")
  assert.match(body, /actual: number/)
  assert.doesNotMatch(body, /nested: string/)
})

test("CSS comment masking preserves URL slashes and quoted text", () => {
  const masked = maskCssComments(`.hero { background: url(https://cdn.example/image.png); content: "//"; } /* prose */`)
  assert.match(masked, /https:\/\/cdn\.example\/image\.png/)
  assert.match(masked, /content: "\/\/"/)
  assert.doesNotMatch(masked, /prose/)
})

test("interface extraction requires balanced quoted and comment state", () => {
  assert.throws(
    () => extractInterfaceBody("export interface Broken { value: `unterminated", "Broken", "broken-fixture.ts"),
    /broken-fixture\.ts has an unterminated ` starting at offset \d+/,
  )
  assert.throws(
    () => extractInterfaceBody('export interface Broken { value: "unterminated', "Broken", "double-quote.ts"),
    /double-quote\.ts has an unterminated " starting at offset \d+/,
  )
  assert.throws(
    () => extractInterfaceBody("export interface Broken { value: 'unterminated", "Broken", "single-quote.ts"),
    /single-quote\.ts has an unterminated ' starting at offset \d+/,
  )
  assert.throws(
    () => extractInterfaceBody("export interface Broken { value: string /* unterminated", "Broken", "block-comment.ts"),
    /block-comment\.ts has an unterminated block-comment starting at offset \d+/,
  )
})
