import { BarChart3 } from "lucide-react"
import { useEffect, useState } from "react"
import { type DailyLedgerSummary, transactionCalendarDate } from "../../domain/analytics"
import { PREDEFINED_EXPENSE_CATEGORIES } from "../../domain/expense-categories"
import type { ActiveTransaction } from "../../domain/ledger"
import { currentBusinessDate, errorMessage } from "../../shared/form-values"
import {
  formatBasisPoints,
  formatKoreanDate,
  formatKoreanDateTime,
  formatWon,
} from "../../shared/formatters"
import type { LedgerPeriodView, LedgerViewService, PeriodSelection } from "./ledger-view-service"
import { MetricGrid } from "./MetricGrid"
import { MonthlyCalendar } from "./MonthlyCalendar"

const categoryNames = new Map(
  PREDEFINED_EXPENSE_CATEGORIES.map((category) => [category.id, category.name]),
)

function monthSelection(month: string): PeriodSelection {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (match === null) throw new Error("월을 확인해 주세요.")
  const year = Number(match[1])
  const monthNumber = Number(match[2])
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return {
    kind: "custom",
    startDate: `${month}-01`,
    endDateInclusive: `${month}-${String(lastDay).padStart(2, "0")}`,
  }
}

function emptyDay(date: string): DailyLedgerSummary {
  return {
    date,
    revenueWon: 0,
    materialCostWon: 0,
    operatingExpenseWon: 0,
    totalExpenseWon: 0,
    materialPurchaseRatio: { kind: "unavailable" },
  }
}

function transactionLabel(transaction: ActiveTransaction): string {
  switch (transaction.transactionType) {
    case "revenue":
      return "매출"
    case "purchase":
      return `재료 구매 · ${transaction.ingredientName}`
    case "expense":
      return "운영비"
  }
}

function transactionAmount(transaction: ActiveTransaction): number {
  return transaction.transactionType === "purchase"
    ? transaction.totalAmountWon
    : transaction.amountWon
}

