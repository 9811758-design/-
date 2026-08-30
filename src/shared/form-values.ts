import { ZodError } from "zod"
import { BusinessDateSchema, IsoTimestampSchema } from "../domain/ledger"

export function currentBusinessDate(now = new Date(), timeZone = "Asia/Seoul"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? ""
  return BusinessDateSchema.parse(`${value("year")}-${value("month")}-${value("day")}`)
}

export function businessDateToIsoTimestamp(businessDate: string): string {
  const parsed = BusinessDateSchema.parse(businessDate)
  return IsoTimestampSchema.parse(new Date(`${parsed}T00:00:00+09:00`).toISOString())
}

export function currentLocalDateTimeValue(now = new Date()): string {
  const localMilliseconds = now.getTime() - now.getTimezoneOffset() * 60_000
  return new Date(localMilliseconds).toISOString().slice(0, 16)
}

export function isoToLocalDateTimeValue(timestamp: string): string {
  return currentLocalDateTimeValue(new Date(timestamp))
}

export function toIsoTimestamp(localDateTime: string): string {
  const parsed = new Date(localDateTime)
  if (localDateTime.trim() === "" || Number.isNaN(parsed.getTime())) {
    throw new Error("날짜와 시간을 확인해 주세요.")
  }
  return parsed.toISOString()
}

export function toWholeNumber(value: string, label: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${label}은 0 이상의 정수로 입력해 주세요.`)
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label}이 안전한 범위를 벗어났습니다.`)
  }
  return parsed
}

export function toPositiveWholeNumber(value: string, label: string): number {
  const parsed = toWholeNumber(value, label)
  if (parsed === 0) throw new Error(`${label}은 0원보다 커야 합니다.`)
  return parsed
}

export function errorMessage(error: unknown): string {
  if (error instanceof ZodError) return "입력값을 확인해 주세요."
  return error instanceof Error ? error.message : "저장하지 못했습니다. 다시 시도해 주세요."
}

export function stringField(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === "string" ? value : ""
}
