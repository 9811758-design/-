import { type FormEvent, useState } from "react"
import { PREDEFINED_EXPENSE_CATEGORIES } from "../../domain/expense-categories"
import { ExpenseCategoryIdSchema } from "../../domain/ledger"
import { FormFeedback, formFeedbackIds } from "../../shared/FormFeedback"
import {
  currentLocalDateTimeValue,
  errorMessage,
  stringField,
  toIsoTimestamp,
  toWholeNumber,
} from "../../shared/form-values"
import type { TransactionWriter } from "./ledger-service"

export function ExpenseForm({ service }: { readonly service: TransactionWriter }) {
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")
    setError("")
    setSaving(true)
    const form = event.currentTarget
    try {
      const data = new FormData(form)
      const result = await service.save({
        transactionType: "expense",
        occurredAt: toIsoTimestamp(stringField(data, "occurredAt")),
        categoryId: ExpenseCategoryIdSchema.parse(stringField(data, "categoryId")),
        amountWon: toWholeNumber(stringField(data, "amountWon"), "운영비"),
        memo: stringField(data, "memo").trim() || undefined,
      })
      if (result.kind !== "saved") {
        throw new Error("운영비 분류를 확인해 주세요.")
      }
      setMessage("운영비를 기기에 저장했습니다.")
      form.reset()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      aria-busy={saving}
      aria-describedby={formFeedbackIds("expense", error !== "")}
      aria-label="운영비 입력"
      className="entry-form"
      onSubmit={handleSubmit}
    >
      <label>
        분류
        <select name="categoryId" required defaultValue="">
          <option value="" disabled>
            분류 선택
          </option>
          {PREDEFINED_EXPENSE_CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        금액
        <input name="amountWon" inputMode="numeric" pattern="[0-9]+" required />
      </label>
      <label>
        지출 일시
        <input
          name="occurredAt"
          type="datetime-local"
          defaultValue={currentLocalDateTimeValue()}
          required
        />
      </label>
      <label>
        메모 <span className="optional">선택</span>
        <input name="memo" maxLength={500} />
      </label>
      <button className="primary-button" disabled={saving} type="submit">
        {saving ? "저장 중…" : "운영비 저장"}
      </button>
      <FormFeedback error={error} id="expense" message={message} />
    </form>
  )
}
