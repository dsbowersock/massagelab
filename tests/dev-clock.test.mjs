import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import ts from "typescript"

/** Collects one JSX tag beneath only the caller-provided roots. */
function collectJsxElementsByTag(sourceFile, roots, expectedTagName) {
  const matches = []
  function visit(node) {
    const tagName = ts.isJsxElement(node)
      ? node.openingElement.tagName.getText(sourceFile)
      : ts.isJsxSelfClosingElement(node)
        ? node.tagName.getText(sourceFile)
        : null
    if (tagName === expectedTagName) matches.push(node)
    ts.forEachChild(node, visit)
  }
  for (const root of roots) visit(root)
  return matches
}

/** Requires the keyed account bootstrap JSX owner to structurally contain Music. */
function assertAccountBootstrapOwnsMusic(layoutSource) {
  const sourceFile = ts.createSourceFile(
    "app/layout.tsx",
    layoutSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const accountProviders = collectJsxElementsByTag(
    sourceFile,
    [sourceFile],
    "AccountShellBootstrapProvider",
  )

  assert.equal(accountProviders.length, 1, "layout must have exactly one AccountShellBootstrapProvider")
  const accountProvider = accountProviders[0]
  assert.ok(ts.isJsxElement(accountProvider), "AccountShellBootstrapProvider must own nested JSX")
  const keyAttribute = accountProvider.openingElement.attributes.properties.find((attribute) => (
    ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === "key"
  ))
  assert.ok(
    keyAttribute
      && ts.isJsxAttribute(keyAttribute)
      && keyAttribute.initializer
      && ts.isJsxExpression(keyAttribute.initializer)
      && keyAttribute.initializer.expression,
    "AccountShellBootstrapProvider must retain its owner-key expression",
  )
  assert.equal(
    keyAttribute.initializer.expression.getText(sourceFile),
    'accountBootstrap.ownerKey ?? "anonymous"',
  )

  const musicProviders = collectJsxElementsByTag(
    sourceFile,
    accountProvider.children,
    "MusicProvider",
  )
  assert.equal(musicProviders.length, 1, "AccountShellBootstrapProvider must contain one MusicProvider")
}

/** Selects the sole direct owner-adoption effect inside the exported MusicProvider. */
function selectMusicOwnerAdoption(sourceText) {
  const sourceFile = ts.createSourceFile(
    "components/providers/music-provider.tsx",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const providers = sourceFile.statements.filter((statement) => (
    ts.isFunctionDeclaration(statement)
    && statement.name?.text === "MusicProvider"
    && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  ))
  assert.equal(providers.length, 1, `expected exactly one exported MusicProvider; found ${providers.length}`)
  assert.ok(providers[0].body, "exported MusicProvider must have a body")
  const candidates = []

  for (const statement of providers[0].body.statements) {
    if (!ts.isExpressionStatement(statement)) continue
    const node = statement.expression
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === "useEffect"
    ) {
      const callback = node.arguments[0]
      if (
        callback
        && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
        && ts.isBlock(callback.body)
      ) {
        const statements = [...callback.body.statements]
        const hasOwnerChangedDeclaration = statements.some((statement) => (
          ts.isVariableStatement(statement)
          && statement.declarationList.declarations.some((declaration) => (
            ts.isIdentifier(declaration.name) && declaration.name.text === "ownerChanged"
          ))
        ))
        const hasOwnerAdoptionAssignment = statements.some((statement) => {
          if (!ts.isExpressionStatement(statement) || !ts.isBinaryExpression(statement.expression)) return false
          const assignment = statement.expression
          return assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken
            && ts.isPropertyAccessExpression(assignment.left)
            && ts.isIdentifier(assignment.left.expression)
            && assignment.left.expression.text === "adoptedAccountOwnerRef"
            && assignment.left.name.text === "current"
        })
        const resetBlocks = statements.filter((statement) => (
          ts.isIfStatement(statement)
          && ts.isIdentifier(statement.expression)
          && statement.expression.text === "ownerChanged"
        ))
        if (hasOwnerChangedDeclaration && hasOwnerAdoptionAssignment && resetBlocks.length > 0) {
          candidates.push({ effect: callback.body, resetBlocks })
        }
      }
    }
  }

  assert.equal(
    candidates.length,
    1,
    `expected exactly one Music owner-adoption useEffect; found ${candidates.length}`,
  )
  const [{ effect, resetBlocks }] = candidates
  assert.equal(
    resetBlocks.length,
    1,
    `expected exactly one direct ownerChanged reset block; found ${resetBlocks.length}`,
  )
  const reset = resetBlocks[0]
  assert.ok(ts.isIfStatement(reset) && ts.isBlock(reset.thenStatement), "ownerChanged reset must remain a block")
  return {
    effectSource: sourceText.slice(effect.getStart(sourceFile), effect.getEnd()),
    resetSource: sourceText.slice(reset.thenStatement.getStart(sourceFile), reset.thenStatement.getEnd()),
  }
}

describe("development Clock review route", () => {
  it("is development-only and renders the production Clock implementation", async () => {
    const source = await readFile(
      new URL("../app/dev/clock/page.tsx", import.meta.url),
      "utf8",
    )

    assert.match(source, /process\.env\.NODE_ENV === "production"[\s\S]*notFound\(\)/)
    assert.match(source, /<ChimerPage developmentSubscriberReview \/>/)
    assert.doesNotMatch(source, /MovingBackground|RunningTimer|BackgroundHost/)
  })

  it("uses paid feature keys without account sync and isolates review settings", async () => {
    const source = await readFile(
      new URL("../app/chimer/page.tsx", import.meta.url),
      "utf8",
    )

    assert.match(
      source,
      /const DEV_CLOCK_FEATURE_KEYS = \[\s*FEATURE_KEYS\.premiumBackgrounds,\s*\]/,
    )
    assert.match(source, /const DEV_CLOCK_STORAGE_KEY = "massagelab-dev-clock-settings"/)
    assert.match(
      source,
      /const immersiveContext = developmentSubscriberReview\s*\? "clock"/,
    )
    assert.match(
      source,
      /if \(developmentSubscriberReview\) \{[\s\S]*setCanSync\(false\)[\s\S]*setAccountSyncStatus\("synced"\)[\s\S]*\} else \{\s*requestAccountSync\(\)/,
    )
    assert.match(source, /localStorage\.setItem\(storageKey/)
  })

  it("keeps the retired custom-color contract out of runtime sources", async () => {
    const sources = await Promise.all([
      "../app/chimer/page.tsx",
      "../app/chimer/running-timer.tsx",
      "../app/account/page.tsx",
      "../components/sidebar/sidebar.tsx",
      "../auth.ts",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")))

    for (const source of sources) {
      assert.doesNotMatch(source, /chimerCustomColors|chimer_custom_colors|canUseChimerCustomColors|canUseCustomColors|canUseAccountColorControls/)
    }
  })

  it("uses the Clock shell and stays anonymous when local auth is unconfigured", async () => {
    const [authSource, layoutSource, musicProviderSource, wrapperSource] = await Promise.all([
      readFile(new URL("../auth.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/providers/music-provider.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/layout-wrapper.tsx", import.meta.url), "utf8"),
    ])

    assert.match(
      authSource,
      /process\.env\.NODE_ENV !== "production" && !getAuthSecret\(\)[\s\S]*return Promise\.resolve\(null\)/,
    )
    assert.match(authSource, /return auth\(\)/)
    assertAccountBootstrapOwnsMusic(layoutSource)
    assert.doesNotMatch(layoutSource, /accountSyncEnabled/)
    assert.match(musicProviderSource, /useAccountShellBootstrap/)
    assert.match(
      musicProviderSource,
      /bootstrapStatus === "anonymous"[\s\S]*setAccountStatus\("anonymous"\)/,
    )
    assert.match(wrapperSource, /pathname === "\/dev\/clock"/)
  })

  it("selects one co-located Music owner-adoption effect and reset branch", () => {
    const provider = (body) => `export function MusicProvider() { ${body} }`
    const effect = `
      useEffect(() => {
        const ownerChanged = previousOwner.ownerKey !== ownerKey
        adoptedAccountOwnerRef.current = { ownerKey, syncEnabled }
        if (ownerChanged) { accountIntentTracker.clear() }
      }, [])
    `
    assert.match(selectMusicOwnerAdoption(provider(effect)).resetSource, /accountIntentTracker\.clear\(\)/)
    assert.throws(
      () => selectMusicOwnerAdoption(provider(`
        useEffect(() => { const ownerChanged = true }, [])
        useEffect(() => {
          adoptedAccountOwnerRef.current = { ownerKey, syncEnabled }
          if (ownerChanged) { accountIntentTracker.clear() }
        }, [])
      `)),
      /expected exactly one Music owner-adoption useEffect; found 0/,
    )
    assert.throws(
      () => selectMusicOwnerAdoption(provider(`${effect}\n${effect}`)),
      /expected exactly one Music owner-adoption useEffect; found 2/,
    )
    assert.throws(
      () => selectMusicOwnerAdoption(provider(effect.replace(
        "if (ownerChanged) { accountIntentTracker.clear() }",
        "if (ownerChanged) { accountIntentTracker.clear() } if (ownerChanged) { accountRequestIdRef.current += 1 }",
      ))),
      /expected exactly one direct ownerChanged reset block; found 2/,
    )
    assert.throws(
      () => selectMusicOwnerAdoption(provider(`function unrelated() { ${effect} }`)),
      /expected exactly one Music owner-adoption useEffect; found 0/,
    )
  })

  it("resets stale Music transport when the account bootstrap owner changes", async () => {
    const musicProviderSource = await readFile(
      new URL("../components/providers/music-provider.tsx", import.meta.url),
      "utf8",
    )
    const {
      effectSource: ownerAdoptionSource,
      resetSource: ownerResetSource,
    } = selectMusicOwnerAdoption(musicProviderSource)
    assert.match(ownerAdoptionSource, /if \(!storageHydrated\) \{\s*return\s*\}/)
    assert.match(
      ownerAdoptionSource,
      /const ownerChanged = previousOwner\.ownerKey !== ownerKey\s*\|\| previousOwner\.syncEnabled !== syncEnabled/,
    )
    assert.match(ownerAdoptionSource, /adoptedAccountOwnerRef\.current = \{ ownerKey, syncEnabled \}/)
    assert.match(
      ownerAdoptionSource,
      /if \(bootstrapStatus === "anonymous" \|\| !syncEnabled \|\| !ownerKey\)/,
    )
    assert.match(ownerResetSource, /accountIntentTracker\.clear\(\)/)
    assert.match(ownerResetSource, /accountRequestIdRef\.current \+= 1/)
    assert.match(ownerResetSource, /accountWritePendingRef\.current = null/)
  })

  it("skips Music preference persistence without a sync-enabled account owner", async () => {
    const musicProviderSource = await readFile(
      new URL("../components/providers/music-provider.tsx", import.meta.url),
      "utf8",
    )
    const persistPreferencesStart = musicProviderSource.indexOf(
      "const persistVisualizerAccountPreferences = useCallback(",
    )
    assert.notEqual(
      persistPreferencesStart,
      -1,
      "Music provider visualizer-persistence callback start missing",
    )
    const mediaOwnershipAnchor = musicProviderSource.indexOf(
      "carrierEventBridgeRef.current = bridge",
      persistPreferencesStart,
    )
    assert.notEqual(mediaOwnershipAnchor, -1, "Music provider media-ownership effect anchor missing")
    const persistPreferencesEnd = musicProviderSource.lastIndexOf(
      "useEffect(() => {",
      mediaOwnershipAnchor,
    )
    assert.ok(
      persistPreferencesEnd > persistPreferencesStart,
      "Music provider visualizer-persistence callback boundaries missing or reordered",
    )
    const persistPreferencesSource = musicProviderSource.slice(
      persistPreferencesStart,
      persistPreferencesEnd,
    )
    assert.match(
      persistPreferencesSource,
      /if \(!syncEnabled \|\| !ownerKey\) \{\s*return\s*\}/,
    )
    assert.doesNotMatch(musicProviderSource, /syncVisualizerAccountPreferences/)
  })
})
