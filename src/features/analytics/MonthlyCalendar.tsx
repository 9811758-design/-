import { ChevronLeft, ChevronRight } from "lucide-react"
import { type KeyboardEvent, useRef } from "react"
import type { DailyLedgerSummary } from "../../domain/analytics"
import { formatBasisPoints, formatCompactWon, formatWon } from "../../shared/formatters"

type MonthlyCalendarProps = {
  readonly month: string
  readonly days: readonly DailyLedgerSummary[]
  readonly selectedDate: string
  readonly today: string
  readonly onMonthChange: (month: string) => void
  readonly onSelectDate: (date: string) => void
}

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"] as const

function parseMonth(month: string): { readonly year: number; readonly month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (match === null) throw new Error("월은 YYYY-MM 형식이어야 합니다.")
  return { year: Number(match[1]), month: Number(match[2]) }
}

function shiftMonth(month: string, offset: number): string {
  const parsed = parseMonth(month)
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
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

export function MonthlyCalendar({
  month,
  days,
  selectedDate,
  today,
  onMonthChange,
  onSelectDate,
}: MonthlyCalendarProps) {
  const parsed = parseMonth(month)
  const dayCount = new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate()
  const leadingEmptyCount = new Date(Date.UTC(parsed.year, parsed.month - 1, 1)).getUTCDay()
  const dayMap = new Map(days.map((day) => [day.date, day]))
  const buttonRefs = useRef(new Map<number, HTMLButtonElement>())

  function selectDay(day: number) {
    const date = `${month}-${String(day).padStart(2, "0")}`
    onSelectDate(date)
    buttonRefs.current.get(day)?.focus()
  }

  function handleDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, day: number) {
    const movement =
      event.key === "ArrowLeft"
        ? -1
        : event.key === "ArrowRight"
          ? 1
          : event.key === "ArrowUp"
            ? -7
            : event.key === "ArrowDown"
              ? 7
              : 0
    if (movement !== 0) {
      event.preventDefault()
      selectDay(Math.min(dayCount, Math.max(1, day + movement)))
      return
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault()
      selectDay(event.key === "Home" ? 1 : dayCount)
    }
  }

  return (
    <section className="surface-card calendar-card" aria-labelledby="calendar-heading">
      <div className="calendar-toolbar">
        <button
          aria-label="이전 달"
          className="calendar-month-button"
          onClick={() => onMonthChange(shiftMonth(month, -1))}
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={20} />
        </button>
        <label>
          <span id="calendar-heading">월간 매출·지출</span>
          <input
            aria-label="통계 월 선택"
            max="9999-12"
            min="2000-01"
            onChange={(event) => {
              if (/^\d{4}-\d{2}$/.test(event.currentTarget.value)) {
                onMonthChange(event.currentTarget.value)
              }
            }}
            required
            type="month"
            value={month}
          />
        </label>
        <button
          aria-label="다음 달"
          className="calendar-month-button"
          onClick={() => onMonthChange(shiftMonth(month, 1))}
          type="button"
        >
          <ChevronRight aria-hidden="true" size={20} />
        </button>
      </div>
      <div className="calendar-legend">
        <span>
          <i className="legend-dot legend-dot--revenue" />
          매출
        </span>
        <span>
          <i className="legend-dot legend-dot--spending" />
          지출
        </span>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {weekdayLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <fieldset className="calendar-grid">
        <legend className="visually-hidden">
          {parsed.year}년 {parsed.month}월 날짜
        </legend>
        {weekdayLabels.slice(0, leadingEmptyCount).map((weekday) => (
          <span aria-hidden="true" className="calendar-placeholder" key={`${month}-${weekday}`} />
        ))}
        {Array.from({ length: dayCount }, (_, index) => {
          const dayNumber = index + 1
          const date = `${month}-${String(dayNumber).padStart(2, "0")}`
          const day = dayMap.get(date) ?? emptyDay(date)
          const ratio =
            day.materialPurchaseRatio.kind === "available"
              ? formatBasisPoints(day.materialPurchaseRatio.basisPoints)
              : "계산 불가"
          const label = `${parsed.month}월 ${dayNumber}일, 매출 ${formatWon(day.revenueWon)}, 총지출 ${formatWon(day.totalExpenseWon)}, 매출 대비 재료 구매비율 ${ratio}`
          return (
            <button
              aria-label={label}
              aria-pressed={selectedDate === date}
              className={`calendar-day${today === date ? " is-today" : ""}${selectedDate === date ? " is-selected" : ""}`}
              key={date}
              onClick={() => onSelectDate(date)}
              onKeyDown={(event) => handleDayKeyDown(event, dayNumber)}
              ref={(element) => {
                if (element === null) buttonRefs.current.delete(dayNumber)
                else buttonRefs.current.set(dayNumber, element)
              }}
              type="button"
            >
              <strong>{dayNumber}</strong>
              {day.revenueWon > 0 && (
                <small className="calendar-day__revenue">
                  매 {formatCompactWon(day.revenueWon)}
                </small>
              )}
              {day.totalExpenseWon > 0 && (
                <small className="calendar-day__spending">
                  지 {formatCompactWon(day.totalExpenseWon)}
                </small>
              )}
              {day.materialPurchaseRatio.kind === "available" && (
                <small className="calendar-day__ratio">
                  {formatBasisPoints(day.materialPurchaseRatio.basisPoints)}
                </small>
              )}
            </button>
          )
        })}
      </fieldset>
    </section>
  )
}
