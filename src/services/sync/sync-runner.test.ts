import "fake-indexeddb/auto"

import { afterEach, describe, expect, it } from "vitest"
import { type CafeLedgerDatabase, createCafeLedgerDatabase } from "../../data/database"
import { CafeLedgerRepository } from "../../data/ledger-repository"
import { listSyncJobs } from "../../data/sync-queue"
import {
  type ActiveTransaction,
  createRevenueTransactionInputFromUnknown,
  createTransactionInputFromUnknown,
  MenuIdSchema,
  SyncJobIdSchema,
  SyncJobSchema,
  TransactionIdSchema,
  TransactionSchema,
} from "../../domain/ledger"
import { MenuSchema } from "../../domain/menu"
import { GoogleApiError, type GoogleSheetsPort } from "../google/google-sheets-adapter"
import { SyncRunner } from "./sync-runner"

const databases: CafeLedgerDatabase[] = []

afterEach(async () => {
  await Promise.all(
    databases.map(async (database) => {
      database.close()
      await database.delete()
    }),
  )
  databases.length = 0
})

function purchaseInput(ingredientName: string, quantity = 1) {
  return createTransactionInputFromUnknown({
    transactionType: "purchase",
    occurredAt: "2026-08-30T01:00:00.000Z",
    ingredientName,
    quantity: String(quantity),
    unit: "kg",
    unitPriceWon: 4_500,
    totalAmountWon: quantity * 4_500,
  })
}

class FakeSheetsPort implements GoogleSheetsPort {
  readonly transactions = new Map<string, unknown>()
  beforeTransactionWrite?: (() => Promise<void>) | undefined
  failure?: GoogleApiError | undefined

  async createSpreadsheet(): Promise<{ readonly spreadsheetId: string }> {
    return { spreadsheetId: "sheet-123" }
  }

  async validateSpreadsheet(): Promise<{ readonly valid: true }> {
    return { valid: true }
  }

  async upsertTransaction(_spreadsheetId: string, transaction: ActiveTransaction): Promise<void> {
    await this.beforeTransactionWrite?.()
    if (this.failure !== undefined) throw this.failure
    this.transactions.set(transaction.id, transaction)
  }
}

