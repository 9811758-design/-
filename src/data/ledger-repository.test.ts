import "fake-indexeddb/auto"

import { afterEach, describe, expect, it } from "vitest"
import type { DateRange } from "../domain/date-ranges"
import {
  createRevenueTransactionInputFromUnknown,
  createTransactionInputFromUnknown,
  IsoTimestampSchema,
  TransactionIdSchema,
} from "../domain/ledger"
import { type CafeLedgerDatabase, createCafeLedgerDatabase } from "./database"
import { CafeLedgerRepository } from "./ledger-repository"

const openDatabases: CafeLedgerDatabase[] = []

function createTestRepository() {
  const database = createCafeLedgerDatabase(`cafe-ledger-test-${crypto.randomUUID()}`)
  openDatabases.push(database)

  return {
    database,
    repository: new CafeLedgerRepository(database, {
      clock: () => "2026-08-30T10:00:00.000Z",
      uuidFactory: () => crypto.randomUUID(),
    }),
  }
}

function purchaseInput(occurredAt: string, ingredientName = "원두") {
  return createTransactionInputFromUnknown({
    transactionType: "purchase",
    occurredAt,
    ingredientName,
    quantity: "1",
    unit: "kg",
    unitPriceWon: 4_500,
    totalAmountWon: 4_500,
  })
}

function revenueInput(amountWon: number, businessDate = "2026-08-30") {
  return createRevenueTransactionInputFromUnknown({
    transactionType: "revenue",
    businessDate,
    occurredAt: `${businessDate}T00:00:00+09:00`,
    amountWon,
  })
}

afterEach(async () => {
  await Promise.all(
    openDatabases.map(async (database) => {
      database.close()
      await database.delete()
    }),
  )
  openDatabases.length = 0
})

