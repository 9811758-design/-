const integerFormatter = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 })
const koreanDateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Seoul",
})
const koreanDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "Asia/Seoul",
})

function requireSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label}은 안전한 정수여야 합니다.`)
  }
}

export function formatWon(amount: number): string {
  requireSafeInteger(amount, "금액")
  return `${integerFormatter.format(amount)}원`
}

export function formatCompactWon(amount: number): string {
  requireSafeInteger(amount, "금액")
  const absolute = Math.abs(amount)
  if (absolute >= 100_000_000) return `${(amount / 100_000_000).toFixed(1).replace(/\.0$/, "")}억`
  if (absolute >= 10_000) return `${(amount / 10_000).toFixed(1).replace(/\.0$/, "")}만`
  return integerFormatter.format(amount)
}

export function formatBasisPoints(basisPoints: number): string {
  requireSafeInteger(basisPoints, "비율")
  return `${(basisPoints / 100).toFixed(2)}%`
}

export function formatKoreanDateTime(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    throw new Error("표시할 날짜가 올바르지 않습니다.")
  }
  return koreanDateTimeFormatter.format(date)
}

export function formatKoreanDate(dateValue: string): string {
  const date = new Date(`${dateValue}T00:00:00+09:00`)
  if (Number.isNaN(date.getTime())) throw new Error("표시할 날짜가 올바르지 않습니다.")
  return koreanDateFormatter.format(date)
}
