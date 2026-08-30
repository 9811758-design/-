import { createCafeLedgerDatabase } from "../data/database"
import { CafeLedgerRepository } from "../data/ledger-repository"
import { GoogleSheetsSyncConfigRepository } from "../data/sync-config"
import { LedgerViewService } from "../features/analytics/ledger-view-service"
import { LocalLedgerService } from "../features/record/ledger-service"
import { GoogleSyncSettingsService } from "../features/settings/google-sync-settings-service"
import type { GoogleIdentityPort } from "../services/google/gis-browser"
import { loadGoogleIdentityBrowser } from "../services/google/gis-loader"
import { GoogleSheetsAdapter } from "../services/google/google-sheets-adapter"
import type { AppServices } from "./app-services"

export function createAppServices(databaseName = "cafe-ledger"): AppServices {
  const database = createCafeLedgerDatabase(databaseName)
  const ledgerRepository = new CafeLedgerRepository(database)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  let identity: GoogleIdentityPort | null = null
  const identityFactory = async () => {
    if (clientId === undefined || clientId.trim() === "") {
      throw new Error("Google OAuth 웹 클라이언트 ID가 설정되지 않았습니다.")
    }
    identity = await loadGoogleIdentityBrowser(clientId)
    return identity
  }
  const sheets = new GoogleSheetsAdapter({
    fetcher: (url, init) => fetch(url, init),
    getAccessToken: () => identity?.getAccessToken() ?? null,
  })
  const syncSettingsService = new GoogleSyncSettingsService({
    database,
    config: new GoogleSheetsSyncConfigRepository(database),
    clientId,
    identityFactory,
    sheets,
  })
  if (typeof window !== "undefined") syncSettingsService.start(window)
  return {
    database,
    ledgerRepository,
    ledgerService: new LocalLedgerService(ledgerRepository),
    ledgerViewService: new LedgerViewService(ledgerRepository),
    syncSettingsService,
  }
}
