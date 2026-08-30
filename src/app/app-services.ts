import type { CafeLedgerDatabase } from "../data/database"
import type { CafeLedgerRepository } from "../data/ledger-repository"
import type { LedgerViewService } from "../features/analytics/ledger-view-service"
import type { LocalLedgerService } from "../features/record/ledger-service"
import type { SyncSettingsService } from "../features/settings/sync-settings-service"

export type AppServices = {
  readonly database: CafeLedgerDatabase
  readonly ledgerRepository: CafeLedgerRepository
  readonly ledgerService: LocalLedgerService
  readonly ledgerViewService: LedgerViewService
  readonly syncSettingsService?: SyncSettingsService | undefined
}
