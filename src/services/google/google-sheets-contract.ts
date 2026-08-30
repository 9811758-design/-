import type { ActiveTransaction } from "../../domain/ledger"

export const SHEET_HEADERS = {
  Transactions: [
    "id",
    "transactionType",
    "occurredAt",
    "itemName",
    "quantity",
    "unit",
    "unitPriceWon",
    "totalAmountWon",
    "category",
    "vendor",
    "memo",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "syncVersion",
  ],
  Menus: [
    "id",
    "name",
    "defaultPriceWon",
    "favorite",
    "isActive",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "syncVersion",
  ],
  Ingredients: [
    "id",
    "name",
    "defaultUnit",
    "isActive",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "syncVersion",
  ],
  ExpenseCategories: [
    "id",
    "name",
    "isSystem",
    "isActive",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "syncVersion",
  ],
  SyncAudit: [
    "id",
    "entityType",
    "entityId",
    "operation",
    "status",
    "attemptedAt",
    "errorCategory",
    "errorMessage",
  ],
} as const

export const SHEET_TITLES = [
  "Transactions",
  "Menus",
  "Ingredients",
  "ExpenseCategories",
  "SyncAudit",
] as const

export type SheetTitle = (typeof SHEET_TITLES)[number]
export type RawCell = string | number | boolean
export type RawRow = readonly RawCell[]

export type SpreadsheetValidation =
  | { readonly valid: true }
  | {
      readonly valid: false
      readonly issues: readonly {
        readonly sheet: SheetTitle
        readonly kind: "missing_sheet" | "header_mismatch"
      }[]
    }

export interface GoogleSheetsPort {
  createSpreadsheet(title: string): Promise<{ readonly spreadsheetId: string }>
  validateSpreadsheet(spreadsheetId: string): Promise<SpreadsheetValidation>
  upsertTransaction(spreadsheetId: string, transaction: ActiveTransaction): Promise<void>
}
