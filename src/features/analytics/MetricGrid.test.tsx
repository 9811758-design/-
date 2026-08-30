import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { LedgerSummary } from "../../domain/analytics"
import { MetricGrid } from "./MetricGrid"

const summary: LedgerSummary = {
  revenueWon: 10_000,
  materialCostWon: 3_000,
  operatingExpenseWon: 2_000,
  totalExpenseWon: 5_000,
  transactionCount: 2,
  materialPurchaseRatio: { kind: "available", basisPoints: 3_000 },
  operatingExpenseByCategory: [],
  dailyLedger: [],
}

afterEach(cleanup)

describe("MetricGrid", () => {
  it("exposes revenue, spending, material ratio, and record metrics", () => {
    render(<MetricGrid summary={summary} />)
    expect(screen.getByText("총지출").closest("article")?.className).toContain(
      "metric-card--spending",
    )
    expect(screen.getByText("총매출")).toBeTruthy()
    expect(screen.getByText("30.00%")).toBeTruthy()
    expect(screen.getAllByRole("article")).toHaveLength(6)
  })
})