export function AnalyticsPage({ service }: { readonly service?: LedgerViewService | undefined }) {
  const today = currentBusinessDate()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(today)
  const [view, setView] = useState<LedgerPeriodView | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (service === undefined) return
    let active = true
    setLoading(true)
    setError("")
    service.load(monthSelection(month)).then(
      (loaded) => {
        if (active) {
          setView(loaded)
          setLoading(false)
        }
      },
      (caught: unknown) => {
        if (active) {
          setError(errorMessage(caught))
          setLoading(false)
        }
      },
    )
    return () => {
      active = false
    }
  }, [month, service])

  function changeMonth(nextMonth: string) {
    setMonth(nextMonth)
    setSelectedDate(nextMonth === today.slice(0, 7) ? today : `${nextMonth}-01`)
  }

  const selectedDay =
    view?.summary.dailyLedger.find((day) => day.date === selectedDate) ?? emptyDay(selectedDate)
  const selectedTransactions =
    view?.transactions.filter(
      (transaction) => transactionCalendarDate(transaction) === selectedDate,
    ) ?? []
  const maximumDailyAmount = Math.max(
    0,
    ...(view?.summary.dailyLedger.flatMap((day) => [day.revenueWon, day.totalExpenseWon]) ?? []),
  )

  return (
    <main className="app-shell__body page-stack analytics-page" id="main-content" tabIndex={-1}>
      <header className="page-heading">
        <p className="eyebrow">월간 매출·지출</p>
        <h1>통계</h1>
        <p>날짜별 총매출과 지출을 비교하고 재료 구매비율을 확인합니다.</p>
      </header>
      {loading && (
        <p className="empty-state" role="status">
          집계 중입니다…
        </p>
      )}
      {error !== "" && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!loading && error === "" && view !== null && (
        <section className="metrics-section" aria-label="매출과 지출 집계">
          <MetricGrid summary={view.summary} />
          <MonthlyCalendar
            days={view.summary.dailyLedger}
            month={month}
            onMonthChange={changeMonth}
            onSelectDate={setSelectedDate}
            selectedDate={selectedDate}
            today={today}
          />
          <section
            className="surface-card selected-day-card"
            aria-labelledby="selected-day-heading"
          >
            <div className="section-heading">
              <h2 id="selected-day-heading">{formatKoreanDate(selectedDate)}</h2>
              <span>{selectedTransactions.length}건</span>
            </div>
            <dl className="day-summary-grid">
              <div>
                <dt>매출</dt>
                <dd>{formatWon(selectedDay.revenueWon)}</dd>
              </div>
              <div>
                <dt>재료 구매비</dt>
                <dd>{formatWon(selectedDay.materialCostWon)}</dd>
              </div>
              <div>
                <dt>운영비</dt>
                <dd>{formatWon(selectedDay.operatingExpenseWon)}</dd>
              </div>
              <div>
                <dt>총지출</dt>
                <dd>{formatWon(selectedDay.totalExpenseWon)}</dd>
              </div>
              <div>
                <dt>매출 대비 재료 구매비율</dt>
                <dd>
                  {selectedDay.materialPurchaseRatio.kind === "available"
                    ? formatBasisPoints(selectedDay.materialPurchaseRatio.basisPoints)
                    : "—"}
                </dd>
              </div>
            </dl>
            {selectedTransactions.length === 0 ? (
              <p className="empty-state">이 날짜에는 기록이 없습니다.</p>
            ) : (
              <ul className="ledger-list calendar-detail-list">
                {selectedTransactions.map((transaction) => (
                  <li key={transaction.id}>
                    <span>
                      <strong>{transactionLabel(transaction)}</strong>
                      <small>
                        {transaction.transactionType === "revenue"
                          ? transaction.businessDate
                          : formatKoreanDateTime(transaction.occurredAt)}
                      </small>
                    </span>
                    <strong>{formatWon(transactionAmount(transaction))}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {view.summary.transactionCount === 0 && (
            <p className="empty-state calendar-empty">
              <BarChart3 aria-hidden="true" size={18} />이 달에는 매출이나 지출 기록이 없습니다.
            </p>
          )}
          <section className="surface-card analytics-detail" aria-labelledby="category-heading">
            <div className="section-heading">
              <h2 id="category-heading">운영비 분류</h2>
              <span>{view.summary.operatingExpenseByCategory.length}개 분류</span>
            </div>
            {view.summary.operatingExpenseByCategory.length === 0 ? (
              <p className="empty-state">이 달에는 운영비 기록이 없습니다.</p>
            ) : (
              <ul className="breakdown-list">
                {view.summary.operatingExpenseByCategory.map((category) => (
                  <li key={category.categoryId}>
                    <span>{categoryNames.get(category.categoryId) ?? "기타"}</span>
                    <strong>{formatWon(category.amountWon)}</strong>
                    <small>
                      {category.share.kind === "available"
                        ? formatBasisPoints(category.share.basisPoints)
                        : "0%"}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="surface-card analytics-detail" aria-labelledby="trend-heading">
            <div className="section-heading">
              <h2 id="trend-heading">일별 매출·지출 추이</h2>
              <span>{view.summary.dailyLedger.length}일</span>
            </div>
            {view.summary.dailyLedger.length === 0 ? (
              <p className="empty-state">이 달에는 표시할 추이가 없습니다.</p>
            ) : (
              <ol className="trend-list">
                {view.summary.dailyLedger.map((day) => (
                  <li key={day.date}>
                    <div>
                      <span>{day.date}</span>
                      <strong>
                        매출 {formatWon(day.revenueWon)} · 지출 {formatWon(day.totalExpenseWon)}
                      </strong>
                    </div>
                    <span className="trend-track" aria-hidden="true">
                      <span
                        className="trend-fill trend-fill--revenue"
                        style={{
                          inlineSize: `${maximumDailyAmount === 0 ? 0 : Math.max(4, Math.round((day.revenueWon / maximumDailyAmount) * 100))}%`,
                        }}
                      />
                    </span>
                    <span className="trend-track" aria-hidden="true">
                      <span
                        className="trend-fill trend-fill--spending"
                        style={{
                          inlineSize: `${maximumDailyAmount === 0 ? 0 : Math.max(4, Math.round((day.totalExpenseWon / maximumDailyAmount) * 100))}%`,
                        }}
                      />
                    </span>
                    <small>
                      재료 {formatWon(day.materialCostWon)} · 운영비{" "}
                      {formatWon(day.operatingExpenseWon)}
                    </small>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </section>
      )}
    </main>
  )
}
