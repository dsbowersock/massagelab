import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const [
  schema,
  migration,
  deployment,
  releaseChecklist,
  hardeningDesign,
  operationalLimiterPlan,
  publicBookingPlan,
  anatomimeTrafficPlan,
] = await Promise.all([
  readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../prisma/migrations/20260831120000_operational_rate_limit_bucket/migration.sql",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../docs/wiki/deployment.md", import.meta.url), "utf8"),
  readFile(new URL("../docs/wiki/release-checklist.md", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../docs/superpowers/specs/2026-08-31-family-friends-abuse-cost-hardening-design.md",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(
    new URL(
      "../docs/superpowers/plans/2026-08-31-operational-limiter-email-ceiling.md",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(
    new URL(
      "../docs/superpowers/plans/2026-08-31-public-booking-traffic-hardening.md",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(
    new URL(
      "../docs/superpowers/plans/2026-08-31-anatomime-traffic-hardening.md",
      import.meta.url,
    ),
    "utf8",
  ),
])

/** Returns a required capture so a missing declaration fails in its owning test. */
function requiredCapture(source, pattern, label) {
  const match = source.match(pattern)
  assert.ok(match, `expected ${label}`)
  return match[1]
}

/** Returns normalized semantic model lines while excluding blank, //, and /// documentation lines. */
function modelBodyLines(source, modelName) {
  return requiredCapture(
    source,
    new RegExp(`model\\s+${modelName}\\s*\\{([\\s\\S]*?)\\}`),
    `${modelName} model`,
  )
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line && !line.startsWith("//"))
}

/** Requires every clause in a documentation contract to occur within one paragraph. */
function assertParagraphMatches(source, pattern, label) {
  const paragraphs = source
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  assert.ok(
    paragraphs.some((paragraph) => pattern.test(paragraph)),
    `${label}: expected one paragraph to match ${pattern}`,
  )
}

/** Normalizes layout-only whitespace without weakening SQL token checks. */
function normalizeSql(value) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+\(/g, "(")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim()
}

const SQL_QUOTED_TOKEN_PATTERN = /'(?:''|[^'])*'|"(?:""|[^"])*"/g

/** Removes SQL comments without treating comment markers inside simple quoted tokens as syntax. */
function sqlWithoutComments(source) {
  let output = ""
  let index = 0
  let quote = null

  while (index < source.length) {
    const character = source[index]
    const nextCharacter = source[index + 1]

    if (quote) {
      output += character
      index += 1
      if (character === quote) {
        if (source[index] === quote) {
          output += source[index]
          index += 1
        } else {
          quote = null
        }
      }
      continue
    }

    if (character === "'" || character === '"') {
      quote = character
      output += character
      index += 1
      continue
    }
    if (character === "-" && nextCharacter === "-") {
      output += " "
      index += 2
      while (index < source.length && source[index] !== "\r" && source[index] !== "\n") {
        index += 1
      }
      continue
    }
    if (character === "/" && nextCharacter === "*") {
      output += " "
      index += 2
      let closed = false
      while (index < source.length) {
        if (source[index] === "*" && source[index + 1] === "/") {
          index += 2
          closed = true
          break
        }
        if (source[index] === "\r" || source[index] === "\n") output += source[index]
        index += 1
      }
      if (!closed) {
        throw new Error("sqlStatements only supports migration SQL with terminated block comments")
      }
      continue
    }

    output += character
    index += 1
  }

  return output
}

