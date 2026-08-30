import type { CafeLedgerRepository } from "../../data/ledger-repository"
import { calculateLedgerSummary, type LedgerSummary } from "../../domain/analytics"
import {
  type CalendarDate,
  type DateRange,
  type DateRangePreset,
  resolveDateRange,
} from "../../domain/date-ranges"
import {
  type ActiveTransaction,
  type ActiveTransactionType,
  createTransactionInputFromUnknown,
  IsoTimestampSchema,
  isActiveTransaction,
  type TransactionId,
} from "../../domain/ledger"

export type PeriodSelection =
  | { readonly kind: "preset"; readonly preset: DateRangePreset }
  | { readonly kind: "custom"; readonly startDate: string; readonly endDateInclusive: string }

export type LedgerPeriodView = {
  readonly dateRange: DateRange
  readonly transactions: readonly ActiveTransaction[]
  readonly summary: LedgerSummary
}

function calendarDate(value: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const year = match?.[1]
  const month = match?.[2]
  const day = match?.[3]
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.")
  }
  return { year: Number(year), month: Number(month), day: Number(day) }
}

export class LedgerViewService {
  constructor(
    private readonly repository: CafeLedgerRepository,
    private readonly clock: () => string = () => new Date().toISOString(),
    private readonly timeZone = "Asia/Seoul",
  ) {}

  async load(
    selection: PeriodSelection,
    transactionType?: ActiveTransactionType,
  ): Promise<LedgerPeriodView> {
    const dateRange =
      selection.kind === "preset"
        ? resolveDateRange({
            kind: "preset",
            preset: selection.preset,
            now: IsoTimestampSchema.parse(this.clock()),
            timeZone: this.timeZone,
          })
        : resolveDateRange({
            kind: "custom",
            startDate: calendarDate(selection.startDate),
            endDateInclusive: calendarDate(selection.endDateInclusive),
            timeZone: this.timeZone,
          })
    const transactions = (await this.repository.query({ dateRange, transactionType })).filter(
      isActiveTransaction,
    )
    return {
      dateRange,
      transactions,
      summary: calculateLedgerSummary(transactions, this.timeZone),
    }
  }

  async update(id: TransactionId, rawInput: unknown): Promise<boolean> {
    const result = await this.repository.update(id, createTransactionInputFromUnknown(rawInput))
    return result.kind === "updated"
  }

  async softDelete(id: TransactionId): Promise<boolean> {
    const result = await this.repository.softDelete(id)
    return result.kind === "soft_deleted"
  }
}
