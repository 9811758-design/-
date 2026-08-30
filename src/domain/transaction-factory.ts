import {
  type CreateTransactionInput,
  type IsoTimestamp,
  normalizeIsoTimestamp,
  type Transaction,
  type TransactionId,
  TransactionSchema,
} from "./ledger"

export function createPendingTransaction(
  input: CreateTransactionInput,
  id: TransactionId,
  timestamp: IsoTimestamp,
): Transaction {
  return TransactionSchema.parse({
    ...input,
    id,
    occurredAt: normalizeIsoTimestamp(input.occurredAt),
    createdAt: timestamp,
    updatedAt: timestamp,
    syncStatus: "pending",
    syncVersion: 1,
  })
}

export function replaceActiveTransaction(
  existing: Transaction,
  input: CreateTransactionInput,
  timestamp: IsoTimestamp,
): Transaction | null {
  if (existing.transactionType !== input.transactionType || existing.deletedAt !== undefined) {
    return null
  }

  return TransactionSchema.parse({
    ...input,
    id: existing.id,
    occurredAt: normalizeIsoTimestamp(input.occurredAt),
    createdAt: existing.createdAt,
    updatedAt: timestamp,
    syncStatus: "pending",
    syncVersion: existing.syncVersion + 1,
  })
}

export function softDeleteTransaction(
  transaction: Transaction,
  timestamp: IsoTimestamp,
): Transaction {
  return TransactionSchema.parse({
    ...transaction,
    deletedAt: timestamp,
    syncStatus: "pending",
    syncVersion: transaction.syncVersion + 1,
    updatedAt: timestamp,
  })
}
