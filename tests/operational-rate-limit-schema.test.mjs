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

/** Rejects syntax that this migration-only statement splitter cannot parse safely. */
function assertMigrationSqlSubset(source) {
  if (/\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.test(source)) {
    throw new Error("sqlStatements only supports migration SQL without dollar-quoted bodies")
  }
  const quotedTokens = source.match(SQL_QUOTED_TOKEN_PATTERN) ?? []
  if (quotedTokens.some((token) => token.includes(";"))) {
    throw new Error("sqlStatements only supports migration SQL without quoted semicolons")
  }
  const structuralSource = source
    .replace(SQL_QUOTED_TOKEN_PATTERN, "")
    .replace(/--[^\r\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
  if (/['"]/.test(structuralSource)) {
    throw new Error("sqlStatements only supports migration SQL with balanced simple quotes")
  }
}

/** Produces ordered statements for the current migration's enforced simple-DDL subset. */
function sqlStatements(source) {
  assertMigrationSqlSubset(source)
  return source
    .replace(/--[^\r\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
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
    )
    assert.doesNotMatch(hardeningDesign, /and\s+retry operation keys never enter active claim\s+state or the append-only owner/i)
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

  it("requires a fresh zero-row preflight and preserves the completed membership rollout", () => {
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

    assert.match(hardeningDesign, /five identity and membership migrations[\s\S]*bridge ceremony[\s\S]*complete[\s\S]*writes enabled/i)
    assert.match(hardeningDesign, /one new additive operational-limiter migration[\s\S]*exact candidate[\s\S]*ordinary separately authorized deploy[\s\S]*preserv(?:e|ing) current membership writer authority/i)
    assert.match(hardeningDesign, /migration is expansion-only[\s\S]*three nullable `AdminEmailIntent` delivery-claim columns[\s\S]*unique `deliveryClaimOperationKeyHash` index[\s\S]*`AdminEmailRetryOperationKey` table[\s\S]*`RESTRICT` foreign key/i)
    assert.match(hardeningDesign, /count-only Production `AdminEmailIntent` row-count preflight[\s\S]*immediately before[\s\S]*exact count is `0`[\s\S]*nonzero[\s\S]*hard stop/i)
    assert.doesNotMatch(hardeningDesign, /creates the enum, table, unique key, and cleanup indexes without changing or backfilling existing rows/i)
    for (const [label, source] of [["binding design", hardeningDesign], ["public booking plan", publicBookingPlan]]) {
      assert.match(
        source,
        /narrow first (?:request-)?prefix lookup[\s\S]*prefix advisory lock[\s\S]*authoritative second (?:prefix )?lookup[\s\S]*only the (?:still-)?true remaining miss[\s\S]*consume[\s\S]*`BOOKING_CREATE`[\s\S]*heavy/i,
        label,
      )
      assert.match(
        source,
        /`consumeOperationalRateLimitInTransaction`[\s\S]*same `Prisma\.TransactionClient`[\s\S]*does not open a nested transaction[\s\S]*persistence errors propagate[\s\S]*outer bounded Serializable transaction/i,
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
    assert.doesNotMatch(hardeningDesign, /A miss consumes quota before expensive booking work[\s\S]*write transaction then acquires/i)
    assert.doesNotMatch(hardeningDesign, /perform the already designed membership writer-pause deployment and drain proof/i)
    assert.doesNotMatch(hardeningDesign, /first deploy[^.]*membership webhook writes paused[^.]*old writers drained[^.]*deploy the same SHA with writes enabled/i)

    for (const [label, source] of [
      ["binding design", hardeningDesign],
      ["Anatomime plan", anatomimeTrafficPlan],
    ]) {
      assert.match(
        source,
        /non-consuming `peekIngress`[\s\S]*denial makes no (?:credential )?preflight/i,
        label,
      )
      assert.match(
        source,
        /`consumeJoined`[\s\S]*`networkIdentifier`[\s\S]*`roomIdentifier`[\s\S]*`playerId`[\s\S]*atomically checks[\s\S]*network\+room[\s\S]*room[\s\S]*player[\s\S]*increments none/i,
        label,
      )
      assert.match(
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
