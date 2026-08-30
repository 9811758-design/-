import type { CafeLedgerRepository } from "../../data/ledger-repository"
import { PREDEFINED_EXPENSE_CATEGORIES } from "../../domain/expense-categories"
import { createTransactionInputFromUnknown } from "../../domain/ledger"

const expenseCategoryIds = new Set(PREDEFINED_EXPENSE_CATEGORIES.map((category) => category.id))

export type SaveTransactionResult =
  | { readonly kind: "saved"; readonly mode: "created" | "updated" }
  | { readonly kind: "expense_category_not_found" }

export type TransactionWriter = {
  readonly save: (rawInput: unknown) => Promise<SaveTransactionResult>
}

export class LocalLedgerService {
  constructor(private readonly ledgerRepository: CafeLedgerRepository) {}

  async save(rawInput: unknown): Promise<SaveTransactionResult> {
    const input = createTransactionInputFromUnknown(rawInput)

    if (input.transactionType === "revenue") {
      const result = await this.ledgerRepository.upsertDailyRevenue(input)
      return { kind: "saved", mode: result.kind }
    }

    if (input.transactionType === "expense" && !expenseCategoryIds.has(input.categoryId)) {
      return { kind: "expense_category_not_found" }
    }

    await this.ledgerRepository.create(input)
    return { kind: "saved", mode: "created" }
  }
}
