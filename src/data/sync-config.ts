import { z } from "zod"

import type { CafeLedgerDatabase } from "./database"

export const GoogleSheetsSyncConfigKeySchema = z.literal("google-sheets")
export const GoogleSheetsSyncConfigInputSchema = z
  .object({
    spreadsheetId: z.string().trim().min(1).max(500).optional(),
    lastError: z.string().trim().min(1).max(1_000).optional(),
  })
  .strict()
export const GoogleSheetsSyncConfigSchema = GoogleSheetsSyncConfigInputSchema.extend({
  key: GoogleSheetsSyncConfigKeySchema,
})

export type GoogleSheetsSyncConfigKey = z.output<typeof GoogleSheetsSyncConfigKeySchema>
export type GoogleSheetsSyncConfig = z.output<typeof GoogleSheetsSyncConfigSchema>

export class GoogleSheetsSyncConfigRepository {
  constructor(private readonly database: CafeLedgerDatabase) {}

  async get(): Promise<GoogleSheetsSyncConfig | null> {
    const config = await this.database.syncConfig.get("google-sheets")
    return config === undefined ? null : GoogleSheetsSyncConfigSchema.parse(config)
  }

  async put(rawInput: unknown): Promise<GoogleSheetsSyncConfig> {
    const input = GoogleSheetsSyncConfigInputSchema.parse(rawInput)
    const config = GoogleSheetsSyncConfigSchema.parse({ key: "google-sheets", ...input })
    await this.database.syncConfig.put(config)
    return config
  }
}
