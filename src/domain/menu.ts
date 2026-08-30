import { z } from "zod"

import {
  IsoTimestampSchema,
  MenuIdSchema,
  SyncStatusSchema,
  SyncVersionSchema,
  WonSchema,
} from "./ledger"

/** Legacy-only schema retained so existing IndexedDB rows and queued jobs remain readable. */
export const MenuSchema = z.object({
  id: MenuIdSchema,
  name: z.string().trim().min(1).max(100),
  defaultPriceWon: WonSchema,
  favorite: z.boolean(),
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
  syncStatus: SyncStatusSchema,
  syncVersion: SyncVersionSchema,
  syncedAt: IsoTimestampSchema.optional(),
  deletedAt: IsoTimestampSchema.optional(),
  isActive: z.boolean(),
})

export type Menu = z.output<typeof MenuSchema>
