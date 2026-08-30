import "fake-indexeddb/auto"

import Dexie, { type Table } from "dexie"
import { afterEach, describe, expect, it } from "vitest"
import {
  ExpenseCategoryIdSchema,
  IsoTimestampSchema,
  MenuIdSchema,
  type SyncJobId,
  SyncJobIdSchema,
  type TransactionId,
  TransactionIdSchema,
  WonSchema,
} from "../domain/ledger"
import { createCafeLedgerDatabase } from "./database"

type LegacyTransaction = {
  readonly id: TransactionId
  readonly transactionType: "expense"
  readonly occurredAt: ReturnType<typeof IsoTimestampSchema.parse>
  readonly categoryId: ReturnType<typeof ExpenseCategoryIdSchema.parse>
  readonly amountWon: ReturnType<typeof WonSchema.parse>
  readonly createdAt: ReturnType<typeof IsoTimestampSchema.parse>
  readonly updatedAt: ReturnType<typeof IsoTimestampSchema.parse>
  readonly syncStatus: "pending"
}

type LegacySyncJob = {
  readonly id: SyncJobId
  readonly entityType: "transaction"
  readonly entityId: TransactionId
  readonly operation: "upsert"
  readonly attemptCount: number
}

class VersionOneDatabase extends Dexie {
  readonly transactions: Table<LegacyTransaction, TransactionId>
  readonly syncJobs: Table<LegacySyncJob, SyncJobId>

  constructor(databaseName: string) {
    super(databaseName)
    this.version(1).stores({
      transactions:
        "id, transactionType, occurredAt, updatedAt, syncStatus, deletedAt, [transactionType+occurredAt]",
      syncJobs: "id, &entityId, entityType, operation, nextRetryAt",
    })
    this.transactions = this.table("transactions")
    this.syncJobs = this.table("syncJobs")
  }
}

type LegacyMenu = {
  readonly id: ReturnType<typeof MenuIdSchema.parse>
  readonly name: string
  readonly defaultPriceWon: ReturnType<typeof WonSchema.parse>
  readonly favorite: boolean
  readonly createdAt: ReturnType<typeof IsoTimestampSchema.parse>
  readonly updatedAt: ReturnType<typeof IsoTimestampSchema.parse>
  readonly syncStatus: "pending"
  readonly isActive: boolean
}

class VersionTwoDatabase extends VersionOneDatabase {
  readonly menus: Table<LegacyMenu, ReturnType<typeof MenuIdSchema.parse>>

  constructor(databaseName: string) {
    super(databaseName)
    this.version(2).stores({
      transactions:
        "id, transactionType, occurredAt, updatedAt, syncStatus, deletedAt, [transactionType+occurredAt]",
      syncJobs: "id, &[entityType+entityId], entityType, entityId, operation, nextRetryAt",
      menus: "id, name, updatedAt, syncStatus, deletedAt",
    })
    this.menus = this.table("menus")
  }
}

const databaseNames: string[] = []

afterEach(async () => {
  await Promise.all(databaseNames.map((databaseName) => Dexie.delete(databaseName)))
  databaseNames.length = 0
})

describe("CafeLedgerDatabase migration", () => {
  it("adds initial versions while preserving version-one transactions and sync jobs", async () => {
    // Given: a database written by the immutable version-one schema.
    const databaseName = `cafe-ledger-migration-${crypto.randomUUID()}`
    databaseNames.push(databaseName)
    const legacyDatabase = new VersionOneDatabase(databaseName)
    const transactionId = TransactionIdSchema.parse("1bdba516-24cb-4e2a-b866-09376736dc1d")
    const timestamp = IsoTimestampSchema.parse("2026-08-30T10:00:00.000Z")
    const transaction = {
      id: transactionId,
      transactionType: "expense",
      occurredAt: IsoTimestampSchema.parse("2026-08-30T09:30:00.000Z"),
      categoryId: ExpenseCategoryIdSchema.parse("f4b08a9b-1423-4b38-85c7-4f583f9fd418"),
      amountWon: WonSchema.parse(4_500),
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: "pending",
    } satisfies LegacyTransaction
    const syncJob = {
      id: SyncJobIdSchema.parse("3a33db04-cf86-4f39-834e-b35d91605785"),
      entityType: "transaction",
      entityId: transactionId,
      operation: "upsert",
      attemptCount: 0,
    } satisfies LegacySyncJob
    await legacyDatabase.transactions.add(transaction)
    await legacyDatabase.syncJobs.add(syncJob)
    legacyDatabase.close()

    // When: the current database opens and upgrades the schema.
    const upgradedDatabase = createCafeLedgerDatabase(databaseName)
    const preservedTransaction = await upgradedDatabase.transactions.get(transactionId)
    const preservedJob = await upgradedDatabase.syncJobs.get(syncJob.id)

    // Then: legacy data remains and receives a matching initial queue version.
    expect(preservedTransaction).toMatchObject({ id: transactionId, syncVersion: 1 })
    expect(preservedJob).toMatchObject({
      entityType: "transaction",
      entityId: transactionId,
      queuedVersion: 1,
    })
    expect(upgradedDatabase.tables.map((table) => table.name)).toContain("menus")
    expect(upgradedDatabase.transactions.schema.idxByName).toHaveProperty(
      "[transactionType+businessDate]",
    )
    upgradedDatabase.close()
  })

  it("adds an initial version while preserving version-two menus", async () => {
    // Given: a menu written by the immutable version-two schema.
    const databaseName = `cafe-ledger-migration-${crypto.randomUUID()}`
    databaseNames.push(databaseName)
    const legacyDatabase = new VersionTwoDatabase(databaseName)
    const timestamp = IsoTimestampSchema.parse("2026-08-30T10:00:00.000Z")
    const menu = {
      id: MenuIdSchema.parse("76187daa-c5fb-433f-91a6-f9c937770a64"),
      name: "기존 메뉴",
      defaultPriceWon: WonSchema.parse(5_000),
      favorite: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: "pending",
      isActive: true,
    } satisfies LegacyMenu
    await legacyDatabase.menus.add(menu)
    legacyDatabase.close()

    // When: the current database opens and upgrades the schema.
    const upgradedDatabase = createCafeLedgerDatabase(databaseName)
    const preservedMenu = await upgradedDatabase.menus.get(menu.id)

    // Then: the menu remains available with its initial local version.
    expect(preservedMenu).toMatchObject({ id: menu.id, name: "기존 메뉴", syncVersion: 1 })
    upgradedDatabase.close()
  })
})
