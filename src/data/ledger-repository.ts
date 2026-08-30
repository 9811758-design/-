import type { DateRange } from "../domain/date-ranges"
import {
  type CreateRevenueTransactionInput,
  type CreateTransactionInput,
  type IsoTimestamp,
  IsoTimestampSchema,
  normalizeIsoTimestamp,
  type RevenueTransaction,
  type SyncJob,
  type Transaction,
  type TransactionId,
  TransactionIdSchema,
  TransactionSchema,
  type TransactionType,
} from "../domain/ledger"
import {
  createPendingTransaction,
  replaceActiveTransaction,
  softDeleteTransaction,
} from "../domain/transaction-factory"
import type { CafeLedgerDatabase } from "./database"
import { enqueueLatestSyncJob, listSyncJobs } from "./sync-queue"

type RepositoryOptions = {
  readonly clock?: () => string
  readonly uuidFactory?: () => string
}

export type TransactionQuery = {
  readonly dateRange: DateRange
  readonly transactionType?: TransactionType | undefined
}

export type UpdateTransactionResult =
  | { readonly kind: "updated"; readonly transaction: Transaction }
  | { readonly kind: "not_found"; readonly id: TransactionId }
  | { readonly kind: "deleted"; readonly id: TransactionId }
  | { readonly kind: "type_mismatch"; readonly id: TransactionId }
  | { readonly kind: "duplicate_revenue_date"; readonly id: TransactionId }

export type UpsertDailyRevenueResult =
  | { readonly kind: "created"; readonly transaction: RevenueTransaction }
  | { readonly kind: "updated"; readonly transaction: RevenueTransaction }

export type SoftDeleteTransactionResult =
  | { readonly kind: "soft_deleted"; readonly transaction: Transaction }
  | { readonly kind: "not_found"; readonly id: TransactionId }
  | { readonly kind: "already_deleted"; readonly id: TransactionId }

export class CafeLedgerRepository {
  private readonly clock: () => string
  private readonly uuidFactory: () => string

  constructor(
    private readonly database: CafeLedgerDatabase,
    options: RepositoryOptions = {},
  ) {
    this.clock = options.clock ?? (() => new Date().toISOString())
    this.uuidFactory = options.uuidFactory ?? (() => crypto.randomUUID())
  }

  async create(input: CreateTransactionInput): Promise<Transaction> {
    const timestamp = this.now()
    const transaction = createPendingTransaction(input, this.nextTransactionId(), timestamp)

    await this.database.transaction(
      "rw",
      this.database.transactions,
      this.database.syncJobs,
      async () => {
        await this.database.transactions.add(transaction)
        await this.enqueue(transaction, "upsert")
      },
    )

    return transaction
  }

  async upsertDailyRevenue(
    input: CreateRevenueTransactionInput,
  ): Promise<UpsertDailyRevenueResult> {
    return this.database.transaction(
      "rw",
      this.database.transactions,
      this.database.syncJobs,
      async () => {
        const matches = await this.database.transactions
          .where("[transactionType+businessDate]")
          .equals(["revenue", input.businessDate])
          .toArray()
        const existing = matches
          .map((transaction) => TransactionSchema.parse(transaction))
          .filter(
            (transaction): transaction is RevenueTransaction =>
              transaction.transactionType === "revenue",
          )
          .sort((left, right) => {
            const activeOrder =
              Number(left.deletedAt !== undefined) - Number(right.deletedAt !== undefined)
            return activeOrder === 0 ? right.updatedAt.localeCompare(left.updatedAt) : activeOrder
          })[0]

        if (existing === undefined) {
          const created = createPendingTransaction(input, this.nextTransactionId(), this.now())
          if (created.transactionType !== "revenue") throw new Error("일매출 생성에 실패했습니다.")
          await this.database.transactions.add(created)
          await this.enqueue(created, "upsert")
          return { kind: "created", transaction: created }
        }

        const updated = TransactionSchema.parse({
          ...input,
          id: existing.id,
          occurredAt: normalizeIsoTimestamp(input.occurredAt),
          createdAt: existing.createdAt,
          updatedAt: this.nextUpdatedAt(existing),
          syncStatus: "pending",
          syncVersion: existing.syncVersion + 1,
        })
        if (updated.transactionType !== "revenue") throw new Error("일매출 수정에 실패했습니다.")
        await this.database.transactions.put(updated)
        await this.enqueue(updated, "upsert")
        return { kind: "updated", transaction: updated }
      },
    )
  }

