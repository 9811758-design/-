import { describe, expect, it } from "vitest"

import { SyncVersionSchema, TransactionIdSchema, TransactionSchema } from "../../domain/ledger"
import {
  type FetchLike,
  GoogleApiError,
  GoogleSheetsAdapter,
  SHEET_HEADERS,
  SHEET_TITLES,
} from "./google-sheets-adapter"

const accessToken = "access-token-that-must-stay-secret"
const transactionId = "e789ad42-0e2d-4d80-a2a5-915e2fdc4466"

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

type PurchaseOverrides = {
  readonly deletedAt?: string
  readonly syncVersion?: number
}

function purchase(overrides: PurchaseOverrides = {}) {
  const transaction = TransactionSchema.parse({
    id: TransactionIdSchema.parse(transactionId),
    transactionType: "purchase",
    occurredAt: "2026-08-30T01:00:00.000Z",
    ingredientName: '=HYPERLINK("bad")',
    quantity: "2",
    unit: "kg",
    unitPriceWon: 4_500,
    totalAmountWon: 9_000,
    vendor: "@vendor",
    memo: "+formula",
    createdAt: "2026-08-30T01:00:00.000Z",
    updatedAt: "2026-08-30T02:00:00.000Z",
    syncStatus: "pending",
    syncVersion: SyncVersionSchema.parse(Number(overrides.syncVersion ?? 3)),
    ...overrides,
  })
  if (transaction.transactionType !== "purchase") throw new Error("구매 fixture가 잘못되었습니다.")
  return transaction
}

function revenue() {
  const transaction = TransactionSchema.parse({
    id: TransactionIdSchema.parse("b631a6f8-469d-4a11-9440-8c3299e18a98"),
    transactionType: "revenue",
    businessDate: "2026-08-30",
    occurredAt: "2026-08-29T15:00:00.000Z",
    amountWon: 300_000,
    memo: "영업 마감",
    createdAt: "2026-08-30T12:00:00.000Z",
    updatedAt: "2026-08-30T12:00:00.000Z",
    syncStatus: "pending",
    syncVersion: 1,
  })
  if (transaction.transactionType !== "revenue") throw new Error("매출 fixture가 잘못되었습니다.")
  return transaction
}

describe("GoogleSheetsAdapter template", () => {
  it("creates the five-sheet template with exact RAW headers", async () => {
    // Given
    const calls: Array<{ readonly url: string; readonly init: RequestInit | undefined }> = []
    const fetcher: FetchLike = async (url, init) => {
      calls.push({ url, init })
      return calls.length === 1 ? response({ spreadsheetId: "sheet-1" }) : response({})
    }
    const adapter = new GoogleSheetsAdapter({ fetcher, getAccessToken: () => accessToken })

    // When
    const result = await adapter.createSpreadsheet("우리 카페 장부")

    // Then
    expect(result).toEqual({ spreadsheetId: "sheet-1" })
    expect(calls).toHaveLength(2)
    expect(calls[0]?.url).toBe("https://sheets.googleapis.com/v4/spreadsheets")
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      properties: { title: "우리 카페 장부" },
      sheets: Object.keys(SHEET_HEADERS).map((title) => ({ properties: { title } })),
    })
    expect(calls[1]?.url).toContain("values:batchUpdate")
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({
      valueInputOption: "RAW",
      data: Object.entries(SHEET_HEADERS).map(([title, headers]) => ({
        range: `${title}!A1:${String.fromCharCode(64 + headers.length)}1`,
        majorDimension: "ROWS",
        values: [headers],
      })),
    })
  })

  it("reports mismatched headers without writing to the spreadsheet", async () => {
    // Given
    const methods: string[] = []
    const fetcher: FetchLike = async (_url, init) => {
      methods.push(init?.method ?? "GET")
      if (methods.length === 1) {
        return response({
          sheets: Object.keys(SHEET_HEADERS).map((title) => ({ properties: { title } })),
        })
      }
      const title = SHEET_TITLES[methods.length - 2] ?? "Transactions"
      const headers = title === "Menus" ? ["wrong"] : SHEET_HEADERS[title]
      return response({ values: [headers] })
    }
    const adapter = new GoogleSheetsAdapter({ fetcher, getAccessToken: () => accessToken })

    // When
    const result = await adapter.validateSpreadsheet("sheet-1")

    // Then
    expect(result).toEqual({ valid: false, issues: [{ sheet: "Menus", kind: "header_mismatch" }] })
    expect(methods.every((method) => method === "GET")).toBe(true)
  })
})

