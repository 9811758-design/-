import type { ExpenseCategoryId, Transaction } from "./ledger"

export type Ratio =
  | { readonly kind: "available"; readonly basisPoints: number }
  | { readonly kind: "unavailable" }

export type OperatingExpenseCategorySummary = {
  readonly categoryId: ExpenseCategoryId
  readonly amountWon: number
  readonly share: Ratio
}

export type DailyLedgerSummary = {
  readonly date: string
  readonly revenueWon: number
  readonly materialCostWon: number
  readonly operatingExpenseWon: number
  readonly totalExpenseWon: number
  readonly materialPurchaseRatio: Ratio
}

export type LedgerSummary = {
  readonly revenueWon: number
  readonly materialCostWon: number
  readonly operatingExpenseWon: number
  readonly totalExpenseWon: number
  readonly transactionCount: number
  readonly materialPurchaseRatio: Ratio
  readonly operatingExpenseByCategory: readonly OperatingExpenseCategorySummary[]
  readonly dailyLedger: readonly DailyLedgerSummary[]
}

export class UnsafeAggregateError extends Error {
  readonly name = "UnsafeAggregateError"

  constructor(readonly field: string) {
    super(`집계 값이 안전한 정수 범위를 벗어났습니다: ${field}`)
  }
}

function toSafeInteger(value: bigint, field: string): number {
  const maximum = BigInt(Number.MAX_SAFE_INTEGER)
  if (value > maximum || value < -maximum) throw new UnsafeAggregateError(field)
  return Number(value)
}

function calculateRatio(numerator: bigint, denominator: bigint, field: string): Ratio {
  if (denominator === 0n) return { kind: "unavailable" }
  const scaled = numerator * 10_000n
  return {
    kind: "available",
    basisPoints: toSafeInteger((scaled + denominator / 2n) / denominator, field),
  }
}

function calendarDate(timestamp: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp))
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? ""
  return `${value("year")}-${value("month")}-${value("day")}`
}

export function transactionCalendarDate(transaction: Transaction, timeZone = "Asia/Seoul"): string {
  return transaction.transactionType === "revenue"
    ? transaction.businessDate
    : calendarDate(transaction.occurredAt, timeZone)
}

export function calculateLedgerSummary(
  transactions: readonly Transaction[],
  timeZone = "Asia/Seoul",
): LedgerSummary {
  let revenue = 0n
  let materialCost = 0n
  let operatingExpense = 0n
  let transactionCount = 0n
  const categories = new Map<ExpenseCategoryId, bigint>()
  const daily = new Map<string, { revenue: bigint; material: bigint; operating: bigint }>()

  for (const transaction of transactions) {
    if (transaction.deletedAt !== undefined || transaction.transactionType === "sale") continue

    transactionCount += 1n
    const date = transactionCalendarDate(transaction, timeZone)
    const day = daily.get(date) ?? { revenue: 0n, material: 0n, operating: 0n }

    switch (transaction.transactionType) {
      case "revenue": {
        const amount = BigInt(transaction.amountWon)
        revenue += amount
        day.revenue += amount
        break
      }
      case "purchase": {
        const amount = BigInt(transaction.totalAmountWon)
        materialCost += amount
        day.material += amount
        break
      }
      case "expense": {
        const amount = BigInt(transaction.amountWon)
        operatingExpense += amount
        day.operating += amount
        categories.set(
          transaction.categoryId,
          (categories.get(transaction.categoryId) ?? 0n) + amount,
        )
        break
      }
    }
    daily.set(date, day)
  }

  const totalExpense = materialCost + operatingExpense
  return {
    revenueWon: toSafeInteger(revenue, "revenueWon"),
    materialCostWon: toSafeInteger(materialCost, "materialCostWon"),
    operatingExpenseWon: toSafeInteger(operatingExpense, "operatingExpenseWon"),
    totalExpenseWon: toSafeInteger(totalExpense, "totalExpenseWon"),
    transactionCount: toSafeInteger(transactionCount, "transactionCount"),
    materialPurchaseRatio: calculateRatio(materialCost, revenue, "materialPurchaseRatio"),
    operatingExpenseByCategory: [...categories.entries()]
      .map(([categoryId, amount]) => ({
        categoryId,
        amountWon: toSafeInteger(amount, "operatingExpenseByCategory"),
        share: calculateRatio(amount, operatingExpense, "operatingExpenseCategoryShare"),
      }))
      .sort((left, right) => right.amountWon - left.amountWon),
    dailyLedger: [...daily.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, amounts]) => ({
        date,
        revenueWon: toSafeInteger(amounts.revenue, "dailyRevenueWon"),
        materialCostWon: toSafeInteger(amounts.material, "dailyMaterialCostWon"),
        operatingExpenseWon: toSafeInteger(amounts.operating, "dailyOperatingExpenseWon"),
        totalExpenseWon: toSafeInteger(
          amounts.material + amounts.operating,
          "dailyTotalExpenseWon",
        ),
        materialPurchaseRatio: calculateRatio(
          amounts.material,
          amounts.revenue,
          "dailyMaterialPurchaseRatio",
        ),
      })),
  }
}
