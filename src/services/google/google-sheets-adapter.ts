import { z } from "zod"

import type { ActiveTransaction } from "../../domain/ledger"
import { categoryForStatus, GoogleApiError } from "./google-api-error"
import {
  type GoogleSheetsPort,
  type RawCell,
  type RawRow,
  SHEET_HEADERS,
  SHEET_TITLES,
  type SpreadsheetValidation,
} from "./google-sheets-contract"
import { transactionRow } from "./google-sheets-rows"

export type { GoogleApiErrorCategory } from "./google-api-error"
export { GoogleApiError } from "./google-api-error"
export {
  type GoogleSheetsPort,
  SHEET_HEADERS,
  SHEET_TITLES,
  type SpreadsheetValidation,
} from "./google-sheets-contract"

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

type AdapterOptions = {
  readonly fetcher: FetchLike
  readonly getAccessToken: () => string | null
}

type ApiRequest = {
  readonly path: string
  readonly method?: "GET" | "POST" | "PUT"
  readonly body?: unknown
}

type UpsertRequest = {
  readonly spreadsheetId: string
  readonly sheetTitle: "Transactions"
  readonly id: string
  readonly row: RawRow
}

const CreateSpreadsheetResponseSchema = z.object({ spreadsheetId: z.string().min(1) })
const SpreadsheetMetadataSchema = z.object({
  sheets: z.array(z.object({ properties: z.object({ title: z.string() }) })),
})
const ValuesResponseSchema = z.object({
  values: z.array(z.array(z.union([z.string(), z.number(), z.boolean()]))).optional(),
})

const API_ROOT = "https://sheets.googleapis.com/v4/spreadsheets"

export class GoogleSheetsAdapter implements GoogleSheetsPort {
  readonly #fetcher: FetchLike
  readonly #getAccessToken: () => string | null
  /** Serializes same-entity writes within this adapter instance. */
  readonly #pendingUpserts = new Map<string, Promise<void>>()

  constructor(options: AdapterOptions) {
    this.#fetcher = options.fetcher
    this.#getAccessToken = options.getAccessToken
  }

  async createSpreadsheet(title: string): Promise<{ readonly spreadsheetId: string }> {
    const created = parseApiResponse(
      CreateSpreadsheetResponseSchema,
      await this.#request({
        path: "",
        method: "POST",
        body: {
          properties: { title: z.string().trim().min(1).parse(title) },
          sheets: SHEET_TITLES.map((sheetTitle) => ({ properties: { title: sheetTitle } })),
        },
      }),
    )
    const data = SHEET_TITLES.map((sheetTitle) => ({
      range: `${sheetTitle}!A1:${columnLetter(SHEET_HEADERS[sheetTitle].length)}1`,
      majorDimension: "ROWS",
      values: [SHEET_HEADERS[sheetTitle]],
    }))
    await this.#request({
      path: `/${encodeURIComponent(created.spreadsheetId)}/values:batchUpdate`,
      method: "POST",
      body: { valueInputOption: "RAW", data },
    })
    return { spreadsheetId: created.spreadsheetId }
  }

  async validateSpreadsheet(spreadsheetId: string): Promise<SpreadsheetValidation> {
    const metadata = parseApiResponse(
      SpreadsheetMetadataSchema,
      await this.#request({
        path: `/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
      }),
    )
    const existingTitles = new Set(metadata.sheets.map((sheet) => sheet.properties.title))
    const issues: Array<{
      readonly sheet: (typeof SHEET_TITLES)[number]
      readonly kind: "missing_sheet" | "header_mismatch"
    }> = []

    for (const sheetTitle of SHEET_TITLES) {
      if (!existingTitles.has(sheetTitle)) {
        issues.push({ sheet: sheetTitle, kind: "missing_sheet" })
        continue
      }
      const values = parseApiResponse(
        ValuesResponseSchema,
        await this.#request({
          path: `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${sheetTitle}!1:1`)}`,
        }),
      ).values
      if (!sameCells(values?.[0] ?? [], SHEET_HEADERS[sheetTitle])) {
        issues.push({ sheet: sheetTitle, kind: "header_mismatch" })
      }
    }

    return issues.length === 0 ? { valid: true } : { valid: false, issues }
  }

  async upsertTransaction(spreadsheetId: string, transaction: ActiveTransaction): Promise<void> {
    await this.#upsert({
      spreadsheetId,
      sheetTitle: "Transactions",
      id: transaction.id,
      row: transactionRow(transaction),
    })
  }

  async #upsert(request: UpsertRequest): Promise<void> {
    const key = `${request.spreadsheetId}:${request.sheetTitle}:${request.id}`
    const previous = this.#pendingUpserts.get(key) ?? Promise.resolve()
    const current = previous.catch(() => undefined).then(() => this.#writeUpsert(request))
    this.#pendingUpserts.set(key, current)
    try {
      await current
    } finally {
      if (this.#pendingUpserts.get(key) === current) this.#pendingUpserts.delete(key)
    }
  }

  async #writeUpsert(request: UpsertRequest): Promise<void> {
    const values = parseApiResponse(
      ValuesResponseSchema,
      await this.#request({
        path: `/${encodeURIComponent(request.spreadsheetId)}/values/${encodeURIComponent(`${request.sheetTitle}!A2:A`)}`,
      }),
    ).values
    const index = values?.findIndex((existing) => existing[0] === request.id) ?? -1
    const endColumn = columnLetter(request.row.length)
    const path =
      index >= 0
        ? `/${encodeURIComponent(request.spreadsheetId)}/values/${request.sheetTitle}!A${index + 2}:${endColumn}${index + 2}?valueInputOption=RAW`
        : `/${encodeURIComponent(request.spreadsheetId)}/values/${request.sheetTitle}!A2:${endColumn}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`
    await this.#request({
      path,
      method: index >= 0 ? "PUT" : "POST",
      body: {
        range: `${request.sheetTitle}!A1:${endColumn}1`,
        majorDimension: "ROWS",
        values: [request.row],
      },
    })
  }

  async #request(request: ApiRequest): Promise<unknown> {
    const token = this.#getAccessToken()
    if (token === null || token.length === 0) throw new GoogleApiError("auth", null)

    let response: Response
    try {
      response = await this.#fetcher(`${API_ROOT}${request.path}`, {
        method: request.method ?? "GET",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      })
    } catch (error) {
      if (error instanceof GoogleApiError) throw error
      throw new GoogleApiError("transient", null)
    }

    if (!response.ok) throw new GoogleApiError(categoryForStatus(response.status), response.status)
    try {
      return await response.json()
    } catch (error) {
      if (error instanceof SyntaxError) throw new GoogleApiError("schema", response.status)
      throw error
    }
  }
}

function parseApiResponse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new GoogleApiError("schema", 200)
  return parsed.data
}

function sameCells(actual: readonly RawCell[], expected: readonly RawCell[]): boolean {
  return (
    actual.length === expected.length && actual.every((cell, index) => cell === expected[index])
  )
}

function columnLetter(columnCount: number): string {
  return String.fromCharCode(64 + columnCount)
}