  async findById(id: TransactionId): Promise<Transaction | null> {
    const transaction = await this.database.transactions.get(id)

    return transaction === undefined ? null : TransactionSchema.parse(transaction)
  }

  async listActive(): Promise<readonly Transaction[]> {
    const transactions = await this.database.transactions.toArray()

    return transactions
      .map((transaction) => TransactionSchema.parse(transaction))
      .filter((transaction) => transaction.deletedAt === undefined)
  }

  async query(query: TransactionQuery): Promise<readonly Transaction[]> {
    const { startInclusiveUtc, endExclusiveUtc } = query.dateRange
    const transactions =
      query.transactionType === undefined
        ? await this.database.transactions
            .where("occurredAt")
            .between(startInclusiveUtc, endExclusiveUtc, true, false)
            .toArray()
        : await this.database.transactions
            .where("[transactionType+occurredAt]")
            .between(
              [query.transactionType, startInclusiveUtc],
              [query.transactionType, endExclusiveUtc],
              true,
              false,
            )
            .toArray()

    return transactions
      .map((transaction) => TransactionSchema.parse(transaction))
      .filter((transaction) => transaction.deletedAt === undefined)
  }

  async listSyncJobs(): Promise<readonly SyncJob[]> {
    const jobs = await listSyncJobs(this.database)
    return jobs.filter((job) => job.entityType === "transaction")
  }

  async update(id: TransactionId, input: CreateTransactionInput): Promise<UpdateTransactionResult> {
    return this.database.transaction(
      "rw",
      this.database.transactions,
      this.database.syncJobs,
      async () => {
        const existing = await this.findById(id)

        if (existing === null) {
          return { kind: "not_found", id }
        }

        if (existing.deletedAt !== undefined) {
          return { kind: "deleted", id }
        }

        if (input.transactionType === "revenue") {
          const duplicate = await this.database.transactions
            .where("[transactionType+businessDate]")
            .equals(["revenue", input.businessDate])
            .filter((transaction) => transaction.id !== id && transaction.deletedAt === undefined)
            .first()
          if (duplicate !== undefined) return { kind: "duplicate_revenue_date", id }
        }

        const transaction = replaceActiveTransaction(existing, input, this.nextUpdatedAt(existing))

        if (transaction === null) {
          return { kind: "type_mismatch", id }
        }

        await this.database.transactions.put(transaction)
        await this.enqueue(transaction, "upsert")

        return { kind: "updated", transaction }
      },
    )
  }

  async softDelete(id: TransactionId): Promise<SoftDeleteTransactionResult> {
    return this.database.transaction(
      "rw",
      this.database.transactions,
      this.database.syncJobs,
      async () => {
        const existing = await this.findById(id)

        if (existing === null) {
          return { kind: "not_found", id }
        }

        if (existing.deletedAt !== undefined) {
          return { kind: "already_deleted", id }
        }

        const transaction = softDeleteTransaction(existing, this.nextUpdatedAt(existing))
        await this.database.transactions.put(transaction)
        await this.enqueue(transaction, "delete")

        return { kind: "soft_deleted", transaction }
      },
    )
  }

  private async enqueue(transaction: Transaction, operation: "upsert" | "delete"): Promise<void> {
    await enqueueLatestSyncJob(
      this.database,
      { entityType: "transaction", entityId: transaction.id },
      operation,
      transaction.syncVersion,
      this.uuidFactory,
    )
  }

  private now(): IsoTimestamp {
    return normalizeIsoTimestamp(IsoTimestampSchema.parse(this.clock()))
  }

  private nextUpdatedAt(existing: Transaction): IsoTimestamp {
    const currentTimestamp = this.now()
    const currentMilliseconds = new Date(currentTimestamp).getTime()
    const existingMilliseconds = new Date(existing.updatedAt).getTime()

    return currentMilliseconds > existingMilliseconds
      ? currentTimestamp
      : IsoTimestampSchema.parse(new Date(existingMilliseconds + 1).toISOString())
  }

  private nextTransactionId(): TransactionId {
    return TransactionIdSchema.parse(this.uuidFactory())
  }
}
