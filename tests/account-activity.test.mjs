import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const accountPageSource = await readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8")
const adminDetailSource = await readFile(new URL("../app/admin/users/[userId]/page.tsx", import.meta.url), "utf8")
const emailActionSource = await readFile(new URL("../app/admin/users/[userId]/email-actions.ts", import.meta.url), "utf8").catch(() => "")

describe("account activity surfaces", () => {
  it("renders a signed-in activity tab with an empty state and accessible timestamps", () => {
    assert.match(accountPageSource, /function ActivityTab/)
    assert.match(accountPageSource, /id="account-activity"/)
    assert.match(accountPageSource, /No account activity yet/i)
    assert.match(accountPageSource, /<time dateTime=\{entry\.occurredAt\}/)
  })

  it("renders an explicit retry only for service-retryable failed non-password email intents", () => {
    assert.match(adminDetailSource, /Retry failed email/)
    assert.match(adminDetailSource, /email\?\.status === "FAILED"[\s\S]*email\.kind !== "PASSWORD_RESET"[\s\S]*email\.failureCode !== "RECIPIENT_UNAVAILABLE"/)
    assert.match(adminDetailSource, /Send a new reset link.*available after the password reset action is added/i)
    assert.doesNotMatch(adminDetailSource, /sendAdminPasswordReset/)
    assert.match(emailActionSource, /"use server"/)
    assert.match(emailActionSource, /requireFullAdminUser\(\)/)
    assert.match(emailActionSource, /retryAdminEmailIntent\(/)
    assert.match(adminDetailSource, /const operationId = randomUUID\(\)/)
    assert.match(adminDetailSource, /type="hidden" name="operationId" value=\{operationId\}/)
    assert.match(emailActionSource, /formData\.get\("operationId"\)/)
    assert.match(emailActionSource, /expectedTargetUserId: userId/)
    assert.doesNotMatch(emailActionSource, /crypto\.randomUUID\(\)/)
    assert.match(emailActionSource, /revalidatePath\(`\/admin\/users\/\$\{encodeURIComponent\(userId\)\}`\)/)
  })
})
