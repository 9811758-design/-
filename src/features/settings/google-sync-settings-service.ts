import { z } from "zod"

import type { CafeLedgerDatabase } from "../../data/database"
import type { GoogleSheetsSyncConfigRepository } from "../../data/sync-config"
import { listSyncJobs } from "../../data/sync-queue"
import { GoogleIdentityError, type GoogleIdentityPort } from "../../services/google/gis-browser"
import type { GoogleSheetsPort } from "../../services/google/google-sheets-adapter"
import { SyncRunner } from "../../services/sync/sync-runner"
import type { SyncSettingsService, SyncSettingsSnapshot } from "./sync-settings-service"

type ServiceOptions = {
  readonly database: CafeLedgerDatabase
  readonly config: GoogleSheetsSyncConfigRepository
  readonly clientId?: string | undefined
  readonly identityFactory: () => Promise<GoogleIdentityPort>
  readonly sheets: GoogleSheetsPort
  readonly clock?: () => string
}

const SpreadsheetIdSchema = z.string().trim().min(1).max(500)

export class GoogleSyncSettingsService implements SyncSettingsService {
  private readonly runner: SyncRunner
  private readonly clientId: string | null
  private identity: GoogleIdentityPort | null = null
  private syncPromise: Promise<void> | null = null
  private running = false
  private started = false

  constructor(private readonly options: ServiceOptions) {
    this.clientId = normalizeClientId(options.clientId)
    this.runner = new SyncRunner(options.database, options.sheets, options.clock)
  }

  async getSnapshot(): Promise<SyncSettingsSnapshot> {
    const [config, jobs] = await Promise.all([
      this.options.config.get(),
      listSyncJobs(this.options.database),
    ])
    const failedJobs = jobs.filter((job) => job.lastError !== undefined)
    const connected = this.identity !== null && this.identity.getAccessToken() !== null
    const lastError = config?.lastError ?? failedJobs[0]?.lastError
    const status = snapshotStatus({
      clientConfigured: this.clientId !== null,
      connected,
      running: this.running,
      failed: lastError !== undefined,
    })

    return {
      clientConfigured: this.clientId !== null,
      connected,
      spreadsheetId: config?.spreadsheetId,
      pendingCount: jobs.length,
      failedCount: failedJobs.length,
      status,
      lastError,
    }
  }

  async connectGoogle(): Promise<void> {
    const identity = await this.ensureIdentity()
    try {
      await identity.requestAccessToken()
    } catch (caught) {
      throw translatedIdentityError(caught)
    }
  }

  async createTemplate(): Promise<void> {
    await this.ensureAuthorized()
    const created = await this.options.sheets.createSpreadsheet(templateTitle(this.now()))
    await this.options.config.put({ spreadsheetId: created.spreadsheetId })
    await this.synchronize(true)
  }

  async connectExisting(rawSpreadsheetId: string): Promise<void> {
    await this.ensureAuthorized()
    const spreadsheetId = SpreadsheetIdSchema.parse(rawSpreadsheetId)
    const validation = await this.options.sheets.validateSpreadsheet(spreadsheetId)
    if (!validation.valid) {
      throw new Error("필수 탭과 헤더가 일치하는 Google Sheet만 연결할 수 있습니다.")
    }
    await this.options.config.put({ spreadsheetId })
    await this.synchronize(true)
  }

  async retry(): Promise<void> {
    await this.ensureAuthorized()
    await this.synchronize(true)
  }

  async disconnect(): Promise<void> {
    if (this.identity === null) return
    try {
      await this.identity.revoke()
    } catch (caught) {
      throw translatedIdentityError(caught)
    }
  }

  start(target: Window = window): () => void {
    if (this.started) return () => undefined
    this.started = true
    const handleOnline = () => void this.synchronize(false)
    target.addEventListener("online", handleOnline)
    void this.runner
      .recoverInterrupted()
      .then(() => this.synchronize(false))
      .catch(() => undefined)
    return () => target.removeEventListener("online", handleOnline)
  }

  private async ensureAuthorized(): Promise<void> {
    const identity = await this.ensureIdentity()
    if (identity.getAccessToken() === null) await this.connectGoogle()
  }

  private async ensureIdentity(): Promise<GoogleIdentityPort> {
    if (this.clientId === null) {
      throw new Error("VITE_GOOGLE_CLIENT_ID 환경변수를 먼저 설정해 주세요.")
    }
    if (this.identity === null) this.identity = await this.options.identityFactory()
    return this.identity
  }

  private async synchronize(force: boolean): Promise<void> {
    if (this.syncPromise !== null) return this.syncPromise
    const operation = this.synchronizeOnce(force)
    this.syncPromise = operation
    try {
      await operation
    } finally {
      this.syncPromise = null
    }
  }

  private async synchronizeOnce(force: boolean): Promise<void> {
    const config = await this.options.config.get()
    if (
      config?.spreadsheetId === undefined ||
      this.identity === null ||
      this.identity.getAccessToken() === null
    ) {
      return
    }
    const spreadsheetId = config.spreadsheetId
    this.running = true
    try {
      const result = await withBrowserSyncLock(() => this.runner.run({ spreadsheetId, force }))
      if (result.kind === "failed") {
        await this.options.config.put({
          spreadsheetId,
          lastError: result.message,
        })
        return
      }
      await this.options.config.put({ spreadsheetId })
    } finally {
      this.running = false
    }
  }

  private now(): string {
    return this.options.clock?.() ?? new Date().toISOString()
  }
}

function normalizeClientId(clientId: string | undefined): string | null {
  const parsed = z.string().trim().min(1).safeParse(clientId)
  return parsed.success ? parsed.data : null
}

function templateTitle(timestamp: string): string {
  return `카페 장부 ${new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(timestamp))}`
}

function snapshotStatus(input: {
  readonly clientConfigured: boolean
  readonly connected: boolean
  readonly running: boolean
  readonly failed: boolean
}): SyncSettingsSnapshot["status"] {
  if (!input.clientConfigured) return "local_only"
  if (!input.connected) return "needs_connection"
  if (input.running) return "syncing"
  return input.failed ? "failed" : "ready"
}

function translatedIdentityError(error: unknown): Error {
  if (!(error instanceof GoogleIdentityError))
    return new Error("Google 연결을 완료하지 못했습니다.")
  switch (error.category) {
    case "denied":
      return new Error("Google 권한이 승인되지 않았습니다.")
    case "busy":
      return new Error("Google 연결 창이 이미 열려 있습니다.")
    case "revoke_failed":
      return new Error("Google 연결 해제를 완료하지 못했습니다.")
    case "unavailable":
      return new Error("Google Identity Services를 불러오지 못했습니다.")
  }
}

async function withBrowserSyncLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || navigator.locks === undefined) return operation()
  return navigator.locks.request("cafe-ledger-google-sheets-sync", operation)
}
