import { z } from "zod"

import {
  type IsoTimestamp,
  IsoTimestampSchema,
  type MenuSyncJob,
  normalizeIsoTimestamp,
  type SyncJob,
  SyncJobSchema,
  type SyncStatus,
  type Transaction,
  TransactionSchema,
  type TransactionSyncJob,
} from "../domain/ledger"
import { type Menu, MenuSchema } from "../domain/menu"
import type { CafeLedgerDatabase } from "./database"

const SyncFailureSchema = z.object({
  lastError: z.string().trim().min(1).max(1_000),
  nextRetryAt: IsoTimestampSchema,
})

export type SyncFailure = z.output<typeof SyncFailureSchema>
type SyncEntity = Transaction | Menu
export type ClaimedSyncWork =
  | {
      readonly entityType: "transaction"
      readonly job: TransactionSyncJob
      readonly entity: Transaction
    }
  | { readonly entityType: "menu"; readonly job: MenuSyncJob; readonly entity: Menu }

export async function listEligibleSyncJobs(
  database: CafeLedgerDatabase,
  now: IsoTimestamp,
): Promise<readonly SyncJob[]> {
  const nowMilliseconds = new Date(normalizeIsoTimestamp(now)).getTime()
  const storedJobs = await database.syncJobs.toArray()
  const eligibleJobs: SyncJob[] = []

  for (const storedJob of storedJobs) {
    const job = SyncJobSchema.parse(storedJob)
    const entity = await getEntity(database, job)
    const retryIsDue =
      job.nextRetryAt === undefined || new Date(job.nextRetryAt).getTime() <= nowMilliseconds
    const statusIsEligible = entity?.syncStatus === "pending" || entity?.syncStatus === "failed"

    if (entity?.syncVersion === job.queuedVersion && retryIsDue && statusIsEligible) {
      eligibleJobs.push(job)
    }
  }

  return eligibleJobs
}

export async function claimSyncJob(
  database: CafeLedgerDatabase,
  candidate: SyncJob,
): Promise<ClaimedSyncWork | null> {
  const parsedCandidate = SyncJobSchema.parse(candidate)
  return database.transaction(
    "rw",
    database.transactions,
    database.menus,
    database.syncJobs,
    async () => {
      const currentJob = await getCurrentJob(database, parsedCandidate)
      if (currentJob === null || !matchesJobVersion(currentJob, parsedCandidate)) {
        return null
      }

      const entity = await getEntity(database, currentJob)
      const eligibleStatus = entity?.syncStatus === "pending" || entity?.syncStatus === "failed"
      if (entity?.syncVersion !== currentJob.queuedVersion || !eligibleStatus) {
        return null
      }

      const claimedJob = SyncJobSchema.parse({
        ...currentJob,
        attemptCount: currentJob.attemptCount + 1,
        lastError: undefined,
        nextRetryAt: undefined,
      })
      const syncingEntity = withSyncStatus(entity, "syncing")
      await putEntity(database, currentJob, syncingEntity)
      await database.syncJobs.put(claimedJob)
      return createClaimedWork(claimedJob, syncingEntity)
    },
  )
}

export async function finalizeSyncSuccess(
  database: CafeLedgerDatabase,
  claimedWork: ClaimedSyncWork,
  syncedAt: IsoTimestamp,
): Promise<boolean> {
  const parsedJob = SyncJobSchema.parse(claimedWork.job)
  const parsedSyncedAt = normalizeIsoTimestamp(IsoTimestampSchema.parse(syncedAt))
  return database.transaction(
    "rw",
    database.transactions,
    database.menus,
    database.syncJobs,
    async () => {
      const currentJob = await getCurrentJob(database, parsedJob)
      const entity = await getEntity(database, parsedJob)
      if (!isCurrentAttempt(currentJob, parsedJob, entity)) {
        return false
      }

      await putEntity(database, parsedJob, withSyncStatus(entity, "synced", parsedSyncedAt))
      await database.syncJobs.delete(parsedJob.id)
      return true
    },
  )
}

