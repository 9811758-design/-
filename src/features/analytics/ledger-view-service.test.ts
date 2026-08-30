import "fake-indexeddb/auto"

import { afterEach, describe, expect, it } from "vitest"
import { type CafeLedgerDatabase, createCafeLedgerDatabase } from "../../data/database"
import { CafeLedgerRepository } from "../../data/ledger-repository"
import { EXPENSE_CATEGORY_IDS } from "../../domain/expense-categories"
import {
  createRevenueTransactionInputFromUnknown,
  createTransactionInputFromUnknown,
  TransactionIdSchema,
  TransactionSchema,
} from "../../domain/ledger"
import { LedgerViewService } from "./ledger-view-service"

const databases: CafeLedgerDatabase[] = []

afterEach(async () => {
  await Promise.all(databases.map(async (database) => database.delete()))
  databases.length = 0
})

describe("LedgerViewService", () => {
  it("updates and deletes spending while hiding preserved legacy sales", async () => {
    const database = createCafeLedgerDatabase(`ledger-view-${crypto.randomUUID()}`)
    databases.push(database)
    const repository = new CafeLedgerRepository(database, {
      clock: () => "2026-08-30T10:00:00.000Z",
      uuidFactory: () => crypto.randomUUID(),
    })
    const purchase = await repository.create(
      createTransactionInputFromUnknown({
        transactionType: "purchase",
        occurredAt: "2026-08-30T01:00:00.000Z",
        ingredientName: "원두",
        quantity: "1",
        unit: "kg",
        totalAmountWon: 30_000,
        unitPriceWon: 30_000,
      }),
    )
    await repository.upsertDailyRevenue(
      createRevenueTransactionInputFromUnknown({
        transactionType: "revenue",
        businessDate: "2026-08-30",
        occurredAt: "2026-08-29T15:00:00.000Z",
        amountWon: 300_000,
      }),
    )
    const expense = await repository.create(
      createTransactionInputFromUnknown({
        transactionType: "expense",
        occurredAt: "2026-08-30T02:00:00.000Z",
        categoryId: EXPENSE_CATEGORY_IDS.supplies,
        amountWon: 1_000,
      }),
    )
    await database.transactions.add(
      TransactionSchema.parse({
        id: TransactionIdSchema.parse("d94f3340-5f48-4264-9509-05debc0d1059"),
        transactionType: "sale",
        occurredAt: "2026-08-30T02:30:00.000Z",
        itemName: "과거 판매",
        quantity: 1,
        unitPriceWon: 4_500,
        totalAmountWon: 4_500,
        createdAt: "2026-08-30T02:30:00.000Z",
        updatedAt: "2026-08-30T02:30:00.000Z",
        syncStatus: "synced",
        syncVersion: 1,
      }),
    )
    const service = new LedgerViewService(repository, () => "2026-08-30T03:00:00.000Z")

    await service.update(
      purchase.id,
      createTransactionInputFromUnknown({
        transactionType: "purchase",
        occurredAt: purchase.occurredAt,
        ingredientName: "원두",
        quantity: "2",
        unit: "kg",
        totalAmountWon: 60_000,
        unitPriceWon: 30_000,
      }),
    )
    await service.softDelete(expense.id)
    const view = await service.load({ kind: "preset", preset: "this_month" })

    expect(view.transactions).toHaveLength(2)
    expect(view.transactions.map((transaction) => transaction.transactionType)).toEqual([
      "revenue",
      "purchase",
    ])
    expect(view.summary).toMatchObject({
      revenueWon: 300_000,
      materialCostWon: 60_000,
      operatingExpenseWon: 0,
      totalExpenseWon: 60_000,
      transactionCount: 2,
      materialPurchaseRatio: { kind: "available", basisPoints: 2_000 },
    })
  })
})
