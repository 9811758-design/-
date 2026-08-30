import {
  type MenuId,
  type SyncJob,
  SyncJobIdSchema,
  SyncJobSchema,
  type SyncOperation,
  type SyncVersion,
  type TransactionId,
} from "../domain/ledger"
import type { CafeLedgerDatabase } from "./database"

export type SyncTarget =
  | { readonly entityType: "transaction"; readonly entityId: TransactionId }
  | { readonly entityType: "menu"; readonly entityId: MenuId }

export async function enqueueLatestSyncJob(
  database: CafeLedgerDatabase,
  target: SyncTarget,
  operation: SyncOperation,
  queuedVersion: SyncVersion,
  uuidFactory: () => string,
): Promise<SyncJob> {
  const existing = await database.syncJobs
    .where("entityType")
    .equals(target.entityType)
    .and((job) => job.entityId === target.entityId)
    .first()
  const job = SyncJobSchema.parse({
    id: existing?.id ?? SyncJobIdSchema.parse(uuidFactory()),
    entityType: target.entityType,
    entityId: target.entityId,
    operation,
    attemptCount: 0,
    queuedVersion,
  })

  await database.syncJobs.put(job)
  return job
}

export async function listSyncJobs(database: CafeLedgerDatabase): Promise<readonly SyncJob[]> {
  const jobs = await database.syncJobs.toArray()
  return jobs.map((job) => SyncJobSchema.parse(job))
}
