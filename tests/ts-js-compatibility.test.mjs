import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { basename } from "node:path"
import { describe, it } from "node:test"

const libDirectory = new URL("../lib/", import.meta.url)

async function discoverDuplicatePairs() {
  const entries = await readdir(libDirectory, { withFileTypes: true })
  const fileNames = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name))

  return Array.from(fileNames)
    .filter((fileName) => fileName.endsWith(".js"))
    .map((fileName) => basename(fileName, ".js"))
    .filter((moduleName) => fileNames.has(`${moduleName}.ts`))
    .sort()
}

function stripTypeScriptComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .trim()
}

describe("TS/JS compatibility wrappers", () => {
  it("keeps the duplicate lib .js files as thin compatibility wrappers", async () => {
    const duplicatePairs = await discoverDuplicatePairs()

    assert.ok(duplicatePairs.length > 0, "should discover at least one TS/JS compatibility pair")

    for (const moduleName of duplicatePairs) {
      const jsSource = await readFile(new URL(`../lib/${moduleName}.js`, import.meta.url), "utf8")
      const tsSource = await readFile(new URL(`../lib/${moduleName}.ts`, import.meta.url), "utf8")
      const implementationSource = stripTypeScriptComments(tsSource)

      assert.equal(jsSource.trim(), `export * from "./${moduleName}.ts"`, `${moduleName}.js should re-export the TS source`)
      assert.match(
        implementationSource,
        /\b(?:export|const|function|class|type|interface|enum)\b/,
        `${moduleName}.ts should contain implementation source beyond comments`,
      )
    }
  })

  it("keeps the project configured for direct TS implementation imports", async () => {
    const packageSource = await readFile(new URL("../package.json", import.meta.url), "utf8")
    const tsconfigSource = await readFile(new URL("../tsconfig.json", import.meta.url), "utf8")
    const packageJson = JSON.parse(packageSource)
    const tsconfig = JSON.parse(tsconfigSource)

    assert.equal(packageJson.type, "module")
    assert.equal(tsconfig.compilerOptions.allowImportingTsExtensions, true)
    assert.equal(tsconfig.compilerOptions.noEmit, true)
  })
})
