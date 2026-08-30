import { ArrowRight, Banknote, ListChecks, ReceiptText, WalletCards } from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router"
import type { LedgerSummary } from "../../domain/analytics"
import { formatBasisPoints, formatWon } from "../../shared/formatters"
import type { LedgerViewService } from "../analytics/ledger-view-service"

type DashboardData = {
  readonly today: LedgerSummary
  readonly month: LedgerSummary
}

export function DashboardPage({ service }: { readonly service?: LedgerViewService | undefined }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loadError, setLoadError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (service === undefined) return
    let active = true
    Promise.all([
      service.load({ kind: "preset", preset: "today" }),
      service.load({ kind: "preset", preset: "this_month" }),
    ]).then(
      ([today, month]) => {
        if (active) {
          setData({ today: today.summary, month: month.summary })
          setLoading(false)
        }
      },
      () => {
        if (active) {
          setLoadError("장부 요약을 불러오지 못했습니다.")
          setLoading(false)
        }
      },
    )
    return () => {
      active = false
    }
  }, [service])

  return (
    <main className="app-shell__body page-stack" id="main-content" tabIndex={-1}>
      <section className="hero-card" aria-labelledby="dashboard-heading">
        <div>
          <p className="eyebrow">오늘의 장부</p>
          <h1 id="dashboard-heading">빠르게 기록해 보세요</h1>
          <p>입력 내용은 이 기기에 저장됩니다.</p>
        </div>
        <span className="brand-logo" role="img" aria-label="쿠크봉 로고" />
      </section>
      {loading && (
        <p className="empty-state" role="status">
          장부 요약을 불러오는 중입니다…
        </p>
      )}
      {loadError !== "" && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}
      {data !== null && (
        <section className="dashboard-metrics" aria-label="오늘과 이번 달 매출 및 지출 요약">
          <article className="metric-card metric-card--revenue">
            <span>오늘 매출</span>
            <strong>{formatWon(data.today.revenueWon)}</strong>
          </article>
          <article className="metric-card metric-card--spending">
            <span>오늘 총지출</span>
            <strong>{formatWon(data.today.totalExpenseWon)}</strong>
          </article>
          <article className="metric-card">
            <span>이번 달 매출</span>
            <strong>{formatWon(data.month.revenueWon)}</strong>
          </article>
          <article className="metric-card">
            <span>이번 달 총지출</span>
            <strong>{formatWon(data.month.totalExpenseWon)}</strong>
          </article>
          <article className="metric-card">
            <span>이번 달 재료 구매비</span>
            <strong>{formatWon(data.month.materialCostWon)}</strong>
          </article>
          <article className="metric-card">
            <span>이번 달 운영비</span>
            <strong>{formatWon(data.month.operatingExpenseWon)}</strong>
          </article>
          <article className="metric-card">
            <span>매출 대비 재료 구매비율</span>
            <strong>
              {data.month.materialPurchaseRatio.kind === "available"
                ? formatBasisPoints(data.month.materialPurchaseRatio.basisPoints)
                : "—"}
            </strong>
          </article>
          <article className="metric-card">
            <span>이번 달 거래 건수</span>
            <strong>{data.month.transactionCount.toLocaleString("ko-KR")}건</strong>
          </article>
        </section>
      )}
      <Link className="action-card" to="/record?type=revenue">
        <span className="action-card__icon action-card__icon--revenue">
          <Banknote aria-hidden="true" size={22} />
        </span>
        <span>
          <strong>오늘 매출 입력</strong>
          <small>날짜별 총매출을 한 건으로 기록합니다.</small>
        </span>
        <ArrowRight aria-hidden="true" size={20} />
      </Link>
      <Link className="action-card" to="/record?type=purchase">
        <span className="action-card__icon">
          <ReceiptText aria-hidden="true" size={22} />
        </span>
        <span>
          <strong>재료 구매 기록</strong>
          <small>재료명과 구매 금액을 입력합니다.</small>
        </span>
        <ArrowRight aria-hidden="true" size={20} />
      </Link>
      <Link className="action-card" to="/record?type=expense">
        <span className="action-card__icon">
          <WalletCards aria-hidden="true" size={22} />
        </span>
        <span>
          <strong>운영비 기록</strong>
          <small>카테고리별 운영비를 입력합니다.</small>
        </span>
        <ArrowRight aria-hidden="true" size={20} />
      </Link>
      <Link className="action-card" to="/history">
        <span className="action-card__icon">
          <ListChecks aria-hidden="true" size={22} />
        </span>
        <span>
          <strong>거래 내역</strong>
          <small>기간별 기록을 수정하거나 삭제합니다.</small>
        </span>
        <ArrowRight aria-hidden="true" size={20} />
      </Link>
    </main>
  )
}
