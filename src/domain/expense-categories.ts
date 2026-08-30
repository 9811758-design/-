import { ExpenseCategoryIdSchema } from "./ledger"

export const EXPENSE_CATEGORY_IDS = {
  rent: ExpenseCategoryIdSchema.parse("835a9930-e44c-4b2c-9067-058b9d061a7f"),
  labor: ExpenseCategoryIdSchema.parse("6014bbdc-d74b-4e24-891b-fc48ab27b775"),
  utilities: ExpenseCategoryIdSchema.parse("856c98e8-c681-477d-afb7-b85dac2382e6"),
  fees: ExpenseCategoryIdSchema.parse("f11f2df9-4e16-473a-b823-19b6825b5c29"),
  supplies: ExpenseCategoryIdSchema.parse("85733a6a-c205-4505-82ab-bd3510518ad7"),
  taxes: ExpenseCategoryIdSchema.parse("44561cd7-8105-43a3-b2df-a1fdd6864802"),
  other: ExpenseCategoryIdSchema.parse("4742c36a-f7d3-48c8-8ca4-f9f77ee21fb2"),
} as const

export const PREDEFINED_EXPENSE_CATEGORIES = [
  { id: EXPENSE_CATEGORY_IDS.rent, name: "월세" },
  { id: EXPENSE_CATEGORY_IDS.labor, name: "인건비" },
  { id: EXPENSE_CATEGORY_IDS.utilities, name: "공과금" },
  { id: EXPENSE_CATEGORY_IDS.fees, name: "수수료" },
  { id: EXPENSE_CATEGORY_IDS.supplies, name: "소모품" },
  { id: EXPENSE_CATEGORY_IDS.taxes, name: "세금" },
  { id: EXPENSE_CATEGORY_IDS.other, name: "기타" },
] as const
