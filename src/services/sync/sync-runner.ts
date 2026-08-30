import type { CafeLedgerDatabase } from "../../data/database"
import {
  claimSyncJob,
  finalizeSyncFailure,
  finalizeSyncSuccess,
  listEligibleSyncJobs,
  recoverInterruptedSyncJobs,
} from "../../data/sync-coordinator"
import { listSyncJobs } from "../../data/sync-queue"
import {
  type IsoTimestamp,
  IsoTimestampSchema,
  isActiveTransaction,
  type SyncJob,
} from "../../domain/ledger"
import {
  GoogleApiError,
  type GoogleApiErrorCategory,
  type GoogleSheetsPort,
} from "../google/google-sheets-adapter"

export type SyncRunOptions = {
  readonly spreadsheetId: string
  readonly force?: boolean | undefined
  readonly maxJobs?: number | undefined
}

export type SyncRunResult =
  | { readonly kind: "completed"; readonly syncedCount: number }
  | {
      readonly kind: "failed"
      readonly syncedCount: number
      readonly category: GoogleApiErrorCategory | "unknown"
      readonly message: string
    }

const FAILURE_MESSAGES = {
  auth: "Google 연결 권한을 다시 확인해 주세요.",
  rate_limit: "Google 요청이 많아 잠시 뒤 다시 시도합니다.",
  transient: "Google Sheets 연결에 실패했습니다.",
  schema: "Google Sheet 탭과 헤더 구성을 확인해 주세요.",
  permanent: "Google Sheets 요청이 거부되었습니다.",
  unknown: "Google Sheets 동기화에 실패했습니다.",
} as const satisfies Record<GoogleApiErrorCategory | "unknown", string>

export class SyncRunner {
  constructor(
    private readonly database: CafeLedgerDatabase,
    private readonly sheets: GoogleSheetsPort,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  async run(options: SyncRunOptions): Promise<SyncRunResult> {
    const maxJobs = Math.max(1, Math.trunc(options.maxJobs ?? 100))
    const processedVersions = new Set<string>()
    let syncedCount = 0

    for (let index = 0; index < maxJobs; index += 1) {
      const now = this.now()
      const candidates = options.force
        ? await listSyncJobs(this.database)
        : await listEligibleSyncJobs(this.database, now)
      const candidate = candidates.find(
        (job) => !processedVersions.has(`${job.id}:${job.queuedVersion}`),
      )
      if (candidate === undefined) return { kind: "completed", syncedCount }
      processedVersions.add(`${candidate.id}:${candidate.queuedVersion}`)

      const claimed = await claimSyncJob(this.database, candidate)
      if (claimed === null) continue

      try {
        switch (claimed.entityType) {
          case "transaction":
            if (isActiveTransaction(claimed.entity)) {
              await this.sheets.upsertTransaction(options.spreadsheetId, claimed.entity)
            }
            break
          case "menu":
            break
        }
        const finalized = await finalizeSyncSuccess(this.database, claimed, this.now())
        if (finalized) syncedCount += 1
      } catch (caught) {
        const failure = toSafeFailure(caught, claimed.job, now)
        await finalizeSyncFailure(this.database, claimed, {
          lastError: failure.message,
          nextRetryAt: failure.nextRetryAt,
        })
        return {
          kind: "failed",
          syncedCount,
          category: failure.category,
          message: failure.message,
        }
      }
    }

    return { kind: "completed", syncedCount }
  }

  async recoverInterrupted(): Promise<number> {
    const now = this.now()
    return recoverInterruptedSyncJobs(this.database, {
      lastError: "중단된 동기화 작업을 안전하게 다시 대기 상태로 전환했습니다.",
      nextRetryAt: now,
    })
  }

  private now(): IsoTimestamp {
    return IsoTimestampSchema.parse(new Date(this.clock()).toISOString())
  }
}

type SafeFailure = {
  readonly category: GoogleApiErrorCategory | "unknown"
  readonly message: string
  readonly nextRetryAt: IsoTimestamp
}

function toSafeFailure(error: unknown, job: SyncJob, now: IsoTimestamp): SafeFailure {
  const category = error instanceof GoogleApiError ? error.category : "unknown"
  const baseDelay = baseDelayMilliseconds(category)
  const exponent = Math.min(Math.max(job.attemptCount - 1, 0), 6)
  const delay = baseDelay * 2 ** exponent
  return {
    category,
    message: FAILURE_MESSAGES[category],
    nextRetryAt: IsoTimestampSchema.parse(new Date(new Date(now).getTime() + delay).toISOString()),
  }
}

function baseDelayMilliseconds(category: GoogleApiErrorCategory | "unknown"): number {
  switch (category) {
    case "rate_limit":
      return 60_000
    case "auth":
      return 5 * 60_000
    case "schema":
    case "permanent":
      return 60 * 60_000
    case "transient":
    case "unknown":
      return 30_000
  }
}
