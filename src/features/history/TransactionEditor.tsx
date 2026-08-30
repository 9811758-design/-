import { type FormEvent, useState } from "react"
import { PREDEFINED_EXPENSE_CATEGORIES } from "../../domain/expense-categories"
import type { ActiveTransaction } from "../../domain/ledger"
import { FormFeedback, formFeedbackIds } from "../../shared/FormFeedback"
import {
  businessDateToIsoTimestamp,
  errorMessage,
  isoToLocalDateTimeValue,
  stringField,
  toIsoTimestamp,
  toPositiveWholeNumber,
  toWholeNumber,
} from "../../shared/form-values"
import type { LedgerViewService } from "../analytics/ledger-view-service"

type TransactionEditorProps = {
  readonly transaction: ActiveTransaction
  readonly service: LedgerViewService
  readonly onCancel: () => void
  readonly onSaved: () => void
}

export function TransactionEditor({
  transaction,
  service,
  onCancel,
  onSaved,
}: TransactionEditorProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    try {
      const data = new FormData(event.currentTarget)
      const memo = stringField(data, "memo").trim() || undefined
      const rawInput = (() => {
        switch (transaction.transactionType) {
          case "revenue": {
            const businessDate = stringField(data, "businessDate")
            return {
              transactionType: "revenue",
              businessDate,
              occurredAt: businessDateToIsoTimestamp(businessDate),
              amountWon: toPositiveWholeNumber(stringField(data, "amountWon"), "총매출액"),
              memo,
            }
          }
          case "purchase":
            return {
              transactionType: "purchase",
              occurredAt: toIsoTimestamp(stringField(data, "occurredAt")),
              ingredientId: transaction.ingredientId,
              ingredientName: stringField(data, "ingredientName"),
              quantity: stringField(data, "quantity"),
              unit: stringField(data, "unit"),
              totalAmountWon: toWholeNumber(stringField(data, "totalAmountWon"), "구매 금액"),
              unitPriceWon: toWholeNumber(stringField(data, "unitPriceWon"), "단가"),
              vendor: stringField(data, "vendor").trim() || undefined,
              memo,
            }
          case "expense":
            return {
              transactionType: "expense",
              occurredAt: toIsoTimestamp(stringField(data, "occurredAt")),
              categoryId: stringField(data, "categoryId"),
              amountWon: toWholeNumber(stringField(data, "amountWon"), "운영비"),
              memo,
            }
        }
      })()
      if (!(await service.update(transaction.id, rawInput))) {
        throw new Error("거래를 수정하지 못했습니다.")
      }
      onSaved()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      aria-busy={saving}
      aria-describedby={formFeedbackIds("transaction-edit", error !== "")}
      aria-label="거래 수정"
      className="entry-form transaction-editor"
      onSubmit={handleSubmit}
    >
      {transaction.transactionType === "purchase" && (
        <>
          <label>
            재료명
            <input name="ingredientName" defaultValue={transaction.ingredientName} required />
          </label>
          <div className="field-row">
            <label>
              수량
              <input
                name="quantity"
                inputMode="decimal"
                defaultValue={transaction.quantity}
                required
              />
            </label>
            <label>
              단위
              <input name="unit" defaultValue={transaction.unit} required />
            </label>
          </div>
          <label>
            구매 금액
            <input
              name="totalAmountWon"
              inputMode="numeric"
              defaultValue={transaction.totalAmountWon}
              required
            />
          </label>
          <label>
            단가
            <input
              name="unitPriceWon"
              inputMode="numeric"
              defaultValue={transaction.unitPriceWon}
              required
            />
          </label>
          <label>
            구매처
            <input name="vendor" defaultValue={transaction.vendor ?? ""} />
          </label>
        </>
      )}
      {transaction.transactionType === "revenue" && (
        <>
          <label>
            영업일
            <input
              name="businessDate"
              type="date"
              defaultValue={transaction.businessDate}
              required
            />
          </label>
          <label>
            총매출액
            <input
              name="amountWon"
              inputMode="numeric"
              defaultValue={transaction.amountWon}
              required
            />
          </label>
        </>
      )}
      {transaction.transactionType === "expense" && (
        <>
          <label>
            분류
            <select name="categoryId" defaultValue={transaction.categoryId}>
              {PREDEFINED_EXPENSE_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            금액
            <input
              name="amountWon"
              inputMode="numeric"
              defaultValue={transaction.amountWon}
              required
            />
          </label>
        </>
      )}
      {transaction.transactionType !== "revenue" && (
        <label>
          거래 일시
          <input
            name="occurredAt"
            type="datetime-local"
            defaultValue={isoToLocalDateTimeValue(transaction.occurredAt)}
            required
          />
        </label>
      )}
      <label>
        메모
        <input name="memo" defaultValue={transaction.memo ?? ""} maxLength={500} />
      </label>
      <div className="button-row">
        <button className="primary-button" disabled={saving} type="submit">
          {saving ? "저장 중…" : "수정 저장"}
        </button>
        <button className="secondary-button" onClick={onCancel} type="button">
          취소
        </button>
      </div>
      <FormFeedback error={error} id="transaction-edit" />
    </form>
  )
}
