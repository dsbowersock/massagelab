import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readFileSync } from "node:fs"
import { emptySidebarCalendarContext, shouldLoadSidebarCalendarContext } from "../lib/sidebar-calendar-context.js"

describe("sidebar calendar context route gating", () => {
  it("loads calendar context route-independently for the sitewide topbar", () => {
    assert.equal(shouldLoadSidebarCalendarContext("/account"), true)
    assert.equal(shouldLoadSidebarCalendarContext("/notes"), true)
    assert.equal(shouldLoadSidebarCalendarContext("/chimer"), true)
  })

  it("continues to load calendar context on calendar and booking routes", () => {
    assert.equal(shouldLoadSidebarCalendarContext("/calendar"), true)
    assert.equal(shouldLoadSidebarCalendarContext("/calendar/availability"), true)
    assert.equal(shouldLoadSidebarCalendarContext("/book/example"), true)
  })

  it("exposes safe zero counts in the empty context", () => {
    assert.equal(emptySidebarCalendarContext.pendingAppointmentRequestCount, 0)
    assert.equal(emptySidebarCalendarContext.openWaitlistEntryCount, 0)
  })

  it("freezes the empty therapists collection", () => {
    assert.throws(() => {
      emptySidebarCalendarContext.therapists.push({ id: "therapist_1", label: "Therapist" })
    }, TypeError)
  })

  it("counts pending appointment requests and open waitlist entries without returning PHI", () => {
    const source = readFileSync(new URL("../lib/sidebar-calendar-context.js", import.meta.url), "utf8")

    assert.match(source, /prisma\.appointment\.count/)
    assert.match(source, /status: "REQUESTED"/)
    assert.match(source, /membership\.role === "THERAPIST" \? \{ therapistId: userId \} : \{\}/)
    assert.match(source, /prisma\.bookingWaitlistEntry\.count/)
    assert.match(source, /status: "OPEN"/)
    assert.doesNotMatch(source, /practiceClient:\s*true/)
    assert.doesNotMatch(source, /include:\s*\{\s*practiceClient/)
  })
})
