import type { LedgerSummary } from "../../domain/analytics"
import { formatBasisPoints, formatWon } from "../../shared/formatters"

export function MetricGrid({ summary }: { readonly summary: LedgerSummary }) {
  const metrics = [
    { label: "총매출", value: formatWon(summary.revenueWon), tone: "revenue" },
    { label: "총지출", value: formatWon(summary.totalExpenseWon), tone: "spending" },
    { label: "재료 구매비", value: formatWon(summary.materialCostWon), tone: "default" },
    { label: "운영비", value: formatWon(summary.operatingExpenseWon), tone: "default" },
    {
      label: "매출 대비 재료 구매비율",
      value:
        summary.materialPurchaseRatio.kind === "available"
          ? formatBasisPoints(summary.materialPurchaseRatio.basisPoints)
          : "—",
      tone: "default",
    },
    {
      label: "거래 건수",
      value: `${summary.transactionCount.toLocaleString("ko-KR")}건`,
      tone: "default",
    },
  ] as const

  return (
    <div className="metric-grid">
      {metrics.map((metric) => (
        <article
          className={`metric-card${metric.tone === "default" ? "" : ` metric-card--${metric.tone}`}`}
          key={metric.label}
        >
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </article>
      ))}
    </div>
  )
}