describe("CafeLedgerRepository", () => {
  it("upserts one active daily revenue per business date while retaining its stable UUID", async () => {
    const { repository } = createTestRepository()

    const created = await repository.upsertDailyRevenue(revenueInput(300_000))
    const updated = await repository.upsertDailyRevenue(revenueInput(350_000))

    expect(created.kind).toBe("created")
    expect(updated).toMatchObject({
      kind: "updated",
      transaction: {
        id: created.transaction.id,
        amountWon: 350_000,
        syncVersion: 2,
      },
    })
    expect(
      (await repository.listActive()).filter(
        (transaction) => transaction.transactionType === "revenue",
      ),
    ).toHaveLength(1)
    expect(await repository.listSyncJobs()).toEqual([
      expect.objectContaining({
        entityId: created.transaction.id,
        operation: "upsert",
        queuedVersion: 2,
      }),
    ])
  })

  it("restores a soft-deleted daily revenue instead of creating a duplicate", async () => {
    const { repository } = createTestRepository()
    const created = await repository.upsertDailyRevenue(revenueInput(300_000))
    await repository.softDelete(created.transaction.id)

    const restored = await repository.upsertDailyRevenue(revenueInput(400_000))

    expect(restored).toMatchObject({
      kind: "updated",
      transaction: {
        id: created.transaction.id,
        amountWon: 400_000,
        syncVersion: 3,
      },
    })
    expect(restored.transaction.deletedAt).toBeUndefined()
  })

  it("persists a locally created purchase after the database is reopened", async () => {
    // Given: an isolated IndexedDB database and a valid purchase draft.
    const { database, repository } = createTestRepository()
    const purchase = createTransactionInputFromUnknown({
      transactionType: "purchase",
      occurredAt: "2026-08-30T09:30:00.000Z",
      ingredientName: "원두",
      quantity: "2",
      unit: "kg",
      unitPriceWon: 4_500,
      totalAmountWon: 9_000,
    })

    // When: the purchase is saved locally and the database is reopened.
    const created = await repository.create(purchase)
    const databaseName = database.name
    database.close()
    openDatabases.splice(openDatabases.indexOf(database), 1)
    const reopenedDatabase = createCafeLedgerDatabase(databaseName)
    openDatabases.push(reopenedDatabase)
    const reopenedRepository = new CafeLedgerRepository(reopenedDatabase)
    const persisted = await reopenedRepository.findById(created.id)
    const syncJobs = await reopenedRepository.listSyncJobs()

    // Then: the record remains present and ready for a later sync attempt.
    expect(persisted).toMatchObject({
      id: created.id,
      syncVersion: 1,
      syncStatus: "pending",
      totalAmountWon: 9_000,
      transactionType: "purchase",
    })
    expect(syncJobs).toEqual([
      expect.objectContaining({ entityId: created.id, operation: "upsert", queuedVersion: 1 }),
    ])
  })

  it("updates an active transaction and retains one latest sync job", async () => {
    // Given: an active locally stored purchase.
    const { repository } = createTestRepository()
    const created = await repository.create(purchaseInput("2026-08-30T09:30:00.000Z"))

    // When: its purchase details are changed.
    const result = await repository.update(
      created.id,
      createTransactionInputFromUnknown({
        transactionType: "purchase",
        occurredAt: "2026-08-30T09:35:00.000Z",
        ingredientName: "디카페인 원두",
        quantity: "2",
        unit: "kg",
        unitPriceWon: 5_000,
        totalAmountWon: 10_000,
      }),
    )

    // Then: the saved transaction is pending again and only its newest job remains.
    expect(result).toMatchObject({
      kind: "updated",
      transaction: { syncVersion: 2, totalAmountWon: 10_000 },
    })
    const jobs = await repository.listSyncJobs()
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      entityId: created.id,
      operation: "upsert",
      queuedVersion: 2,
    })
  })

  it("normalizes mixed-offset occurredAt values before IndexedDB orders them", async () => {
    // Given: two purchases whose supplied offsets would sort incorrectly as raw strings.
    const { database, repository } = createTestRepository()
    await repository.create(purchaseInput("2026-08-30T09:00:00.000+09:00", "서울 원두"))
    await repository.create(purchaseInput("2026-08-30T00:30:00.000Z", "UTC 원두"))

    // When: IndexedDB orders the persisted time index.
    const orderedTransactions = await database.transactions.orderBy("occurredAt").toArray()

    // Then: order follows the actual instant rather than the input offset text.
    expect(orderedTransactions.map((transaction) => transaction.occurredAt)).toEqual([
      "2026-08-30T00:00:00.000Z",
      "2026-08-30T00:30:00.000Z",
    ])
    expect(orderedTransactions[0]?.occurredAt).toBe("2026-08-30T00:00:00.000Z")
  })

  it("advances updatedAt when the clock returns the same instant", async () => {
    // Given: a repository whose clock does not advance between write operations.
    const { repository } = createTestRepository()
    const created = await repository.create(purchaseInput("2026-08-30T09:30:00.000Z"))

    // When: the transaction is updated under that unchanged clock.
    const result = await repository.update(
      created.id,
      createTransactionInputFromUnknown({
        transactionType: "purchase",
        occurredAt: "2026-08-30T09:35:00.000Z",
        ingredientName: "디카페인 원두",
        quantity: "1",
        unit: "kg",
        unitPriceWon: 5_000,
        totalAmountWon: 5_000,
      }),
    )

    // Then: synchronization can still distinguish the newer local version.
    expect(result).toMatchObject({
      kind: "updated",
      transaction: { updatedAt: "2026-08-30T10:00:00.001Z" },
    })
  })

  it("soft deletes a transaction without removing its local audit record", async () => {
    // Given: an active purchase in the local ledger.
    const { repository } = createTestRepository()
    const created = await repository.create(purchaseInput("2026-08-30T09:30:00.000Z"))

    // When: the owner deletes the record.
    const result = await repository.softDelete(created.id)

    // Then: listings exclude it while its audit state and delete job stay locally available.
    expect(result).toMatchObject({ kind: "soft_deleted" })
    expect(await repository.listActive()).toHaveLength(0)
    expect(await repository.findById(created.id)).toMatchObject({
      deletedAt: "2026-08-30T10:00:00.001Z",
      syncVersion: 2,
      syncStatus: "pending",
    })
    const jobs = await repository.listSyncJobs()
    expect(jobs[0]).toMatchObject({
      entityId: created.id,
      operation: "delete",
      queuedVersion: 2,
    })
  })

  it("returns typed failure outcomes for missing and deleted records", async () => {
    // Given: one soft-deleted purchase and a UUID that was never stored.
    const { repository } = createTestRepository()
    const created = await repository.create(purchaseInput("2026-08-30T09:30:00.000Z"))
    await repository.softDelete(created.id)
    const missingId = TransactionIdSchema.parse("670ebb27-2b75-49a7-98bf-7a57e77ce6d2")

    // When: an update is requested for each unavailable record.
    const deletedResult = await repository.update(
      created.id,
      createTransactionInputFromUnknown({
        transactionType: "purchase",
        occurredAt: "2026-08-30T09:40:00.000Z",
        ingredientName: "원두",
        quantity: "2",
        unit: "kg",
        unitPriceWon: 4_500,
        totalAmountWon: 9_000,
      }),
    )
    const missingResult = await repository.softDelete(missingId)

    // Then: the caller can handle both failures without an untyped exception.
    expect(deletedResult).toEqual({ kind: "deleted", id: created.id })
    expect(missingResult).toEqual({ kind: "not_found", id: missingId })
  })

  it("stores purchase decimal quantities and expense amounts as distinct transaction types", async () => {
    // Given: valid purchase and expense drafts.
    const { repository } = createTestRepository()
    const purchase = createTransactionInputFromUnknown({
      transactionType: "purchase",
      occurredAt: "2026-08-30T09:30:00.000Z",
      ingredientName: "원두",
      quantity: "2.5",
      unit: "kg",
      totalAmountWon: 45_000,
      unitPriceWon: 18_000,
      vendor: "로스터리",
    })
    const expense = createTransactionInputFromUnknown({
      transactionType: "expense",
      occurredAt: "2026-08-30T09:45:00.000Z",
      categoryId: "2c382e97-8e4d-479f-810a-3c09d58e9c5d",
      amountWon: 12_000,
    })

    // When: both transactions are stored.
    await repository.create(purchase)
    await repository.create(expense)

    // Then: their type-specific whole-won and decimal-string fields are preserved.
    const activeTransactions = await repository.listActive()
    expect(activeTransactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transactionType: "purchase",
          quantity: "2.5",
          totalAmountWon: 45_000,
        }),
        expect.objectContaining({ transactionType: "expense", amountWon: 12_000 }),
      ]),
    )
  })

  it("queries an inclusive start and exclusive end while excluding deleted records", async () => {
    // Given: transactions on both boundaries and one deleted transaction inside the range.
    const { repository } = createTestRepository()
    const occurrences = [
      "2026-08-01T00:00:00.000Z",
      "2026-08-15T00:00:00.000Z",
      "2026-09-01T00:00:00.000Z",
    ]
    const created = await Promise.all(
      occurrences.map((occurredAt) => repository.create(purchaseInput(occurredAt, occurredAt))),
    )
    await repository.softDelete(created[1]?.id ?? TransactionIdSchema.parse(crypto.randomUUID()))
    const dateRange = {
      startInclusiveUtc: IsoTimestampSchema.parse(occurrences[0]),
      endExclusiveUtc: IsoTimestampSchema.parse(occurrences[2]),
    } satisfies DateRange

    // When: the repository queries the half-open range.
    const result = await repository.query({ dateRange })

    // Then: only the active transaction on the inclusive start remains.
    expect(result.map((transaction) => transaction.occurredAt)).toEqual([occurrences[0]])
  })

  it("applies a type filter and immediately reflects an updated occurrence time", async () => {
    // Given: a purchase and an expense initially inside the requested period.
    const { repository } = createTestRepository()
    const purchase = await repository.create(
      createTransactionInputFromUnknown({
        transactionType: "purchase",
        occurredAt: "2026-08-10T00:00:00.000Z",
        ingredientName: "원두",
        quantity: "1",
        unit: "kg",
        unitPriceWon: 5_000,
        totalAmountWon: 5_000,
      }),
    )
    await repository.create(
      createTransactionInputFromUnknown({
        transactionType: "expense",
        occurredAt: "2026-08-10T00:00:00.000Z",
        categoryId: "2c382e97-8e4d-479f-810a-3c09d58e9c5d",
        amountWon: 1_000,
      }),
    )
    const dateRange = {
      startInclusiveUtc: IsoTimestampSchema.parse("2026-08-01T00:00:00.000Z"),
      endExclusiveUtc: IsoTimestampSchema.parse("2026-09-01T00:00:00.000Z"),
    } satisfies DateRange

    // When: the purchase moves outside the period and the purchase-filtered query runs.
    await repository.update(
      purchase.id,
      createTransactionInputFromUnknown({
        ...purchase,
        occurredAt: "2026-09-02T00:00:00.000Z",
      }),
    )
    const result = await repository.query({ dateRange, transactionType: "purchase" })

    // Then: neither the moved purchase nor the expense appears.
    expect(result).toEqual([])
  })
})
