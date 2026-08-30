import type { ActiveTransaction } from "../../domain/ledger"
import type { RawRow } from "./google-sheets-contract"

export function transactionRow(transaction: ActiveTransaction): RawRow {
  const common = {
    id: transaction.id,
    type: transaction.transactionType,
    occurredAt: transaction.occurredAt,
    memo: safeText(transaction.memo ?? ""),
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    deletedAt: transaction.deletedAt ?? "",
    version: transaction.syncVersion,
  }
  switch (transaction.transactionType) {
    case "revenue":
      return [
        common.id,
        common.type,
        common.occurredAt,
        "일일 총매출",
        "",
        "",
        "",
        transaction.amountWon,
        "",
        "",
        common.memo,
        common.createdAt,
        common.updatedAt,
        common.deletedAt,
        common.version,
      ]
    case "purchase":
      return [
        common.id,
        common.type,
        common.occurredAt,
        safeText(transaction.ingredientName),
        transaction.quantity,
        safeText(transaction.unit),
        transaction.unitPriceWon,
        transaction.totalAmountWon,
        "",
        safeText(transaction.vendor ?? ""),
        common.memo,
        common.createdAt,
        common.updatedAt,
        common.deletedAt,
        common.version,
      ]
    case "expense":
      return [
        common.id,
        common.type,
        common.occurredAt,
        "",
        "",
        "",
        "",
        transaction.amountWon,
        transaction.categoryId,
        "",
        common.memo,
        common.createdAt,
        common.updatedAt,
        common.deletedAt,
        common.version,
      ]
  }
}

function safeText(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value
}
