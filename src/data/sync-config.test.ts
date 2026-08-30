import "fake-indexeddb/auto"

import { afterEach, describe, expect, it } from "vitest"
import { type CafeLedgerDatabase, createCafeLedgerDatabase } from "./database"
import { GoogleSheetsSyncConfigRepository } from "./sync-config"

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

describe("GoogleSheetsSyncConfigRepository", () => {
  it("persists only the singleton spreadsheet configuration", async () => {
    // Given: an empty local database.
    const database = createCafeLedgerDatabase(`cafe-sync-config-${crypto.randomUUID()}`)
    openDatabases.push(database)
    const repository = new GoogleSheetsSyncConfigRepository(database)

    // When: the selected spreadsheet and latest safe error are stored.
    await repository.put({ spreadsheetId: "sheet-123", lastError: "권한 확인 필요" })

    // Then: the singleton configuration can be read back without credentials.
    expect(await repository.get()).toEqual({
      key: "google-sheets",
      spreadsheetId: "sheet-123",
      lastError: "권한 확인 필요",
    })
    expect(await database.syncConfig.count()).toBe(1)
  })

  it("rejects access tokens at the persistence boundary", async () => {
    // Given: an empty configuration repository.
    const database = createCafeLedgerDatabase(`cafe-sync-config-${crypto.randomUUID()}`)
    openDatabases.push(database)
    const repository = new GoogleSheetsSyncConfigRepository(database)

    // When: credential-bearing input reaches the persistence boundary.
    const write = repository.put({ spreadsheetId: "sheet-123", accessToken: "secret" })

    // Then: the unsafe shape is rejected and nothing is persisted.
    await expect(write).rejects.toBeDefined()
    expect(await database.syncConfig.count()).toBe(0)
  })
})
