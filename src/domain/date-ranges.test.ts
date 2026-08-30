import { describe, expect, it } from "vitest"
import { type DateRangePreset, InvalidDateRangeError, resolveDateRange } from "./date-ranges"
import { IsoTimestampSchema } from "./ledger"

const now = IsoTimestampSchema.parse("2026-08-30T01:00:00.000Z")

describe("resolveDateRange", () => {
  it.each<{
    readonly preset: DateRangePreset
    readonly startInclusiveUtc: string
    readonly endExclusiveUtc: string
  }>([
    {
      preset: "today",
      startInclusiveUtc: "2026-08-29T15:00:00.000Z",
      endExclusiveUtc: "2026-08-30T15:00:00.000Z",
    },
    {
      preset: "yesterday",
      startInclusiveUtc: "2026-08-28T15:00:00.000Z",
      endExclusiveUtc: "2026-08-29T15:00:00.000Z",
    },
    {
      preset: "this_week",
      startInclusiveUtc: "2026-08-23T15:00:00.000Z",
      endExclusiveUtc: "2026-08-30T15:00:00.000Z",
    },
    {
      preset: "last_week",
      startInclusiveUtc: "2026-08-16T15:00:00.000Z",
      endExclusiveUtc: "2026-08-23T15:00:00.000Z",
    },
    {
      preset: "this_month",
      startInclusiveUtc: "2026-07-31T15:00:00.000Z",
      endExclusiveUtc: "2026-08-31T15:00:00.000Z",
    },
    {
      preset: "last_month",
      startInclusiveUtc: "2026-06-30T15:00:00.000Z",
      endExclusiveUtc: "2026-07-31T15:00:00.000Z",
    },
  ])("returns KST calendar boundaries for $preset", ({ preset, ...expected }) => {
    // Given: a fixed instant and the Asia/Seoul calendar.
    // When: a preset range is resolved.
    const range = resolveDateRange({ kind: "preset", preset, now, timeZone: "Asia/Seoul" })

    // Then: the start is inclusive and the following boundary is exclusive in UTC.
    expect(range).toEqual(expected)
  })

  it("keeps Monday-based week boundaries across a year boundary", () => {
    // Given: New Year's Day falls inside a week that started in December.
    const yearBoundaryNow = IsoTimestampSchema.parse("2027-01-01T03:00:00.000Z")

    // When: this week is resolved in Korea.
    const range = resolveDateRange({
      kind: "preset",
      preset: "this_week",
      now: yearBoundaryNow,
      timeZone: "Asia/Seoul",
    })

    // Then: Monday through the next Monday is returned despite the year change.
    expect(range).toEqual({
      startInclusiveUtc: "2026-12-27T15:00:00.000Z",
      endExclusiveUtc: "2027-01-03T15:00:00.000Z",
    })
  })

  it("turns an inclusive custom end date into an exclusive next-day boundary", () => {
    // Given: a custom range covering all of August in Korea.
    // When: the custom calendar dates are resolved.
    const range = resolveDateRange({
      kind: "custom",
      startDate: { year: 2026, month: 8, day: 1 },
      endDateInclusive: { year: 2026, month: 8, day: 31 },
      timeZone: "Asia/Seoul",
    })

    // Then: the UTC range covers both local boundary dates exactly.
    expect(range).toEqual({
      startInclusiveUtc: "2026-07-31T15:00:00.000Z",
      endExclusiveUtc: "2026-08-31T15:00:00.000Z",
    })
  })

  it("rejects a custom range whose end precedes its start", () => {
    // Given: custom dates in reverse order.
    const request = {
      kind: "custom",
      startDate: { year: 2026, month: 9, day: 1 },
      endDateInclusive: { year: 2026, month: 8, day: 31 },
      timeZone: "Asia/Seoul",
    } as const

    // When: the invalid range is resolved. Then: a typed domain error is thrown.
    expect(() => resolveDateRange(request)).toThrow(InvalidDateRangeError)
  })
})