/** Returns comment-free SQL after rejecting syntax outside this migration-only splitter's subset. */
function assertMigrationSqlSubset(source) {
  const commentFreeSource = sqlWithoutComments(source)
  const quotedTokens = commentFreeSource.match(SQL_QUOTED_TOKEN_PATTERN) ?? []
  if (quotedTokens.some((token) => token.includes(";"))) {
    throw new Error("sqlStatements only supports migration SQL without quoted semicolons")
  }
  const structuralSource = commentFreeSource.replace(SQL_QUOTED_TOKEN_PATTERN, "")
  if (/\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.test(structuralSource)) {
    throw new Error("sqlStatements only supports migration SQL without dollar-quoted bodies")
  }
  if (/['"]/.test(structuralSource)) {
    throw new Error("sqlStatements only supports migration SQL with balanced simple quotes")
  }
  return commentFreeSource
}

/** Produces ordered statements for the current migration's enforced simple-DDL subset. */
function sqlStatements(source) {
  return assertMigrationSqlSubset(source)
    .split(";")
    .map(normalizeSql)
    .filter(Boolean)
}

describe("operational rate-limit persistence", () => {
  it("keeps the three active delivery-claim fields and adds one append-only retry-key owner", () => {
    const documentedModelEntries = modelBodyLines(
      `model DocumentedModel {
        // implementation note
        /// field documentation

        id String
      }`,
      "DocumentedModel",
    )
    assert.deepEqual(documentedModelEntries, ["id String"])

    const entries = modelBodyLines(schema, "AdminEmailIntent")

    assert.ok(entries.includes("deliveryClaimTokenHash String?"))
    assert.ok(entries.includes("deliveryClaimExpiresAt DateTime?"))
    assert.ok(entries.includes("deliveryClaimOperationKeyHash String? @unique"))
    assert.equal(entries.filter((line) => /deliveryClaim/.test(line)).length, 3)

    const retryKeyEntries = modelBodyLines(schema, "AdminEmailRetryOperationKey")
    assert.deepEqual(retryKeyEntries, [
      "id String @id @default(cuid())",
      "emailIntentId String",
      "operationKeyHash String @unique",
      "createdAt DateTime @default(now())",
      "emailIntent AdminEmailIntent @relation(fields: [emailIntentId], references: [id], onDelete: Restrict)",
      "@@index([emailIntentId, createdAt])",
    ])

    const statuses = requiredCapture(
      schema,
      /enum\s+AdminEmailIntentStatus\s*\{([\s\S]*?)\}/,
      "AdminEmailIntentStatus enum",
    )
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    assert.deepEqual(statuses, ["PENDING", "DELIVERED", "FAILED"])
    assert.match(
      hardeningDesign,
      /owner stores only[^.]*retry operation-key hash[\s\S]*raw retry operation keys never enter active claim\s+state or the append-only owner[\s\S]*raw retry key only in[\s\S]*AdminAction\.idempotencyKey/i,
      "binding design",
    )
    assert.doesNotMatch(hardeningDesign, /and\s+retry operation keys never enter active claim\s+state or the append-only owner/i, "binding design")
  })

  it("declares the exact closed operational scope enum", () => {
    const values = requiredCapture(
      schema,
      /enum\s+OperationalRateLimitScope\s*\{([\s\S]*?)\}/,
      "OperationalRateLimitScope enum",
    )
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    assert.deepEqual(values, ["GLOBAL", "NETWORK", "ACCOUNT", "RESOURCE"])
  })

  it("declares the exact bucket fields, defaults, unique owner, and cleanup indexes", () => {
    const entries = modelBodyLines(schema, "OperationalRateLimitBucket")

    assert.deepEqual(entries, [
      "id String @id @default(cuid())",
      "policy String",
      "scope OperationalRateLimitScope",
      "keyHash String",
      "count Int @default(0)",
      "windowStart DateTime @default(now())",
      "blockedUntil DateTime?",
      "updatedAt DateTime @updatedAt",
      "@@unique([policy, scope, keyHash])",
      "@@index([updatedAt])",
      "@@index([blockedUntil])",
    ])
  })

  it("ignores quote, semicolon, and dollar markers inside SQL comments", () => {
    const source = `
-- ignored 'quoted; text' and $$ body marker
BEGIN;
/* ignored "quoted; text" and $body$ marker */
COMMIT;
`

    assert.deepEqual(sqlStatements(source), ["BEGIN", "COMMIT"])
  })

  it("preserves SQL comment markers inside quoted tokens", () => {
    const source = `CREATE TABLE "--kept" ("value" TEXT DEFAULT '/* kept */');`

    assert.deepEqual(sqlStatements(source), [
      `CREATE TABLE "--kept"("value" TEXT DEFAULT '/* kept */')`,
    ])
  })

  it("creates the limiter, active claim fields, and append-only retry-key owner in one migration", () => {
    for (const [source, message] of [
      ["INSERT INTO example (value) VALUES ('embedded;terminator');", "sqlStatements only supports migration SQL without quoted semicolons"],
      ["DO $$ BEGIN PERFORM 1; END $$;", "sqlStatements only supports migration SQL without dollar-quoted bodies"],
      ["SELECT 'unterminated", "sqlStatements only supports migration SQL with balanced simple quotes"],
    ]) {
      assert.throws(() => sqlStatements(source), { message })
    }
    assert.deepEqual(sqlStatements(migration), [
      "BEGIN",
      'CREATE TYPE "OperationalRateLimitScope" AS ENUM(\'GLOBAL\', \'NETWORK\', \'ACCOUNT\', \'RESOURCE\')',
      'CREATE TABLE "OperationalRateLimitBucket"("id" TEXT NOT NULL, "policy" TEXT NOT NULL, "scope" "OperationalRateLimitScope" NOT NULL, "keyHash" TEXT NOT NULL, "count" INTEGER NOT NULL DEFAULT 0, "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "blockedUntil" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "OperationalRateLimitBucket_pkey" PRIMARY KEY("id"))',
      'CREATE UNIQUE INDEX "OperationalRateLimitBucket_policy_scope_keyHash_key" ON "OperationalRateLimitBucket"("policy", "scope", "keyHash")',
      'CREATE INDEX "OperationalRateLimitBucket_updatedAt_idx" ON "OperationalRateLimitBucket"("updatedAt")',
      'CREATE INDEX "OperationalRateLimitBucket_blockedUntil_idx" ON "OperationalRateLimitBucket"("blockedUntil")',
      'ALTER TABLE "AdminEmailIntent" ADD COLUMN "deliveryClaimTokenHash" TEXT, ADD COLUMN "deliveryClaimExpiresAt" TIMESTAMP(3), ADD COLUMN "deliveryClaimOperationKeyHash" TEXT',
      'CREATE UNIQUE INDEX "AdminEmailIntent_deliveryClaimOperationKeyHash_key" ON "AdminEmailIntent"("deliveryClaimOperationKeyHash")',
      'CREATE TABLE "AdminEmailRetryOperationKey"("id" TEXT NOT NULL, "emailIntentId" TEXT NOT NULL, "operationKeyHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AdminEmailRetryOperationKey_pkey" PRIMARY KEY("id"))',
      'CREATE UNIQUE INDEX "AdminEmailRetryOperationKey_operationKeyHash_key" ON "AdminEmailRetryOperationKey"("operationKeyHash")',
      'CREATE INDEX "AdminEmailRetryOperationKey_emailIntentId_createdAt_idx" ON "AdminEmailRetryOperationKey"("emailIntentId", "createdAt")',
      'ALTER TABLE "AdminEmailRetryOperationKey" ADD CONSTRAINT "AdminEmailRetryOperationKey_emailIntentId_fkey" FOREIGN KEY("emailIntentId") REFERENCES "AdminEmailIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
      "COMMIT",
    ])
    assert.match(
      operationalLimiterPlan,
      /eight table columns\/defaults \(`id` plus seven non-id columns: `policy`, `scope`, `keyHash`, `count`, `windowStart`, `blockedUntil`, and `updatedAt`\)/i,
    )
    assert.match(
      operationalLimiterPlan,
      /Task 1 limiter portion[\s\S]*no [^.]*foreign key[\s\S]*Task 4[\s\S]*same (?:single )?migration[\s\S]*`RESTRICT` foreign key/i,
    )
    assert.doesNotMatch(operationalLimiterPlan, /those seven table columns\/defaults/i)
    assert.doesNotMatch(operationalLimiterPlan, /The migration creates[^.]*It contains no [^.]*foreign key/i)
  })

  it("keeps the entire approved migration inside one explicit transaction", () => {
    const statements = sqlStatements(migration)

    assert.equal(statements[0], "BEGIN")
    assert.equal(statements.at(-1), "COMMIT")
    assert.equal(statements.filter((statement) => statement === "BEGIN").length, 1)
    assert.equal(statements.filter((statement) => statement === "COMMIT").length, 1)
  })

  it("requires the exact-zero AdminEmailIntent rollout preflight", () => {
    assert.match(migration, /intentionally non-concurrent[\s\S]*exactly zero rows[\s\S]*approved single migration/i)
    assert.match(migration, /multiple NULL values[\s\S]*would not collide[\s\S]*exact-zero gate[\s\S]*deliberately stronger[\s\S]*rollout state[\s\S]*lock[\s\S]*re-review/i)
    assert.doesNotMatch(
      migration,
      /CREATE\s+UNIQUE\s+INDEX\s+CONCURRENTLY\s+"AdminEmailIntent_deliveryClaimOperationKeyHash_key"/i,
    )

    for (const [label, source] of [["deployment", deployment], ["release checklist", releaseChecklist]]) {
      assert.match(source, /count-only Production `AdminEmailIntent` row-count preflight/i, label)
      assert.match(source, /immediately before[^.]*20260831120000_operational_rate_limit_bucket/i, label)
      assert.match(source, /current read-only aggregate evidence\s+is `0`[^.]*must be refreshed/i, label)
      assert.match(source, /proceed only when the exact count is `0`/i, label)
      assert.match(source, /nonzero[^.]*stop[^.]*re-review/i, label)
    }
    for (const [label, source] of [
      ["deployment", deployment],
      ["release checklist", releaseChecklist],
      ["binding design", hardeningDesign],
      ["operational limiter plan", operationalLimiterPlan],
    ]) {
      assert.match(source, /multiple\s+`NULL`\s+values[\s\S]*do not collide[\s\S]*exact-zero gate[\s\S]*deliberately stronger[\s\S]*rollout\s+state[\s\S]*lock[\s\S]*re-review/i, label)
    }

    assert.match(hardeningDesign, /migration is expansion-only[\s\S]*three nullable `AdminEmailIntent` delivery-claim columns[\s\S]*unique `deliveryClaimOperationKeyHash` index[\s\S]*`AdminEmailRetryOperationKey` table[\s\S]*`RESTRICT` foreign key/i, "binding design")
    assert.match(hardeningDesign, /count-only Production `AdminEmailIntent` row-count preflight[\s\S]*immediately before[\s\S]*exact count is `0`[\s\S]*nonzero[\s\S]*hard stop/i, "binding design")
    assert.doesNotMatch(hardeningDesign, /creates the enum, table, unique key, and cleanup indexes without changing or backfilling existing rows/i, "binding design")
  })

  it("preserves the completed membership rollout sequence", () => {
    assert.match(hardeningDesign, /five identity and membership migrations[\s\S]*bridge ceremony[\s\S]*complete[\s\S]*writes enabled/i, "binding design")
    assert.match(hardeningDesign, /one new additive operational-limiter migration[\s\S]*exact candidate[\s\S]*ordinary separately authorized deploy[\s\S]*preserv(?:e|ing) current membership writer authority/i, "binding design")
    assert.doesNotMatch(hardeningDesign, /perform the already designed membership writer-pause deployment and drain proof/i, "binding design")
    assert.doesNotMatch(hardeningDesign, /first deploy[^.]*membership webhook writes paused[^.]*old writers drained[^.]*deploy the same SHA with writes enabled/i, "binding design")
  })

  it("requires idempotency lock and replay checks before booking quota consumption", () => {
    for (const [label, source] of [["binding design", hardeningDesign], ["public booking plan", publicBookingPlan]]) {
      assert.match(
        source,
        /narrow first (?:request-)?prefix lookup[\s\S]*prefix advisory lock[\s\S]*authoritative second (?:prefix )?lookup[\s\S]*only the (?:still-)?true remaining miss[\s\S]*consume[\s\S]*`BOOKING_CREATE`[\s\S]*heavy/i,
        label,
      )
      assert.match(
        source,
        /concurrent same-request[\s\S]*authoritative second (?:prefix )?lookup[\s\S]*without consuming (?:new )?quota/i,
        label,
      )
    }
    assert.match(publicBookingPlan, /only the (?:still-)?true remaining miss[\s\S]*consume[\s\S]*`WAITLIST_JOIN`[\s\S]*heavy/i)
    assert.doesNotMatch(publicBookingPlan, /On miss, consume `BOOKING_CREATE`[\s\S]*In the transaction, acquire the prefix advisory lock/i)
    assert.doesNotMatch(publicBookingPlan, /After quota[\s\S]*acquire the prefix lock\/recheck/i)
    assert.doesNotMatch(hardeningDesign, /A miss consumes quota before expensive booking work[\s\S]*write transaction then acquires/i, "binding design")
  })

  it("requires booking quota to use the outer Serializable transaction client", () => {
    for (const [label, source] of [["binding design", hardeningDesign], ["public booking plan", publicBookingPlan]]) {
      assert.match(
        source,
        /`consumeOperationalRateLimitInTransaction`[\s\S]*same `Prisma\.TransactionClient`[\s\S]*does not open a nested transaction[\s\S]*persistence errors propagate[\s\S]*outer bounded Serializable transaction/i,
        label,
      )
    }
  })

  it("bounds limiter diagnostics while keeping expected mail denials silent", () => {
    assert.match(
      hardeningDesign,
      /Expected limiter denials are intentionally silent at the shared mail boundary[\s\S]*future aggregate or sampled caller telemetry[\s\S]*only the allowlisted mail class\/policy and reason[\s\S]*never recipient, subject, or decision details/i,
      "binding design",
    )
    assert.doesNotMatch(hardeningDesign, /Expected denial logs contain/i, "binding design")
    for (const [label, source] of [
      ["binding design", hardeningDesign],
      ["operational limiter plan", operationalLimiterPlan],
    ]) {
      assert.match(
        source,
        /definition\/normalization failures[\s\S]*persistence\/retry failures[\s\S]*same public `UNAVAILABLE`/i,
        label,
      )
      assert.match(
        source,
        /at most once per runtime[\s\S]*allowlisted operation[\s\S]*fixed `UNKNOWN`[\s\S]*`DEFINITION`[\s\S]*`PERSISTENCE`/i,
        label,
      )
      assert.match(
        source,
        /never[^.]*subject[^.]*hash[^.]*request[^.]*error[^.]*decision/i,
        label,
      )
    }
  })

  it("requires non-consuming Anatomime ingress and one-snapshot atomic poll resolution", () => {
    const consumeJoinedContract = /^(?=[\s\S]*`consumeJoined`)(?=[\s\S]*`networkIdentifier`)(?=[\s\S]*`roomIdentifier`)(?=[\s\S]*`playerId`)(?=[\s\S]*atomically checks)(?=[\s\S]*network\+room)(?=[\s\S]*room)(?=[\s\S]*player)(?=[\s\S]*increments none)[\s\S]*$/i
    assert.throws(
      () => assertParagraphMatches(
        "one room read\n\nsame loaded snapshot",
        /one room read[\s\S]*same loaded snapshot/i,
        "split-paragraph fixture",
      ),
      /split-paragraph fixture/,
    )
    assertParagraphMatches(
      "`consumeJoined` atomically checks player, room, then network+room and increments none; it accepts `playerId`, `roomIdentifier`, and `networkIdentifier`.",
      consumeJoinedContract,
      "reordered consumeJoined fixture",
    )
    for (const [label, source] of [
      ["binding design", hardeningDesign],
      ["Anatomime plan", anatomimeTrafficPlan],
    ]) {
      assertParagraphMatches(
        source,
        /non-consuming `peekIngress`[\s\S]*denial makes no credential or room lookup/i,
        label,
      )
      assertParagraphMatches(
        source,
        /^(?=[\s\S]*one room (?:query|read))(?=[\s\S]*(?:same|sole) (?:loaded )?snapshot)(?=[\s\S]*pre-resolution guard)(?=[\s\S]*before (?:expiration|presence))[\s\S]*$/i,
        label,
      )
      assertParagraphMatches(
        source,
        /(?:ordinary|normal|accepted)[^.]*poll[^.]*same (?:loaded )?snapshot[^.]*(?:no second room (?:query|read)|does not[^.]*read another)/i,
        label,
      )
      assertParagraphMatches(
        source,
        /post-rollback[^.]*expiry[^.]*zero-row[^.]*reread[^.]*`EXPIRED`[^.]*(?:otherwise|divergent)[^.]*`503`/i,
        label,
      )
      assertParagraphMatches(
        source,
        consumeJoinedContract,
        label,
      )
      assertParagraphMatches(
        source,
        /`UNJOINED`[\s\S]*`INVALID`[\s\S]*durable quota semantics remain unchanged/i,
        label,
      )
    }
    assert.match(
      anatomimeTrafficPlan,
      /peekIngress\(input:\s*\{\s*networkIdentifier: string; roomIdentifier: string; now\?: Date\s*\}\): AnatomimePollShedDecision/,
    )
    assert.match(
      anatomimeTrafficPlan,
      /consumeJoined\(input:\s*\{\s*networkIdentifier: string; roomIdentifier: string; playerId: string; now\?: Date\s*\}\): AnatomimePollShedDecision/,
    )
    assert.doesNotMatch(anatomimeTrafficPlan, /consumeIngress\(/)
    assert.doesNotMatch(
      anatomimeTrafficPlan,
      /consumeJoined\(input:\s*\{\s*playerId: string; now\?: Date\s*\}/,
    )
  })

  it("contains no other existing-table change, data manipulation, or trigger", () => {
    const joinedSql = sqlStatements(migration).join(";\n")
    assert.equal((joinedSql.match(/\bALTER\s+TABLE\b/gi) ?? []).length, 2)
    assert.match(joinedSql, /ALTER\s+TABLE\s+"AdminEmailIntent"/i)
    assert.match(joinedSql, /ALTER\s+TABLE\s+"AdminEmailRetryOperationKey"/i)
    assert.doesNotMatch(joinedSql, /ALTER\s+TABLE\s+"(?!AdminEmailIntent"|AdminEmailRetryOperationKey")/i)
    assert.doesNotMatch(joinedSql, /\b(?:DROP|TRUNCATE|TRIGGER)\b|\b(?:UPDATE\s+"|DELETE\s+FROM|INSERT\s+INTO)\b/i)
    assert.equal((joinedSql.match(/\bREFERENCES\b/gi) ?? []).length, 1)
    assert.doesNotMatch(joinedSql, /AuthRateLimitBucket/)
  })
})
