import { useState } from "react"
import { useSearchParams } from "react-router"
import type { AppServices } from "../../app/app-services"
import { ExpenseForm } from "./ExpenseForm"
import { PurchaseForm } from "./PurchaseForm"
import { RevenueForm } from "./RevenueForm"

type EntryType = "revenue" | "purchase" | "expense"

const entryTypes = [
  { id: "revenue", label: "매출" },
  { id: "purchase", label: "재료 구매" },
  { id: "expense", label: "운영비" },
] as const

export function RecordPage({ services }: { readonly services?: AppServices | undefined }) {
  const [searchParams] = useSearchParams()
  const requestedType = searchParams.get("type")
  const initialType = entryTypes.some((item) => item.id === requestedType)
    ? (requestedType as EntryType)
    : "purchase"
  const [entryType, setEntryType] = useState<EntryType>(initialType)

  if (services === undefined) {
    return (
      <main className="app-shell__body" id="main-content" tabIndex={-1}>
        <p className="empty-state" role="status">
          저장소를 준비하고 있습니다.
        </p>
      </main>
    )
  }

  return (
    <main className="app-shell__body page-stack" id="main-content" tabIndex={-1}>
      <header className="page-heading">
        <p className="eyebrow">빠른 입력</p>
        <h1>거래 기록</h1>
        <p>완료 안내는 기기 저장이 끝난 뒤 표시됩니다.</p>
      </header>
      <fieldset className="segmented-control">
        <legend className="visually-hidden">거래 종류</legend>
        {entryTypes.map((item) => (
          <button
            aria-pressed={entryType === item.id}
            className={entryType === item.id ? "is-active" : ""}
            key={item.id}
            onClick={() => setEntryType(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </fieldset>
      <section
        className="surface-card"
        aria-label={`${entryTypes.find((item) => item.id === entryType)?.label ?? "거래"} 입력`}
      >
        {entryType === "revenue" && <RevenueForm service={services.ledgerService} />}
        {entryType === "purchase" && <PurchaseForm service={services.ledgerService} />}
        {entryType === "expense" && <ExpenseForm service={services.ledgerService} />}
      </section>
    </main>
  )
}