export async function finalizeSyncFailure(
  database: CafeLedgerDatabase,
  claimedWork: ClaimedSyncWork,
  failure: SyncFailure,
): Promise<boolean> {
  const parsedJob = SyncJobSchema.parse(claimedWork.job)
  const parsedFailure = SyncFailureSchema.parse(failure)
  return database.transaction(
    "rw",
    database.transactions,
    database.menus,
    database.syncJobs,
    async () => {
      const currentJob = await getCurrentJob(database, parsedJob)
      const entity = await getEntity(database, parsedJob)
      if (!isCurrentAttempt(currentJob, parsedJob, entity)) {
        return false
      }

      const failedJob = SyncJobSchema.parse({ ...currentJob, ...parsedFailure })
      await putEntity(database, parsedJob, withSyncStatus(entity, "failed"))
      await database.syncJobs.put(failedJob)
      return true
    },
  )
}

export async function recoverInterruptedSyncJobs(
  database: CafeLedgerDatabase,
  failure: SyncFailure,
): Promise<number> {
  const parsedFailure = SyncFailureSchema.parse(failure)
  return database.transaction(
    "rw",
    database.transactions,
    database.menus,
    database.syncJobs,
    async () => {
      const storedJobs = await database.syncJobs.toArray()
      let recoveredCount = 0

      for (const storedJob of storedJobs) {
        const job = SyncJobSchema.parse(storedJob)
        const entity = await getEntity(database, job)
        if (entity?.syncVersion === job.queuedVersion && entity.syncStatus === "syncing") {
          await putEntity(database, job, withSyncStatus(entity, "failed"))
          await database.syncJobs.put(SyncJobSchema.parse({ ...job, ...parsedFailure }))
          recoveredCount += 1
        }
      }

      return recoveredCount
    },
  )
}

async function getCurrentJob(
  database: CafeLedgerDatabase,
  expected: SyncJob,
): Promise<SyncJob | null> {
  const storedJob = await database.syncJobs.get(expected.id)
  return storedJob === undefined ? null : SyncJobSchema.parse(storedJob)
}

async function getEntity(database: CafeLedgerDatabase, job: SyncJob): Promise<SyncEntity | null> {
  switch (job.entityType) {
    case "transaction": {
      const entity = await database.transactions.get(job.entityId)
      return entity === undefined ? null : TransactionSchema.parse(entity)
    }
    case "menu": {
      const entity = await database.menus.get(job.entityId)
      return entity === undefined ? null : MenuSchema.parse(entity)
    }
  }
}

async function putEntity(
  database: CafeLedgerDatabase,
  job: SyncJob,
  entity: SyncEntity,
): Promise<void> {
  switch (job.entityType) {
    case "transaction":
      await database.transactions.put(TransactionSchema.parse(entity))
      return
    case "menu":
      await database.menus.put(MenuSchema.parse(entity))
      return
  }
}

function withSyncStatus(
  entity: SyncEntity,
  syncStatus: SyncStatus,
  syncedAt?: IsoTimestamp,
): SyncEntity {
  const updated = { ...entity, syncStatus, syncedAt }
  return "transactionType" in entity ? TransactionSchema.parse(updated) : MenuSchema.parse(updated)
}

function createClaimedWork(job: SyncJob, entity: SyncEntity): ClaimedSyncWork {
  switch (job.entityType) {
    case "transaction":
      return {
        entityType: "transaction",
        job,
        entity: TransactionSchema.parse(entity),
      }
    case "menu":
      return { entityType: "menu", job, entity: MenuSchema.parse(entity) }
  }
}

function matchesJobVersion(current: SyncJob, expected: SyncJob): boolean {
  return (
    current.id === expected.id &&
    current.entityType === expected.entityType &&
    current.entityId === expected.entityId &&
    current.queuedVersion === expected.queuedVersion
  )
}

function isCurrentAttempt(
  currentJob: SyncJob | null,
  claimedJob: SyncJob,
  entity: SyncEntity | null,
): entity is SyncEntity {
  return (
    currentJob !== null &&
    matchesJobVersion(currentJob, claimedJob) &&
    currentJob.attemptCount === claimedJob.attemptCount &&
    entity?.syncVersion === claimedJob.queuedVersion &&
    entity.syncStatus === "syncing"
  )
}