describe("GoogleSheetsAdapter UUID upsert", () => {
  it("writes date-based revenue to the compatible Transactions sheet without legacy sale fields", async () => {
    const calls: Array<{ readonly url: string; readonly init: RequestInit | undefined }> = []
    const fetcher: FetchLike = async (url, init) => {
      calls.push({ url, init })
      return calls.length === 1 ? response({ values: [] }) : response({})
    }
    const adapter = new GoogleSheetsAdapter({ fetcher, getAccessToken: () => accessToken })

    await adapter.upsertTransaction("sheet-1", revenue())

    expect(calls[1]?.url).toContain("Transactions")
    expect(JSON.parse(String(calls[1]?.init?.body)).values[0]).toEqual([
      "b631a6f8-469d-4a11-9440-8c3299e18a98",
      "revenue",
      "2026-08-29T15:00:00.000Z",
      "일일 총매출",
      "",
      "",
      "",
      300_000,
      "",
      "",
      "영업 마감",
      "2026-08-30T12:00:00.000Z",
      "2026-08-30T12:00:00.000Z",
      "",
      1,
    ])
  })

  it("appends a missing transaction once with formula-safe RAW values", async () => {
    // Given
    const calls: Array<{ readonly url: string; readonly init: RequestInit | undefined }> = []
    const fetcher: FetchLike = async (url, init) => {
      calls.push({ url, init })
      return calls.length === 1 ? response({ values: [] }) : response({})
    }
    const adapter = new GoogleSheetsAdapter({ fetcher, getAccessToken: () => accessToken })

    // When
    await adapter.upsertTransaction("sheet-1", purchase())

    // Then
    expect(calls[1]?.url).toContain("append?valueInputOption=RAW")
    expect(JSON.parse(String(calls[1]?.init?.body)).values[0]).toEqual([
      transactionId,
      "purchase",
      "2026-08-30T01:00:00.000Z",
      '\'=HYPERLINK("bad")',
      "2",
      "kg",
      4_500,
      9_000,
      "",
      "'@vendor",
      "'+formula",
      "2026-08-30T01:00:00.000Z",
      "2026-08-30T02:00:00.000Z",
      "",
      3,
    ])
  })

  it("updates the existing UUID row and preserves soft delete as deletedAt", async () => {
    // Given
    const calls: Array<{ readonly url: string; readonly init: RequestInit | undefined }> = []
    const fetcher: FetchLike = async (url, init) => {
      calls.push({ url, init })
      return calls.length === 1 ? response({ values: [["other"], [transactionId]] }) : response({})
    }
    const adapter = new GoogleSheetsAdapter({ fetcher, getAccessToken: () => accessToken })

    // When
    await adapter.upsertTransaction(
      "sheet-1",
      purchase({ deletedAt: "2026-08-30T03:00:00.000Z", syncVersion: 4 }),
    )

    // Then
    expect(calls).toHaveLength(2)
    expect(calls[1]?.url).toContain("Transactions!A3:O3?valueInputOption=RAW")
    expect(calls[1]?.init?.method).toBe("PUT")
    expect(JSON.parse(String(calls[1]?.init?.body)).values[0][13]).toBe("2026-08-30T03:00:00.000Z")
    expect(calls.some((call) => call.init?.method === "DELETE")).toBe(false)
  })

  it("serializes concurrent upserts for the same UUID so duplicates are not introduced", async () => {
    // Given
    let stored = false
    let appendCount = 0
    const fetcher: FetchLike = async (url) => {
      if (!url.includes("valueInputOption=RAW")) {
        return response({ values: stored ? [[transactionId]] : [] })
      }
      if (url.includes(":append")) {
        appendCount += 1
        stored = true
      }
      return response({})
    }
    const adapter = new GoogleSheetsAdapter({ fetcher, getAccessToken: () => accessToken })

    // When
    await Promise.all([
      adapter.upsertTransaction("sheet-1", purchase()),
      adapter.upsertTransaction("sheet-1", purchase()),
    ])

    // Then
    expect(appendCount).toBe(1)
  })
})

describe("GoogleSheetsAdapter errors", () => {
  it.each([
    [401, "auth"],
    [429, "rate_limit"],
    [503, "transient"],
    [400, "schema"],
    [404, "permanent"],
  ] as const)("categorizes HTTP %i as %s without leaking the token", async (status, category) => {
    // Given
    const fetcher: FetchLike = async () => response({ error: { message: accessToken } }, status)
    const adapter = new GoogleSheetsAdapter({ fetcher, getAccessToken: () => accessToken })

    // When
    const request = adapter.validateSpreadsheet("sheet-1")

    // Then
    await expect(request).rejects.toMatchObject({ category, status })
    await expect(request).rejects.not.toThrow(accessToken)
    await expect(request).rejects.toBeInstanceOf(GoogleApiError)
  })
})
