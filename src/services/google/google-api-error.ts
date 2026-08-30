export type GoogleApiErrorCategory = "auth" | "rate_limit" | "transient" | "schema" | "permanent"

const ERROR_MESSAGES = {
  auth: "Google authorization is required.",
  rate_limit: "Google Sheets rate limit was reached.",
  transient: "Google Sheets is temporarily unavailable.",
  schema: "Google Sheets data did not match the required schema.",
  permanent: "Google Sheets rejected the request.",
} as const satisfies Record<GoogleApiErrorCategory, string>

export class GoogleApiError extends Error {
  readonly name = "GoogleApiError"

  constructor(
    readonly category: GoogleApiErrorCategory,
    readonly status: number | null,
  ) {
    super(ERROR_MESSAGES[category])
  }
}

export function categoryForStatus(status: number): GoogleApiErrorCategory {
  if (status === 401 || status === 403) return "auth"
  if (status === 429) return "rate_limit"
  if (status === 408 || status === 425 || status >= 500) return "transient"
  if (status === 400 || status === 422) return "schema"
  return "permanent"
}
