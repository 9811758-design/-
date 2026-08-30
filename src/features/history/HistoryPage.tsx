import { Pencil, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import type { ActiveTransaction, ActiveTransactionType } from "../../domain/ledger"
import { ActiveTransactionTypeSchema } from "../../domain/ledger"
import { errorMessage } from "../../shared/form-values"
import { formatKoreanDateTime, formatWon } from "../../shared/formatters"
import type { LedgerViewService, PeriodSelection } from "../analytics/ledger-view-service"
import { PeriodPicker } from "../analytics/PeriodPicker"
import { TransactionEditor } from "./TransactionEditor"

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

function transactionAmount(transaction: ActiveTransaction): string {
  switch (transaction.transactionType) {
    case "revenue":
      return formatWon(transaction.amountWon)
    case "purchase":
      return formatWon(transaction.totalAmountWon)
    case "expense":
      return formatWon(transaction.amountWon)
  }
}

export function HistoryPage({ service }: { readonly service?: LedgerViewService | undefined }) {
  const [selection, setSelection] = useState<PeriodSelection>({
    kind: "preset",
    preset: "this_month",
  })
  const [type, setType] = useState<ActiveTransactionType | undefined>()
  const [transactions, setTransactions] = useState<readonly ActiveTransaction[]>([])
  const [editing, setEditing] = useState<ActiveTransaction | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (service === undefined) return
    setLoading(true)
    setError("")
    try {
      const view = await service.load(selection, type)
      setTransactions(
        [...view.transactions].sort((left, right) =>
          right.occurredAt.localeCompare(left.occurredAt),
        ),
      )
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }, [selection, service, type])

  useEffect(() => {
    void reload()
  }, [reload])

  async function remove(transaction: ActiveTransaction) {
    if (
      service === undefined ||
      !window.confirm("이 거래를 삭제할까요? 기록은 복구를 위해 기기에 남습니다.")
    )
      return
    if (!(await service.softDelete(transaction.id))) {
      setError("거래를 삭제하지 못했습니다.")
      return
    }
    if (editing?.id === transaction.id) setEditing(null)
    await reload()
  }

  return (
    <main className="app-shell__body page-stack history-page" id="main-content" tabIndex={-1}>
      <header className="page-heading">
        <p className="eyebrow">검색과 정정</p>
        <h1>거래 내역</h1>
        <p>수정과 삭제는 로컬 집계에 즉시 반영됩니다.</p>
      </header>
      <section className="surface-card filter-card" aria-label="거래 필터">
        <PeriodPicker onChange={setSelection} selection={selection} />
        <label>
          거래 종류
          <select
            aria-label="거래 종류"
            value={type ?? "all"}
            onChange={(event) =>
              setType(
                event.currentTarget.value === "all"
                  ? undefined
                  : ActiveTransactionTypeSchema.parse(event.currentTarget.value),
              )
            }
          >
            <option value="all">전체</option>
            <option value="revenue">매출</option>
            <option value="purchase">재료 구매</option>
            <option value="expense">운영비</option>
          </select>
        </label>
      </section>
      <section className="surface-card history-list-card" aria-labelledby="history-heading">
        <div className="section-heading">
          <h2 id="history-heading">기록</h2>
          <span>{transactions.length}건</span>
        </div>
        {loading && (
          <p className="empty-state" role="status">
            기록을 불러오는 중입니다…
          </p>
        )}
        {error !== "" && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!loading && error === "" && transactions.length === 0 && (
          <p className="empty-state">조건에 맞는 거래가 없습니다.</p>
        )}
        <ul className="ledger-list history-list">
          {transactions.map((transaction) => (
            <li className="history-item" key={transaction.id}>
              <div className="history-row">
                <div>
                  <strong>{transactionLabel(transaction)}</strong>
                  <small>{formatKoreanDateTime(transaction.occurredAt)}</small>
                </div>
                <div className="history-amount">
                  <strong>{transactionAmount(transaction)}</strong>
                  <div className="row-actions">
                    <button
                      aria-label={`${transactionLabel(transaction)} 수정`}
                      onClick={() => setEditing(transaction)}
                      type="button"
                    >
                      <Pencil aria-hidden="true" size={18} />
                    </button>
                    <button
                      aria-label={`${transactionLabel(transaction)} 삭제`}
                      onClick={() => void remove(transaction)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={18} />
                    </button>
                  </div>
                </div>
              </div>
              {editing?.id === transaction.id && service !== undefined && (
                <TransactionEditor
                  onCancel={() => setEditing(null)}
                  onSaved={() => {
                    setEditing(null)
                    void reload()
                  }}
                  service={service}
                  transaction={transaction}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
