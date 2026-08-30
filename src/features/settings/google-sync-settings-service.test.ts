import "fake-indexeddb/auto"

import { afterEach, describe, expect, it } from "vitest"
import { type CafeLedgerDatabase, createCafeLedgerDatabase } from "../../data/database"
import { CafeLedgerRepository } from "../../data/ledger-repository"
import { GoogleSheetsSyncConfigRepository } from "../../data/sync-config"
import { EXPENSE_CATEGORY_IDS } from "../../domain/expense-categories"
import { type ActiveTransaction, createTransactionInputFromUnknown } from "../../domain/ledger"
import { GoogleIdentityBrowser } from "../../services/google/gis-browser"
import type {
  GoogleSheetsPort,
  SpreadsheetValidation,
} from "../../services/google/google-sheets-adapter"
import { GoogleSyncSettingsService } from "./google-sync-settings-service"

const databases: CafeLedgerDatabase[] = []

afterEach(async () => {
  await Promise.all(
    databases.map(async (database) => {
      database.close()
      await database.delete()
    }),
  )
  databases.length = 0
})

class FakeSheets implements GoogleSheetsPort {
  validation: SpreadsheetValidation = { valid: true }
  readonly transactions = new Map<string, unknown>()

  async createSpreadsheet() {
    return { spreadsheetId: "created-sheet" }
  }

  async validateSpreadsheet() {
    return this.validation
  }

  async upsertTransaction(_spreadsheetId: string, transaction: ActiveTransaction) {
    this.transactions.set(transaction.id, transaction)
  }
}

function identityForTests() {
  return new GoogleIdentityBrowser("public-web-client-id", {
    initTokenClient: (config) => ({
      requestAccessToken: () => config.callback({ access_token: "memory-only-token" }),
    }),
    revoke: (_token, done) => done({ successful: true }),
  })
}

function expenseInput() {
  return createTransactionInputFromUnknown({
    transactionType: "expense",
    occurredAt: "2026-08-30T01:00:00.000Z",
    categoryId: EXPENSE_CATEGORY_IDS.rent,
    amountWon: 450_000,
  })
}

describe("GoogleSyncSettingsService", () => {
  it("creates a template, persists only its ID, and drains the local queue", async () => {
    // Given: a configured client, an authorized in-memory identity, and one local expense.
    const database = createCafeLedgerDatabase(`settings-sync-${crypto.randomUUID()}`)
    databases.push(database)
    const transaction = await new CafeLedgerRepository(database).create(expenseInput())
    const identity = identityForTests()
    const sheets = new FakeSheets()
    const config = new GoogleSheetsSyncConfigRepository(database)
    const service = new GoogleSyncSettingsService({
      database,
      config,
      clientId: "public-web-client-id",
      identityFactory: async () => identity,
      sheets,
      clock: () => "2026-08-30T02:00:00.000Z",
    })

    // When: the owner connects and creates the app template.
    await service.connectGoogle()
    await service.createTemplate()

    // Then: only the sheet ID persists, while the queued transaction is synced by UUID.
    expect(await config.get()).toEqual({ key: "google-sheets", spreadsheetId: "created-sheet" })
    expect(sheets.transactions.has(transaction.id)).toBe(true)
    expect((await service.getSnapshot()).pendingCount).toBe(0)
    expect(JSON.stringify(await config.get())).not.toContain("memory-only-token")
  })

  it("rejects a mismatched existing sheet without changing the saved connection", async () => {
    // Given: authorization succeeds but the selected sheet is missing required structure.
    const database = createCafeLedgerDatabase(`settings-invalid-${crypto.randomUUID()}`)
    databases.push(database)
    const identity = identityForTests()
    const sheets = new FakeSheets()
    sheets.validation = {
      valid: false,
      issues: [{ sheet: "Transactions", kind: "header_mismatch" }],
    }
    const config = new GoogleSheetsSyncConfigRepository(database)
    const service = new GoogleSyncSettingsService({
      database,
      config,
      clientId: "public-web-client-id",
      identityFactory: async () => identity,
      sheets,
    })
    await service.connectGoogle()

    // When: the owner attempts to connect the mismatched document.
    const connect = service.connectExisting("unsafe-sheet")

    // Then: the document is not linked or modified.
    await expect(connect).rejects.toThrow("필수 탭과 헤더")
    expect(await config.get()).toBeNull()
  })
})
