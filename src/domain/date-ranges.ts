import { type IsoTimestamp, IsoTimestampSchema } from "./ledger"

export const DATE_RANGE_PRESETS = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
] as const

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number]

export type DateRange = {
  readonly startInclusiveUtc: IsoTimestamp
  readonly endExclusiveUtc: IsoTimestamp
}

export type CalendarDate = {
  readonly year: number
  readonly month: number
  readonly day: number
}

export type PresetDateRangeRequest = {
  readonly kind: "preset"
  readonly preset: DateRangePreset
  readonly now: IsoTimestamp
  readonly timeZone: string
}

export type CustomDateRangeRequest = {
  readonly kind: "custom"
  readonly startDate: CalendarDate
  readonly endDateInclusive: CalendarDate
  readonly timeZone: string
}

export type DateRangeRequest = PresetDateRangeRequest | CustomDateRangeRequest

export class InvalidDateRangeError extends Error {
  readonly name = "InvalidDateRangeError"
}

export class InvalidTimeZoneError extends Error {
  readonly name = "InvalidTimeZoneError"

  constructor(readonly timeZone: string) {
    super(`지원하지 않는 시간대입니다: ${timeZone}`)
  }
}

type ZonedDateTimeParts = CalendarDate & {
  readonly hour: number
  readonly minute: number
  readonly second: number
}

function createFormatter(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-US", {
      calendar: "iso8601",
      numberingSystem: "latn",
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
  } catch (error) {
    if (error instanceof RangeError) {
      throw new InvalidTimeZoneError(timeZone)
    }
    throw error
  }
}

function zonedParts(formatter: Intl.DateTimeFormat, instant: Date): ZonedDateTimeParts {
  /** Mutable parsing slots are confined to this Intl boundary adapter. */
  let year: number | undefined
  let month: number | undefined
  let day: number | undefined
  let hour: number | undefined
  let minute: number | undefined
  let second: number | undefined

  for (const part of formatter.formatToParts(instant)) {
    const value = Number.parseInt(part.value, 10)
    switch (part.type) {
      case "year":
        year = value
        break
      case "month":
        month = value
        break
      case "day":
        day = value
        break
      case "hour":
        hour = value
        break
      case "minute":
        minute = value
        break
      case "second":
        second = value
        break
    }
  }

  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    throw new InvalidDateRangeError("시간대 달력 값을 읽을 수 없습니다.")
  }

  return { year, month, day, hour, minute, second }
}

function normalizedDate(date: CalendarDate): CalendarDate {
  const instant = new Date(Date.UTC(date.year, date.month - 1, date.day))
  const normalized = {
    year: instant.getUTCFullYear(),
    month: instant.getUTCMonth() + 1,
    day: instant.getUTCDate(),
  }

  if (
    normalized.year !== date.year ||
    normalized.month !== date.month ||
    normalized.day !== date.day
  ) {
    throw new InvalidDateRangeError("존재하지 않는 달력 날짜입니다.")
  }

  return normalized
}

function shiftDate(date: CalendarDate, days: number): CalendarDate {
  const instant = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return {
    year: instant.getUTCFullYear(),
    month: instant.getUTCMonth() + 1,
    day: instant.getUTCDate(),
  }
}

function localMidnightUtc(date: CalendarDate, formatter: Intl.DateTimeFormat): IsoTimestamp {
  const desiredWallTime = Date.UTC(date.year, date.month - 1, date.day)
  let candidate = desiredWallTime

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const observed = zonedParts(formatter, new Date(candidate))
    const observedWallTime = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    )
    candidate -= observedWallTime - desiredWallTime
  }

  return IsoTimestampSchema.parse(new Date(candidate).toISOString())
}

function startOfWeek(date: CalendarDate): CalendarDate {
  const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()
  return shiftDate(date, -((weekday + 6) % 7))
}

function monthStart(date: CalendarDate, monthOffset: number): CalendarDate {
  const instant = new Date(Date.UTC(date.year, date.month - 1 + monthOffset, 1))
  return {
    year: instant.getUTCFullYear(),
    month: instant.getUTCMonth() + 1,
    day: 1,
  }
}

function presetCalendarRange(
  preset: DateRangePreset,
  today: CalendarDate,
): readonly [CalendarDate, CalendarDate] {
  switch (preset) {
    case "today":
      return [today, shiftDate(today, 1)]
    case "yesterday":
      return [shiftDate(today, -1), today]
    case "this_week": {
      const start = startOfWeek(today)
      return [start, shiftDate(start, 7)]
    }
    case "last_week": {
      const end = startOfWeek(today)
      return [shiftDate(end, -7), end]
    }
    case "this_month":
      return [monthStart(today, 0), monthStart(today, 1)]
    case "last_month":
      return [monthStart(today, -1), monthStart(today, 0)]
  }
}

function createRange(
  startDate: CalendarDate,
  endDateExclusive: CalendarDate,
  formatter: Intl.DateTimeFormat,
): DateRange {
  return {
    startInclusiveUtc: localMidnightUtc(startDate, formatter),
    endExclusiveUtc: localMidnightUtc(endDateExclusive, formatter),
  }
}

export function resolveDateRange(request: DateRangeRequest): DateRange {
  const formatter = createFormatter(request.timeZone)

  switch (request.kind) {
    case "preset": {
      const current = zonedParts(formatter, new Date(request.now))
      const [startDate, endDateExclusive] = presetCalendarRange(request.preset, current)
      return createRange(startDate, endDateExclusive, formatter)
    }
    case "custom": {
      const startDate = normalizedDate(request.startDate)
      const endDateInclusive = normalizedDate(request.endDateInclusive)
      const endDateExclusive = shiftDate(endDateInclusive, 1)
      const range = createRange(startDate, endDateExclusive, formatter)

      if (range.startInclusiveUtc >= range.endExclusiveUtc) {
        throw new InvalidDateRangeError("종료일은 시작일보다 빠를 수 없습니다.")
      }

      return range
    }
  }
}