describe("SyncRunner", () => {
  it("syncs date-based revenue while keeping legacy sale retired", async () => {
    const database = createCafeLedgerDatabase(`sync-revenue-${crypto.randomUUID()}`)
    databases.push(database)
    const repository = new CafeLedgerRepository(database)
    const revenue = await repository.upsertDailyRevenue(
      createRevenueTransactionInputFromUnknown({
        transactionType: "revenue",
        businessDate: "2026-08-30",
        occurredAt: "2026-08-29T15:00:00.000Z",
        amountWon: 300_000,
      }),
    )
    if (revenue.transaction.transactionType !== "revenue") throw new Error("매출 fixture 오류")
    const sheets = new FakeSheetsPort()

    const result = await new SyncRunner(database, sheets).run({ spreadsheetId: "sheet-123" })

    expect(result).toEqual({ kind: "completed", syncedCount: 1 })
    expect(sheets.transactions.get(revenue.transaction.id)).toMatchObject({
      transactionType: "revenue",
      amountWon: 300_000,
    })
  })

  it("retires legacy sale and menu jobs without writing old rows to Google Sheets", async () => {
    const database = createCafeLedgerDatabase(`sync-legacy-${crypto.randomUUID()}`)
    databases.push(database)
    const sale = TransactionSchema.parse({
      id: TransactionIdSchema.parse("d94f3340-5f48-4264-9509-05debc0d1059"),
      transactionType: "sale",
      occurredAt: "2026-08-30T01:00:00.000Z",
      itemName: "과거 판매",
      quantity: 1,
      unitPriceWon: 4_500,
      totalAmountWon: 4_500,
      createdAt: "2026-08-30T01:00:00.000Z",
      updatedAt: "2026-08-30T01:00:00.000Z",
      syncStatus: "pending",
      syncVersion: 1,
    })
    const menu = MenuSchema.parse({
      id: MenuIdSchema.parse("8ea96e28-1f29-4cea-a17d-659caa2d840f"),
      name: "과거 메뉴",
      defaultPriceWon: 4_500,
      favorite: false,
      isActive: true,
      createdAt: "2026-08-30T01:00:00.000Z",
      updatedAt: "2026-08-30T01:00:00.000Z",
      syncStatus: "pending",
      syncVersion: 1,
    })
    const jobs = [
      SyncJobSchema.parse({
        id: SyncJobIdSchema.parse("7d320b95-89fa-4f52-a7cd-cba8f29e72ad"),
        entityType: "transaction",
        entityId: sale.id,
        operation: "upsert",
        attemptCount: 0,
        queuedVersion: 1,
      }),
      SyncJobSchema.parse({
        id: SyncJobIdSchema.parse("6d15abf0-b10f-451f-84f4-dac3a3985015"),
        entityType: "menu",
        entityId: menu.id,
        operation: "upsert",
        attemptCount: 0,
        queuedVersion: 1,
      }),
    ]
    await database.transaction(
      "rw",
      database.transactions,
      database.menus,
      database.syncJobs,
      async () => {
        await database.transactions.add(sale)
        await database.menus.add(menu)
        await database.syncJobs.bulkAdd(jobs)
      },
    )
    const sheets = new FakeSheetsPort()

    const result = await new SyncRunner(database, sheets).run({ spreadsheetId: "sheet-123" })

    expect(result).toEqual({ kind: "completed", syncedCount: 2 })
    expect(sheets.transactions.size).toBe(0)
    expect(await listSyncJobs(database)).toEqual([])
    expect((await database.transactions.get(sale.id))?.syncStatus).toBe("synced")
    expect((await database.menus.get(menu.id))?.syncStatus).toBe("synced")
  })

  it("removes a local job only after the remote upsert succeeds", async () => {
    // Given: one locally committed transaction and its pending job.
    const database = createCafeLedgerDatabase(`sync-success-${crypto.randomUUID()}`)
    databases.push(database)
    const repository = new CafeLedgerRepository(database)
    const transaction = await repository.create(purchaseInput("원두"))
    const sheets = new FakeSheetsPort()
    const runner = new SyncRunner(database, sheets, () => "2026-08-30T02:00:00.000Z")

    // When: the remote UUID upsert completes.
    const result = await runner.run({ spreadsheetId: "sheet-123" })

    // Then: the same local body is marked synced and its queue entry is removed.
    expect(result).toEqual({ kind: "completed", syncedCount: 1 })
    expect(sheets.transactions.has(transaction.id)).toBe(true)
    expect(await listSyncJobs(database)).toEqual([])
    expect((await repository.findById(transaction.id))?.syncStatus).toBe("synced")
  })

  it("preserves the transaction and retry metadata when Google is unavailable", async () => {
    // Given: a pending purchase and a transient Google failure.
    const database = createCafeLedgerDatabase(`sync-failure-${crypto.randomUUID()}`)
    databases.push(database)
    const repository = new CafeLedgerRepository(database)
    const transaction = await repository.create(purchaseInput("보존할 구매"))
    const sheets = new FakeSheetsPort()
    sheets.failure = new GoogleApiError("transient", 503)
    const runner = new SyncRunner(database, sheets, () => "2026-08-30T02:00:00.000Z")

    // When: one synchronization attempt fails.
    const result = await runner.run({ spreadsheetId: "sheet-123" })

    // Then: the local body remains, and the job records a future retry without being removed.
    expect(result.kind).toBe("failed")
    const preserved = await repository.findById(transaction.id)
    expect(preserved?.transactionType === "purchase" ? preserved.ingredientName : null).toBe(
      "보존할 구매",
    )
    expect(preserved?.syncStatus).toBe("failed")
    const jobs = await listSyncJobs(database)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.attemptCount).toBe(1)
    expect(new Date(jobs[0]?.nextRetryAt ?? 0).getTime()).toBeGreaterThan(
      new Date("2026-08-30T02:00:00.000Z").getTime(),
    )
  })

  it("keeps a newer local edit queued when it occurs during an older remote request", async () => {
    // Given: an old version is claimed and the remote request triggers a local edit.
    const database = createCafeLedgerDatabase(`sync-race-${crypto.randomUUID()}`)
    databases.push(database)
    const repository = new CafeLedgerRepository(database, {
      clock: () => "2026-08-30T01:30:00.000Z",
    })
    const transaction = await repository.create(purchaseInput("수정 전"))
    const sheets = new FakeSheetsPort()
    sheets.beforeTransactionWrite = async () => {
      await repository.update(transaction.id, purchaseInput("수정 후", 2))
    }
    const runner = new SyncRunner(database, sheets, () => "2026-08-30T02:00:00.000Z")

    // When: only the already-claimed work is processed.
    await runner.run({ spreadsheetId: "sheet-123", maxJobs: 1 })

    // Then: finalization cannot remove the newer version or its pending job.
    const current = await repository.findById(transaction.id)
    expect(current?.transactionType === "purchase" ? current.ingredientName : null).toBe("수정 후")
    expect(current?.syncStatus).toBe("pending")
    expect(current?.syncVersion).toBe(2)
    const jobs = await listSyncJobs(database)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.queuedVersion).toBe(2)
  })

  it("does not retry a failed job before its due time unless the owner retries manually", async () => {
    // Given: a failed job whose retry time is still in the future.
    const database = createCafeLedgerDatabase(`sync-backoff-${crypto.randomUUID()}`)
    databases.push(database)
    const repository = new CafeLedgerRepository(database)
    await repository.create(purchaseInput("재시도"))
    const sheets = new FakeSheetsPort()
    sheets.failure = new GoogleApiError("rate_limit", 429)
    const runner = new SyncRunner(database, sheets, () => "2026-08-30T02:00:00.000Z")
    await runner.run({ spreadsheetId: "sheet-123" })
    sheets.failure = undefined

    // When: automatic startup runs before the due time, then the owner uses manual retry.
    const automatic = await runner.run({ spreadsheetId: "sheet-123" })
    const manual = await runner.run({ spreadsheetId: "sheet-123", force: true })

    // Then: only the explicit retry bypasses backoff and completes the job.
    expect(automatic).toEqual({ kind: "completed", syncedCount: 0 })
    expect(manual).toEqual({ kind: "completed", syncedCount: 1 })
    expect(await listSyncJobs(database)).toEqual([])
  })
})
