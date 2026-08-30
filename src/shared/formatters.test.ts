import { describe, expect, it } from "vitest"
import { formatBasisPoints, formatKoreanDateTime, formatWon } from "./formatters"

describe("Korean ledger formatters", () => {
  it("formats positive and negative safe whole-won values", () => {
    // Given: whole-won totals that can include an operating loss.
    // When: the values are prepared for the Korean UI.
    // Then: grouping and the won suffix remain unambiguous.
    expect(formatWon(1_234_500)).toBe("1,234,500원")
    expect(formatWon(-45_000)).toBe("-45,000원")
  })

  it("formats basis points without floating-point artifacts", () => {
    // Given: a ratio stored as integer basis points.
    // When: it is displayed as a percentage.
    // Then: two decimal places are available without NaN or Infinity.
    expect(formatBasisPoints(3_333)).toBe("33.33%")
    expect(formatBasisPoints(-1_250)).toBe("-12.50%")
  })

  it("formats an instant in the cafe's Korean timezone", () => {
    // Given: a persisted UTC instant.
    // When: the ledger row is rendered for a Korean cafe.
    // Then: its date and time use Asia/Seoul.
    expect(formatKoreanDateTime("2026-08-30T00:30:00.000Z")).toBe("2026. 8. 30. 오전 9:30")
  })
})
