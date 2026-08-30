import { describe, expect, it } from "vitest"
import { createTransactionInputFromUnknown } from "./ledger"

describe("transaction input validation", () => {
  it("accepts a positive date-based revenue without reviving legacy sale input", () => {
    expect(
      createTransactionInputFromUnknown({
        transactionType: "revenue",
        businessDate: "2026-08-30",
        occurredAt: "2026-08-29T15:00:00.000Z",
        amountWon: 300_000,
      }),
    ).toMatchObject({ transactionType: "revenue", amountWon: 300_000 })
  })

  it("rejects new sale transactions", () => {
    expect(() =>
      createTransactionInputFromUnknown({
        transactionType: "sale",
        occurredAt: "2026-08-30T09:30:00.000Z",
        itemName: "아메리카노",
        quantity: 1,
        unitPriceWon: 4_500,
      }),
    ).toThrow()
  })

  it.each([
    {
      label: "zero daily revenue",
      input: {
        transactionType: "revenue",
        businessDate: "2026-08-30",
        occurredAt: "2026-08-29T15:00:00.000Z",
        amountWon: 0,
      },
    },
    {
      label: "impossible business date",
      input: {
        transactionType: "revenue",
        businessDate: "2026-02-30",
        occurredAt: "2026-02-28T15:00:00.000Z",
        amountWon: 1,
      },
    },
    {
      label: "negative whole-won amount",
      input: {
        transactionType: "expense",
        occurredAt: "2026-08-30T09:30:00.000Z",
        categoryId: "835a9930-e44c-4b2c-9067-058b9d061a7f",
        amountWon: -1,
      },
    },
    {
      label: "invalid calendar date",
      input: {
        transactionType: "purchase",
        occurredAt: "not-a-date",
        ingredientName: "원두",
        quantity: "1",
        unit: "kg",
        totalAmountWon: 4_500,
        unitPriceWon: 4_500,
      },
    },
    {
      label: "non UUID reference",
      input: {
        transactionType: "expense",
        occurredAt: "2026-08-30T09:30:00.000Z",
        categoryId: "rent",
        amountWon: 10_000,
      },
    },
    {
      label: "zero decimal purchase quantity",
      input: {
        transactionType: "purchase",
        occurredAt: "2026-08-30T09:30:00.000Z",
        ingredientName: "원두",
        quantity: "0",
        unit: "kg",
        totalAmountWon: 10_000,
        unitPriceWon: 10_000,
      },
    },
  ])("rejects $label", ({ input }) => {
    // Given: a raw transaction draft that violates one domain invariant.
    // When: it crosses the runtime validation boundary.
    const parse = () => createTransactionInputFromUnknown(input)
    // Then: persistence cannot receive the invalid draft.
    expect(parse).toThrow()
  })
})
