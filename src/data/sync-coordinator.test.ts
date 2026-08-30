import "fake-indexeddb/auto"

import { afterEach, describe, expect, it } from "vitest"
import {
  createTransactionInputFromUnknown,
  IsoTimestampSchema,
  MenuIdSchema,
  SyncJobIdSchema,
  SyncJobSchema,
} from "../domain/ledger"
import { MenuSchema } from "../domain/menu"
import { type CafeLedgerDatabase, createCafeLedgerDatabase } from "./database"
import { CafeLedgerRepository } from "./ledger-repository"
import {
  claimSyncJob,
  finalizeSyncFailure,
  finalizeSyncSuccess,
  listEligibleSyncJobs,
  recoverInterruptedSyncJobs,
} from "./sync-coordinator"

const openDatabases: CafeLedgerDatabase[] = []

function createHarness() {
  const database = createCafeLedgerDatabase(`cafe-sync-coordinator-${crypto.randomUUID()}`)
  openDatabases.push(database)
  const repository = new CafeLedgerRepository(database, {
    clock: () => "2026-08-30T10:00:00.000Z",
    uuidFactory: () => crypto.randomUUID(),
  })
  return { database, repository }
}

function purchaseInput(ingredientName: string) {
  return createTransactionInputFromUnknown({
    transactionType: "purchase",
    occurredAt: "2026-08-30T09:30:00.000Z",
    ingredientName,
    quantity: "1",
    unit: "kg",
    unitPriceWon: 4_500,
    totalAmountWon: 4_500,
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

describe("sync coordinator", () => {
  it("claims an eligible job and atomically finalizes its matching entity", async () => {
    // Given: one locally created transaction with a due pending job.
    const { database, repository } = createHarness()
    const created = await repository.create(purchaseInput("원두"))
    const now = IsoTimestampSchema.parse("2026-08-30T10:01:00.000Z")
    const candidate = (await listEligibleSyncJobs(database, now))[0]
    expect(candidate).toBeDefined()

    // When: the worker claims and successfully finishes that exact version.
    const claimed = candidate === undefined ? null : await claimSyncJob(database, candidate)
    expect(claimed).not.toBeNull()
    const finalized = claimed === null ? false : await finalizeSyncSuccess(database, claimed, now)

    // Then: attempt state, entity state, and queue removal commit consistently.
    expect(claimed).toMatchObject({
      entityType: "transaction",
      job: { attemptCount: 1, queuedVersion: 1 },
      entity: { id: created.id, syncStatus: "syncing", syncVersion: 1 },
    })
    expect(finalized).toBe(true)
    expect(await repository.findById(created.id)).toMatchObject({
      syncStatus: "synced",
      syncVersion: 1,
      syncedAt: now,
    })
    expect(await repository.listSyncJobs()).toEqual([])
  })

  it("records a retryable failure without changing transaction contents", async () => {
    // Given: a claimed transaction snapshot ready for remote delivery.
    const { database, repository } = createHarness()
    const created = await repository.create(purchaseInput("보존할 구매"))
    const candidate = (
      await listEligibleSyncJobs(database, IsoTimestampSchema.parse("2026-08-30T10:01:00.000Z"))
    )[0]
    const claimed = candidate === undefined ? null : await claimSyncJob(database, candidate)
    expect(claimed).not.toBeNull()
    const nextRetryAt = IsoTimestampSchema.parse("2026-08-30T10:05:00.000Z")

    // When: the remote write fails and a retry time is recorded.
    const finalized =
      claimed === null
        ? false
        : await finalizeSyncFailure(database, claimed, {
            lastError: "offline",
            nextRetryAt,
          })

    // Then: only sync metadata changes and eligibility respects the retry time.
    expect(finalized).toBe(true)
    expect(await repository.findById(created.id)).toMatchObject({
      ingredientName: "보존할 구매",
      totalAmountWon: 4_500,
      syncStatus: "failed",
    })
    expect(await repository.listSyncJobs()).toEqual([
      expect.objectContaining({ attemptCount: 1, lastError: "offline", nextRetryAt }),
    ])
    expect(
      await listEligibleSyncJobs(database, IsoTimestampSchema.parse("2026-08-30T10:04:59.999Z")),
    ).toEqual([])
    expect(await listEligibleSyncJobs(database, nextRetryAt)).toHaveLength(1)
  })

  it("keeps a newer local edit pending when an older in-flight attempt finishes", async () => {
    // Given: version one is claimed, then edited locally while remote work is in flight.
    const { database, repository } = createHarness()
    const created = await repository.create(purchaseInput("이전 이름"))
    const candidate = (
      await listEligibleSyncJobs(database, IsoTimestampSchema.parse("2026-08-30T10:01:00.000Z"))
    )[0]
    const claimed = candidate === undefined ? null : await claimSyncJob(database, candidate)
    expect(claimed).not.toBeNull()
    await repository.update(created.id, purchaseInput("최신 이름"))

    // When: both stale success and stale failure callbacks arrive.
    const success =
      claimed === null
        ? false
        : await finalizeSyncSuccess(
            database,
            claimed,
            IsoTimestampSchema.parse("2026-08-30T10:02:00.000Z"),
          )
    const failure =
      claimed === null
        ? false
        : await finalizeSyncFailure(database, claimed, {
            lastError: "late failure",
            nextRetryAt: IsoTimestampSchema.parse("2026-08-30T10:05:00.000Z"),
          })

    // Then: neither callback can overwrite or remove the version-two pending work.
    expect(success).toBe(false)
    expect(failure).toBe(false)
    expect(await repository.findById(created.id)).toMatchObject({
      ingredientName: "최신 이름",
      syncStatus: "pending",
      syncVersion: 2,
    })
    expect(await repository.listSyncJobs()).toEqual([
      expect.objectContaining({ queuedVersion: 2, operation: "upsert", attemptCount: 0 }),
    ])
  })

  it("claims a menu with its matching atomic entity snapshot", async () => {
    // Given: a pending menu and its version-matched queue job.
    const database = createCafeLedgerDatabase(`cafe-sync-coordinator-${crypto.randomUUID()}`)
    openDatabases.push(database)
    const menu = MenuSchema.parse({
      id: MenuIdSchema.parse("8ea96e28-1f29-4cea-a17d-659caa2d840f"),
      name: "라테",
      defaultPriceWon: 5_000,
      favorite: false,
      isActive: true,
      createdAt: "2026-08-30T10:00:00.000Z",
      updatedAt: "2026-08-30T10:00:00.000Z",
      syncStatus: "pending",
      syncVersion: 1,
    })
    const job = SyncJobSchema.parse({
      id: SyncJobIdSchema.parse("7d320b95-89fa-4f52-a7cd-cba8f29e72ad"),
      entityType: "menu",
      entityId: menu.id,
      operation: "upsert",
      attemptCount: 0,
      queuedVersion: 1,
    })
    await database.transaction("rw", database.menus, database.syncJobs, async () => {
      await database.menus.add(menu)
      await database.syncJobs.add(job)
    })
    const candidate = (
      await listEligibleSyncJobs(database, IsoTimestampSchema.parse("2026-08-30T10:01:00.000Z"))
    )[0]

    // When: the menu job is claimed.
    const claimed = candidate === undefined ? null : await claimSyncJob(database, candidate)

    // Then: the runner receives the exact menu version marked in-flight atomically.
    expect(claimed).toMatchObject({
      entityType: "menu",
      job: { entityId: menu.id, queuedVersion: 1, attemptCount: 1 },
      entity: { id: menu.id, name: "라테", syncVersion: 1, syncStatus: "syncing" },
    })
  })

  it("recovers matching interrupted claims without losing their attempts or work", async () => {
    // Given: a job left syncing after its worker was interrupted.
    const { database, repository } = createHarness()
    const created = await repository.create(purchaseInput("중단된 구매"))
    const candidate = (
      await listEligibleSyncJobs(database, IsoTimestampSchema.parse("2026-08-30T10:01:00.000Z"))
    )[0]
    if (candidate !== undefined) {
      await claimSyncJob(database, candidate)
    }
    const nextRetryAt = IsoTimestampSchema.parse("2026-08-30T10:05:00.000Z")

    // When: startup recovery records a bounded retry for interrupted work.
    const recoveredCount = await recoverInterruptedSyncJobs(database, {
      lastError: "sync interrupted",
      nextRetryAt,
    })

    // Then: the entity and same attempted job remain recoverable after the delay.
    expect(recoveredCount).toBe(1)
    expect(await repository.findById(created.id)).toMatchObject({
      syncStatus: "failed",
      syncVersion: 1,
    })
    expect(await repository.listSyncJobs()).toEqual([
      expect.objectContaining({
        entityId: created.id,
        queuedVersion: 1,
        attemptCount: 1,
        lastError: "sync interrupted",
        nextRetryAt,
      }),
    ])
    expect(await listEligibleSyncJobs(database, nextRetryAt)).toHaveLength(1)
  })
})
