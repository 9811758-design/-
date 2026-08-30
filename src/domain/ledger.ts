import { z } from "zod"

export const SyncStatusSchema = z.enum(["pending", "syncing", "synced", "failed"])
export const TransactionTypeSchema = z.enum(["sale", "revenue", "purchase", "expense"])
export const ActiveTransactionTypeSchema = z.enum(["revenue", "purchase", "expense"])
export const SpendTransactionTypeSchema = z.enum(["purchase", "expense"])
export const SyncOperationSchema = z.enum(["upsert", "delete"])
export const TransactionIdSchema = z.string().uuid().brand<"TransactionId">()
export const MenuIdSchema = z.string().uuid().brand<"MenuId">()
export const IngredientIdSchema = z.string().uuid().brand<"IngredientId">()
export const ExpenseCategoryIdSchema = z.string().uuid().brand<"ExpenseCategoryId">()
export const SyncJobIdSchema = z.string().uuid().brand<"SyncJobId">()
export const SyncVersionSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER)
  .brand<"SyncVersion">()
export const IsoTimestampSchema = z.string().datetime({ offset: true }).brand<"IsoTimestamp">()
export const WonSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).brand<"Won">()
export const PositiveWonSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER)
  .brand<"Won">()
export const BusinessDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number)
    const date = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day ?? 0))
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day
    )
  })
  .brand<"BusinessDate">()
export const SaleQuantitySchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER)
  .brand<"SaleQuantity">()

const DecimalQuantitySchema = z
  .string()
  .regex(/^(?:0\.(?:0*[1-9]\d*)|[1-9]\d*(?:\.\d+)?)$/)
  .brand<"DecimalQuantity">()
const OptionalTextSchema = z.string().trim().min(1).max(500).optional()
const RequiredTextSchema = z.string().trim().min(1).max(100)

export type SyncStatus = z.output<typeof SyncStatusSchema>
export type TransactionType = z.output<typeof TransactionTypeSchema>
export type ActiveTransactionType = z.output<typeof ActiveTransactionTypeSchema>
export type SpendTransactionType = z.output<typeof SpendTransactionTypeSchema>
export type SyncOperation = z.output<typeof SyncOperationSchema>
export type TransactionId = z.output<typeof TransactionIdSchema>
export type MenuId = z.output<typeof MenuIdSchema>
export type IngredientId = z.output<typeof IngredientIdSchema>
export type ExpenseCategoryId = z.output<typeof ExpenseCategoryIdSchema>
export type SyncJobId = z.output<typeof SyncJobIdSchema>
export type SyncVersion = z.output<typeof SyncVersionSchema>
export type IsoTimestamp = z.output<typeof IsoTimestampSchema>
export type Won = z.output<typeof WonSchema>
export type BusinessDate = z.output<typeof BusinessDateSchema>
export type SaleQuantity = z.output<typeof SaleQuantitySchema>
export type DecimalQuantity = z.output<typeof DecimalQuantitySchema>

type TransactionFields = {
  readonly id: TransactionId
  readonly occurredAt: IsoTimestamp
  readonly createdAt: IsoTimestamp
  readonly updatedAt: IsoTimestamp
  readonly syncStatus: SyncStatus
  readonly syncVersion: SyncVersion
  readonly syncedAt?: IsoTimestamp | undefined
  readonly deletedAt?: IsoTimestamp | undefined
  readonly memo?: string | undefined
}

export type SaleTransaction = TransactionFields & {
  readonly transactionType: "sale"
  readonly itemName: string
  readonly menuId?: MenuId | undefined
  readonly quantity: SaleQuantity
  readonly unitPriceWon: Won
  readonly totalAmountWon: Won
}

export type RevenueTransaction = TransactionFields & {
  readonly transactionType: "revenue"
  readonly businessDate: BusinessDate
  readonly amountWon: Won
}

export type PurchaseTransaction = TransactionFields & {
  readonly transactionType: "purchase"
  readonly ingredientId?: IngredientId | undefined
  readonly ingredientName: string
  readonly quantity: DecimalQuantity
  readonly unit: string
  readonly totalAmountWon: Won
  readonly unitPriceWon: Won
  readonly vendor?: string | undefined
}

export type ExpenseTransaction = TransactionFields & {
  readonly transactionType: "expense"
  readonly categoryId: ExpenseCategoryId
  readonly amountWon: Won
}

export type Transaction =
  | SaleTransaction
  | RevenueTransaction
  | PurchaseTransaction
  | ExpenseTransaction

export type CreateRevenueTransactionInput = Omit<RevenueTransaction, keyof TransactionFields> & {
  readonly occurredAt: IsoTimestamp
  readonly memo?: string | undefined
}

