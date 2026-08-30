import Dexie, { type Table } from "dexie"

import {
  type MenuId,
  type SyncJob,
  type SyncJobId,
  SyncVersionSchema,
  type Transaction,
  type TransactionId,
} from "../domain/ledger"
import type { Menu } from "../domain/menu"
import type { GoogleSheetsSyncConfig, GoogleSheetsSyncConfigKey } from "./sync-config"

export const CAFE_LEDGER_SCHEMA_VERSION = 4

export class CafeLedgerDatabase extends Dexie {
  readonly transactions: Table<Transaction, TransactionId>
  readonly syncJobs: Table<SyncJob, SyncJobId>
  readonly menus: Table<Menu, MenuId>
  readonly syncConfig: Table<GoogleSheetsSyncConfig, GoogleSheetsSyncConfigKey>

  constructor(databaseName: string) {
    super(databaseName)

    this.version(1).stores({
      transactions:
        "id, transactionType, occurredAt, updatedAt, syncStatus, deletedAt, [transactionType+occurredAt]",
      syncJobs: "id, &entityId, entityType, operation, nextRetryAt",
    })

    this.version(2).stores({
      transactions:
        "id, transactionType, occurredAt, updatedAt, syncStatus, deletedAt, [transactionType+occurredAt]",
      syncJobs: "id, &[entityType+entityId], entityType, entityId, operation, nextRetryAt",
      menus: "id, name, updatedAt, syncStatus, deletedAt",
    })

    this.version(3).stores({
      transactions:
        "id, transactionType, occurredAt, updatedAt, syncStatus, deletedAt, [transactionType+occurredAt]",
      syncJobs: "id, &[entityType+entityId], entityType, entityId, operation, nextRetryAt",
      menus: "id, name, updatedAt, syncStatus, deletedAt",
      syncConfig: "key",
    })

    this.version(4)
      .stores({
        transactions:
          "id, transactionType, businessDate, occurredAt, updatedAt, syncStatus, deletedAt, [transactionType+occurredAt], [transactionType+businessDate]",
        syncJobs: "id, &[entityType+entityId], entityType, entityId, operation, nextRetryAt",
        menus: "id, name, updatedAt, syncStatus, deletedAt",
        syncConfig: "key",
      })
      .upgrade(async (transaction) => {
        const initialVersion = SyncVersionSchema.parse(1)
        await Promise.all([
          transaction.table("transactions").toCollection().modify({ syncVersion: initialVersion }),
          transaction.table("menus").toCollection().modify({ syncVersion: initialVersion }),
          transaction.table("syncJobs").toCollection().modify({ queuedVersion: initialVersion }),
        ])
      })

    this.transactions = this.table("transactions")
    this.syncJobs = this.table("syncJobs")
    this.menus = this.table("menus")
    this.syncConfig = this.table("syncConfig")
  }
}

export function createCafeLedgerDatabase(databaseName: string): CafeLedgerDatabase {
  return new CafeLedgerDatabase(databaseName)
}
