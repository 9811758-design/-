import { z } from "zod"

const AccessTokenSchema = z.string().min(1).brand<"GoogleAccessToken">()
const TokenResponseSchema = z.object({
  access_token: AccessTokenSchema.optional(),
  error: z.string().optional(),
})
const RevocationResponseSchema = z.object({
  successful: z.boolean(),
  error: z.string().optional(),
})

export type GoogleAccessToken = z.output<typeof AccessTokenSchema>

export type GoogleTokenClientConfig = {
  readonly client_id: string
  readonly scope: string
  readonly callback: (response: unknown) => void
  readonly error_callback: (error: unknown) => void
}

export interface GoogleTokenClient {
  requestAccessToken(): void
}

export interface GoogleIdentityBoundary {
  initTokenClient(config: GoogleTokenClientConfig): GoogleTokenClient
  revoke(token: string, done: (response: unknown) => void): void
}

export interface GoogleIdentityPort {
  requestAccessToken(): Promise<GoogleAccessToken>
  getAccessToken(): GoogleAccessToken | null
  revoke(): Promise<void>
}

type IdentityErrorCategory = "busy" | "denied" | "revoke_failed" | "unavailable"

const IDENTITY_MESSAGES = {
  busy: "Google authorization is already in progress.",
  denied: "Google authorization was not granted.",
  revoke_failed: "Google authorization could not be revoked.",
  unavailable: "Google Identity Services is unavailable.",
} as const satisfies Record<IdentityErrorCategory, string>

export class GoogleIdentityError extends Error {
  readonly name = "GoogleIdentityError"

  constructor(readonly category: IdentityErrorCategory) {
    super(IDENTITY_MESSAGES[category])
  }
}

type PendingTokenRequest = {
  readonly resolve: (token: GoogleAccessToken) => void
  readonly reject: (error: GoogleIdentityError) => void
}

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"

export class GoogleIdentityBrowser implements GoogleIdentityPort {
  readonly #boundary: GoogleIdentityBoundary
  readonly #client: GoogleTokenClient
  #accessToken: GoogleAccessToken | null = null
  #pending: PendingTokenRequest | null = null

  constructor(clientId: string, boundary: GoogleIdentityBoundary) {
    this.#boundary = boundary
    this.#client = boundary.initTokenClient({
      client_id: z.string().min(1).parse(clientId),
      scope: SHEETS_SCOPE,
      callback: (response) => this.#handleTokenResponse(response),
      error_callback: () => this.#rejectPending("unavailable"),
    })
  }

  requestAccessToken(): Promise<GoogleAccessToken> {
    if (this.#pending !== null) {
      return Promise.reject(new GoogleIdentityError("busy"))
    }

    return new Promise((resolve, reject) => {
      this.#pending = { resolve, reject }
      this.#client.requestAccessToken()
    })
  }

  getAccessToken(): GoogleAccessToken | null {
    return this.#accessToken
  }

  revoke(): Promise<void> {
    const token = this.#accessToken
    if (token === null) return Promise.resolve()

    return new Promise((resolve, reject) => {
      this.#boundary.revoke(token, (rawResponse) => {
        const response = RevocationResponseSchema.safeParse(rawResponse)
        if (response.success && response.data.successful) {
          this.#accessToken = null
          resolve()
          return
        }
        reject(new GoogleIdentityError("revoke_failed"))
      })
    })
  }

  #handleTokenResponse(rawResponse: unknown): void {
    const response = TokenResponseSchema.safeParse(rawResponse)
    if (!response.success || response.data.access_token === undefined) {
      this.#rejectPending("denied")
      return
    }

    const pending = this.#pending
    this.#pending = null
    this.#accessToken = response.data.access_token
    pending?.resolve(response.data.access_token)
  }

  #rejectPending(category: IdentityErrorCategory): void {
    const pending = this.#pending
    this.#pending = null
    pending?.reject(new GoogleIdentityError(category))
  }
}