export type CreatePurchaseTransactionInput = Omit<PurchaseTransaction, keyof TransactionFields> & {
  readonly occurredAt: IsoTimestamp
  readonly memo?: string | undefined
}
export type CreateExpenseTransactionInput = Omit<ExpenseTransaction, keyof TransactionFields> & {
  readonly occurredAt: IsoTimestamp
  readonly memo?: string | undefined
}
export type CreateTransactionInput =
  | CreateRevenueTransactionInput
  | CreatePurchaseTransactionInput
  | CreateExpenseTransactionInput
export type ActiveTransaction = RevenueTransaction | PurchaseTransaction | ExpenseTransaction
export type SpendTransaction = PurchaseTransaction | ExpenseTransaction

export type TransactionSyncJob = {
  readonly id: SyncJobId
  readonly entityType: "transaction"
  readonly entityId: TransactionId
  readonly operation: SyncOperation
  readonly attemptCount: number
  readonly queuedVersion: SyncVersion
  readonly lastError?: string | undefined
  readonly nextRetryAt?: IsoTimestamp | undefined
}

export type MenuSyncJob = Omit<TransactionSyncJob, "entityType" | "entityId"> & {
  readonly entityType: "menu"
  readonly entityId: MenuId
}

export type SyncJob = TransactionSyncJob | MenuSyncJob

const TransactionMetadataSchema = z.object({
  id: TransactionIdSchema,
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
  syncStatus: SyncStatusSchema,
  syncVersion: SyncVersionSchema,
  syncedAt: IsoTimestampSchema.optional(),
  deletedAt: IsoTimestampSchema.optional(),
})
const SaleInputSchema = z.object({
  transactionType: z.literal("sale"),
  occurredAt: IsoTimestampSchema,
  itemName: RequiredTextSchema,
  menuId: MenuIdSchema.optional(),
  quantity: SaleQuantitySchema,
  unitPriceWon: WonSchema,
  memo: OptionalTextSchema,
})
const RevenueInputSchema = z.object({
  transactionType: z.literal("revenue"),
  occurredAt: IsoTimestampSchema,
  businessDate: BusinessDateSchema,
  amountWon: PositiveWonSchema,
  memo: OptionalTextSchema,
})
const PurchaseInputSchema = z.object({
  transactionType: z.literal("purchase"),
  occurredAt: IsoTimestampSchema,
  ingredientId: IngredientIdSchema.optional(),
  ingredientName: RequiredTextSchema,
  quantity: DecimalQuantitySchema,
  unit: RequiredTextSchema,
  totalAmountWon: WonSchema,
  unitPriceWon: WonSchema,
  vendor: OptionalTextSchema,
  memo: OptionalTextSchema,
})
const ExpenseInputSchema = z.object({
  transactionType: z.literal("expense"),
  occurredAt: IsoTimestampSchema,
  categoryId: ExpenseCategoryIdSchema,
  amountWon: WonSchema,
  memo: OptionalTextSchema,
})
const TransactionInputSchema = z.discriminatedUnion("transactionType", [
  RevenueInputSchema,
  PurchaseInputSchema,
  ExpenseInputSchema,
])

export const TransactionSchema = z.discriminatedUnion("transactionType", [
  SaleInputSchema.merge(TransactionMetadataSchema).extend({ totalAmountWon: WonSchema }),
  RevenueInputSchema.merge(TransactionMetadataSchema),
  PurchaseInputSchema.merge(TransactionMetadataSchema),
  ExpenseInputSchema.merge(TransactionMetadataSchema),
])
const SyncJobFieldsSchema = z.object({
  id: SyncJobIdSchema,
  operation: SyncOperationSchema,
  attemptCount: z.number().int().nonnegative(),
  queuedVersion: SyncVersionSchema,
  lastError: z.string().min(1).optional(),
  nextRetryAt: IsoTimestampSchema.optional(),
})

export const SyncJobSchema = z.discriminatedUnion("entityType", [
  SyncJobFieldsSchema.extend({
    entityType: z.literal("transaction"),
    entityId: TransactionIdSchema,
  }),
  SyncJobFieldsSchema.extend({
    entityType: z.literal("menu"),
    entityId: MenuIdSchema,
  }),
])

export function createTransactionInputFromUnknown(rawInput: unknown): CreateTransactionInput {
  return { ...TransactionInputSchema.parse(rawInput) }
}

export function createRevenueTransactionInputFromUnknown(
  rawInput: unknown,
): CreateRevenueTransactionInput {
  return { ...RevenueInputSchema.parse(rawInput) }
}

export function isSpendTransaction(transaction: Transaction): transaction is SpendTransaction {
  return transaction.transactionType === "purchase" || transaction.transactionType === "expense"
}

export function isActiveTransaction(transaction: Transaction): transaction is ActiveTransaction {
  return transaction.transactionType !== "sale"
}

export function isRevenueTransaction(transaction: Transaction): transaction is RevenueTransaction {
  return transaction.transactionType === "revenue"
}

export function normalizeIsoTimestamp(timestamp: IsoTimestamp): IsoTimestamp {
  return IsoTimestampSchema.parse(new Date(timestamp).toISOString())
}
