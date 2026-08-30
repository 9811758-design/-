export type SyncSettingsStatus = "local_only" | "needs_connection" | "ready" | "syncing" | "failed"

export type SyncSettingsSnapshot = {
  readonly clientConfigured: boolean
  readonly connected: boolean
  readonly spreadsheetId?: string | undefined
  readonly pendingCount: number
  readonly failedCount: number
  readonly status: SyncSettingsStatus
  readonly lastError?: string | undefined
}

export interface SyncSettingsService {
  getSnapshot(): Promise<SyncSettingsSnapshot>
  connectGoogle(): Promise<void>
  createTemplate(): Promise<void>
  connectExisting(spreadsheetId: string): Promise<void>
  retry(): Promise<void>
  disconnect(): Promise<void>
}
