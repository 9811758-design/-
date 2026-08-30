import { describe, expect, it } from "vitest"
import { z } from "zod"
import { errorMessage } from "./form-values"

describe("errorMessage", () => {
  it("translates runtime schema failures without exposing internal diagnostics", () => {
    // Given: a runtime boundary rejects an invalid decimal quantity.
    const result = z.number().min(1).safeParse(0)
    if (result.success) throw new Error("테스트 입력이 유효하지 않아야 합니다.")

    // When: the UI converts the failure for a user.
    const message = errorMessage(result.error)

    // Then: it exposes a concise Korean recovery message, not raw schema JSON.
    expect(message).toBe("입력값을 확인해 주세요.")
    expect(message).not.toContain('"code"')
  })
})
