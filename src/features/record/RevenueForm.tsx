import { type FormEvent, useState } from "react"
import { FormFeedback, formFeedbackIds } from "../../shared/FormFeedback"
import {
  businessDateToIsoTimestamp,
  currentBusinessDate,
  errorMessage,
  stringField,
  toPositiveWholeNumber,
} from "../../shared/form-values"
import type { TransactionWriter } from "./ledger-service"

export function RevenueForm({ service }: { readonly service: TransactionWriter }) {
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
      const businessDate = stringField(data, "businessDate")
      const result = await service.save({
        transactionType: "revenue",
        businessDate,
        occurredAt: businessDateToIsoTimestamp(businessDate),
        amountWon: toPositiveWholeNumber(stringField(data, "amountWon"), "총매출액"),
        memo: stringField(data, "memo").trim() || undefined,
      })
      if (result.kind !== "saved") throw new Error("매출을 저장하지 못했습니다.")
      setMessage(
        result.mode === "updated"
          ? "해당 영업일의 매출을 수정했습니다."
          : "매출을 기기에 저장했습니다.",
      )
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      aria-busy={saving}
      aria-describedby={formFeedbackIds("revenue", error !== "")}
      aria-label="날짜별 총매출 입력"
      className="entry-form"
      onSubmit={handleSubmit}
    >
      <label>
        영업일
        <input name="businessDate" type="date" defaultValue={currentBusinessDate()} required />
      </label>
      <label>
        총매출액
        <input name="amountWon" inputMode="numeric" pattern="[0-9]+" required />
      </label>
      <label>
        메모 <span className="optional">선택</span>
        <input name="memo" maxLength={500} />
      </label>
      <button className="primary-button" disabled={saving} type="submit">
        {saving ? "저장 중…" : "매출 저장"}
      </button>
      <FormFeedback error={error} id="revenue" message={message} />
    </form>
  )
}
