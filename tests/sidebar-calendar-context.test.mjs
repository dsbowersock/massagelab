import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shouldLoadSidebarCalendarContext } from "../lib/sidebar-calendar-context.js"

describe("sidebar calendar context route gating", () => {
  it("does not load calendar context on unrelated application routes", () => {
    assert.equal(shouldLoadSidebarCalendarContext("/account"), false)
    assert.equal(shouldLoadSidebarCalendarContext("/notes"), false)
    assert.equal(shouldLoadSidebarCalendarContext("/chimer"), false)
  })

  it("loads calendar context only on calendar and booking routes", () => {
    assert.equal(shouldLoadSidebarCalendarContext("/calendar"), true)
    assert.equal(shouldLoadSidebarCalendarContext("/calendar/availability"), true)
    assert.equal(shouldLoadSidebarCalendarContext("/book/example"), true)
  })
})
