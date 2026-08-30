import { type FormEvent, useState } from "react"
import { FormFeedback, formFeedbackIds } from "../../shared/FormFeedback"
import {
  currentLocalDateTimeValue,
  errorMessage,
  stringField,
  toIsoTimestamp,
  toWholeNumber,
} from "../../shared/form-values"
import type { TransactionWriter } from "./ledger-service"

export function PurchaseForm({ service }: { readonly service: TransactionWriter }) {
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
      const totalAmountWon = toWholeNumber(stringField(data, "totalAmountWon"), "구매 금액")
      const quantity = stringField(data, "quantity")
      const unitPriceWon = toWholeNumber(stringField(data, "unitPriceWon"), "단가")
      const result = await service.save({
        transactionType: "purchase",
        occurredAt: toIsoTimestamp(stringField(data, "occurredAt")),
        ingredientName: stringField(data, "ingredientName"),
        quantity,
        unit: stringField(data, "unit"),
        totalAmountWon,
        unitPriceWon,
        vendor: stringField(data, "vendor").trim() || undefined,
        memo: stringField(data, "memo").trim() || undefined,
      })
      if (result.kind !== "saved") {
        throw new Error("재료 구매를 저장하지 못했습니다.")
      }
      setMessage("재료 구매를 기기에 저장했습니다.")
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
      aria-describedby={formFeedbackIds("purchase", error !== "")}
      aria-label="재료 구매 입력"
      className="entry-form"
      onSubmit={handleSubmit}
    >
      <label>
        재료명
        <input name="ingredientName" maxLength={100} required />
      </label>
      <div className="field-row">
        <label>
          수량
          <input name="quantity" inputMode="decimal" placeholder="2.5" required />
        </label>
        <label>
          단위
          <input name="unit" placeholder="kg" maxLength={100} required />
        </label>
      </div>
      <label>
        구매 금액
        <input name="totalAmountWon" inputMode="numeric" pattern="[0-9]+" required />
      </label>
      <label>
        단가
        <input name="unitPriceWon" inputMode="numeric" pattern="[0-9]+" required />
      </label>
      <label>
        구매 일시
        <input
          name="occurredAt"
          type="datetime-local"
          defaultValue={currentLocalDateTimeValue()}
          required
        />
      </label>
      <label>
        구매처 <span className="optional">선택</span>
        <input name="vendor" maxLength={500} />
      </label>
      <label>
        메모 <span className="optional">선택</span>
        <input name="memo" maxLength={500} />
      </label>
      <button className="primary-button" disabled={saving} type="submit">
        {saving ? "저장 중…" : "재료 구매 저장"}
      </button>
      <FormFeedback error={error} id="purchase" message={message} />
    </form>
  )
}
