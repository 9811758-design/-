import { currentLocalDateTimeValue } from "../../shared/form-values"
import type { PeriodSelection } from "./ledger-view-service"

const presets = [
  { value: "today", label: "오늘" },
  { value: "yesterday", label: "어제" },
  { value: "this_week", label: "이번 주" },
  { value: "last_week", label: "지난 주" },
  { value: "this_month", label: "이번 달" },
  { value: "last_month", label: "지난 달" },
] as const

type PeriodPickerProps = {
  readonly selection: PeriodSelection
  readonly onChange: (selection: PeriodSelection) => void
}

export function PeriodPicker({ selection, onChange }: PeriodPickerProps) {
  const today = currentLocalDateTimeValue().slice(0, 10)

  return (
    <div className="period-picker">
      <label>
        조회 기간
        <select
          aria-label="조회 기간"
          value={selection.kind === "preset" ? selection.preset : "custom"}
          onChange={(event) => {
            const value = event.currentTarget.value
            const preset = presets.find((item) => item.value === value)
            onChange(
              preset === undefined
                ? { kind: "custom", startDate: today, endDateInclusive: today }
                : { kind: "preset", preset: preset.value },
            )
          }}
        >
          {presets.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
          <option value="custom">직접 지정</option>
        </select>
      </label>
      {selection.kind === "custom" && (
        <div className="field-row">
          <label>
            시작일
            <input
              type="date"
              value={selection.startDate}
              onChange={(event) => onChange({ ...selection, startDate: event.currentTarget.value })}
            />
          </label>
          <label>
            종료일
            <input
              type="date"
              value={selection.endDateInclusive}
              onChange={(event) =>
                onChange({ ...selection, endDateInclusive: event.currentTarget.value })
              }
            />
          </label>
        </div>
      )}
    </div>
  )
}
