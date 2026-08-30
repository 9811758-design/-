import "fake-indexeddb/auto"

import { afterEach, describe, expect, it } from "vitest"
import { type CafeLedgerDatabase, createCafeLedgerDatabase } from "../../data/database"
import { CafeLedgerRepository } from "../../data/ledger-repository"
import { EXPENSE_CATEGORY_IDS } from "../../domain/expense-categories"
import { LocalLedgerService } from "./ledger-service"

const databases: CafeLedgerDatabase[] = []

function createService() {
  const database = createCafeLedgerDatabase(`ledger-service-${crypto.randomUUID()}`)
  databases.push(database)
  const ledgerRepository = new CafeLedgerRepository(database, {
    clock: () => "2026-08-30T10:00:00.000Z",
    uuidFactory: () => crypto.randomUUID(),
  })
  return { ledgerRepository, service: new LocalLedgerService(ledgerRepository) }
}

afterEach(async () => {
  await Promise.all(
    databases.map(async (database) => {
      database.close()
      await database.delete()
    }),
  )
  databases.length = 0
})

describe("LocalLedgerService", () => {
  it("updates the same business date instead of duplicating daily revenue", async () => {
    const { ledgerRepository, service } = createService()
    const input = {
      transactionType: "revenue",
      businessDate: "2026-08-30",
      occurredAt: "2026-08-29T15:00:00.000Z",
      amountWon: 300_000,
    }

    expect(await service.save(input)).toEqual({ kind: "saved", mode: "created" })
    expect(await service.save({ ...input, amountWon: 350_000 })).toEqual({
      kind: "saved",
      mode: "updated",
    })

    const active = await ledgerRepository.listActive()
    expect(active).toHaveLength(1)
    expect(active[0]).toMatchObject({ transactionType: "revenue", amountWon: 350_000 })
  })

  it("saves purchase and operating-expense drafts locally", async () => {
    const { ledgerRepository, service } = createService()
    await service.save({
      transactionType: "purchase",
      occurredAt: "2026-08-30T09:30:00.000Z",
      ingredientName: "원두",
      quantity: "1",
      unit: "kg",
      totalAmountWon: 30_000,
      unitPriceWon: 30_000,
    })
    await service.save({
      transactionType: "expense",
      occurredAt: "2026-08-30T09:40:00.000Z",
      categoryId: EXPENSE_CATEGORY_IDS.rent,
      amountWon: 500_000,
    })
    expect(await ledgerRepository.listActive()).toHaveLength(2)
  })

  it("rejects sale drafts before persistence", async () => {
    const { ledgerRepository, service } = createService()
    await expect(
      service.save({
        transactionType: "sale",
        occurredAt: "2026-08-30T09:30:00.000Z",
        itemName: "아메리카노",
        quantity: 1,
        unitPriceWon: 4_500,
      }),
    ).rejects.toThrow()
    expect(await ledgerRepository.listActive()).toEqual([])
  })

  it("rejects an unknown expense category without writing a transaction", async () => {
    const { ledgerRepository, service } = createService()
    const result = await service.save({
      transactionType: "expense",
      occurredAt: "2026-08-30T09:30:00.000Z",
      categoryId: "2c382e97-8e4d-479f-810a-3c09d58e9c5d",
      amountWon: 12_000,
    })
    expect(result).toEqual({ kind: "expense_category_not_found" })
    expect(await ledgerRepository.listActive()).toEqual([])
  })
})
