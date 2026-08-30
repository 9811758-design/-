import { describe, expect, it } from "vitest"
import { calculateLedgerSummary, UnsafeAggregateError } from "./analytics"
import { EXPENSE_CATEGORY_IDS } from "./expense-categories"
import { TransactionSchema } from "./ledger"

const metadata = {
  occurredAt: "2026-08-30T00:00:00.000Z",
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
  syncStatus: "pending",
  syncVersion: 1,
} as const

function purchase(id: string, amountWon: number, deleted = false) {
  return TransactionSchema.parse({
    ...metadata,
    id,
    transactionType: "purchase",
    ingredientName: "원두",
    quantity: "1",
    unit: "kg",
    totalAmountWon: amountWon,
    unitPriceWon: amountWon,
    deletedAt: deleted ? metadata.updatedAt : undefined,
  })
}

function revenue(id: string, amountWon: number, deleted = false) {
  return TransactionSchema.parse({
    ...metadata,
    id,
    transactionType: "revenue",
    businessDate: "2026-08-30",
    amountWon,
    deletedAt: deleted ? metadata.updatedAt : undefined,
  })
}

function expense(id: string, amountWon: number, categoryId = EXPENSE_CATEGORY_IDS.rent) {
  return TransactionSchema.parse({
    ...metadata,
    id,
    transactionType: "expense",
    categoryId,
    amountWon,
  })
}

function legacySale(id: string) {
  return TransactionSchema.parse({
    ...metadata,
    id,
    transactionType: "sale",
    itemName: "과거 판매",
    quantity: 1,
    unitPriceWon: 9_000,
    totalAmountWon: 9_000,
  })
}

describe("calculateLedgerSummary", () => {
  it("summarizes revenue, spending, material purchase ratio, categories, and daily totals", () => {
    const summary = calculateLedgerSummary([
      revenue("3992f713-0917-45ca-a491-3b2f740e9188", 100_000),
      purchase("0b0f6ef7-16d2-4e50-abfb-09bdcdba337f", 30_000),
      expense("e54d2c51-dd55-4089-b7aa-ccfb7e8633fa", 20_000),
      expense("8c341a94-d36a-4932-b931-a535c7c7c6c6", 10_000, EXPENSE_CATEGORY_IDS.supplies),
    ])

    expect(summary).toMatchObject({
      revenueWon: 100_000,
      materialCostWon: 30_000,
      operatingExpenseWon: 30_000,
      totalExpenseWon: 60_000,
      transactionCount: 4,
      materialPurchaseRatio: { kind: "available", basisPoints: 3_000 },
    })
    expect(summary.operatingExpenseByCategory).toEqual([
      {
        categoryId: EXPENSE_CATEGORY_IDS.rent,
        amountWon: 20_000,
        share: { kind: "available", basisPoints: 6_667 },
      },
      {
        categoryId: EXPENSE_CATEGORY_IDS.supplies,
        amountWon: 10_000,
        share: { kind: "available", basisPoints: 3_333 },
      },
    ])
    expect(summary.dailyLedger).toEqual([
      {
        date: "2026-08-30",
        revenueWon: 100_000,
        materialCostWon: 30_000,
        operatingExpenseWon: 30_000,
        totalExpenseWon: 60_000,
        materialPurchaseRatio: { kind: "available", basisPoints: 3_000 },
      },
    ])
  })

  it("ignores legacy sales and soft-deleted active records", () => {
    const summary = calculateLedgerSummary([
      legacySale("d94f3340-5f48-4264-9509-05debc0d1059"),
      revenue("3992f713-0917-45ca-a491-3b2f740e9188", 100_000, true),
      purchase("29113135-12e5-461e-beb2-099834561157", 5_000, true),
    ])
    expect(summary.totalExpenseWon).toBe(0)
    expect(summary.transactionCount).toBe(0)
    expect(summary.revenueWon).toBe(0)
    expect(summary.materialPurchaseRatio).toEqual({ kind: "unavailable" })
    expect(summary.dailyLedger).toEqual([])
  })

  it("returns stable empty collections when no spending exists", () => {
    expect(calculateLedgerSummary([])).toEqual({
      revenueWon: 0,
      materialCostWon: 0,
      operatingExpenseWon: 0,
      totalExpenseWon: 0,
      transactionCount: 0,
      materialPurchaseRatio: { kind: "unavailable" },
      operatingExpenseByCategory: [],
      dailyLedger: [],
    })
  })

  it("throws before an aggregate exceeds safe integer precision", () => {
    expect(() =>
      calculateLedgerSummary([
        purchase("80e55777-567e-4e7b-b4fd-03965b84afe6", Number.MAX_SAFE_INTEGER),
        purchase("33a69845-b68d-4843-83f6-0ac47501a0d6", 1),
      ]),
    ).toThrow(UnsafeAggregateError)
  })
})
