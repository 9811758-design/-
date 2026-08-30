import "fake-indexeddb/auto"

import { afterEach, describe, expect, it } from "vitest"
import { MenuIdSchema, SyncVersionSchema, TransactionIdSchema } from "../domain/ledger"
import { type CafeLedgerDatabase, createCafeLedgerDatabase } from "./database"
import { enqueueLatestSyncJob, listSyncJobs } from "./sync-queue"

const openDatabases: CafeLedgerDatabase[] = []

afterEach(async () => {
  await Promise.all(
    openDatabases.map(async (database) => {
      database.close()
      await database.delete()
    }),
  )
  openDatabases.length = 0
})

describe("sync queue", () => {
  it("keeps distinct latest jobs when branded entity ids share the same UUID text", async () => {
    // Given: transaction and menu targets with intentionally equal UUID text.
    const database = createCafeLedgerDatabase(`cafe-sync-queue-${crypto.randomUUID()}`)
    openDatabases.push(database)
    const sharedUuid = "d37cb50c-cece-4cd4-9004-12c3d9134421"
    const transactionId = TransactionIdSchema.parse(sharedUuid)
    const menuId = MenuIdSchema.parse(sharedUuid)
    const jobIds = ["c35d3576-0fea-47ba-8747-7acee1fb4b11", "29e60745-10fa-4a31-acd1-006523a14c3f"]
    let jobIndex = 0
    const nextJobId = () => {
      const jobId = jobIds[jobIndex]
      jobIndex += 1
      return jobId ?? "invalid-uuid"
    }

    // When: both targets enqueue their own latest operation.
    await enqueueLatestSyncJob(
      database,
      { entityType: "transaction", entityId: transactionId },
      "upsert",
      SyncVersionSchema.parse(1),
      nextJobId,
    )
    await enqueueLatestSyncJob(
      database,
      { entityType: "menu", entityId: menuId },
      "upsert",
      SyncVersionSchema.parse(1),
      nextJobId,
    )

    // Then: the compound target identity prevents cross-entity replacement.
    const jobs = await listSyncJobs(database)
    expect(jobs).toHaveLength(2)
    expect(jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityType: "transaction", entityId: transactionId }),
        expect.objectContaining({ entityType: "menu", entityId: menuId }),
      ]),
    )
  })
})
