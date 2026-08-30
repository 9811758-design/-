import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ErrorBoundary } from "./ErrorBoundary"

function ThrowingChild(): never {
  throw new Error("render failed")
}

describe("ErrorBoundary", () => {
  it("preserves trust in local records and offers a recovery action", () => {
    // Given: an unexpected child-rendering failure.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)

    try {
      // When: the error boundary catches the failure.
      render(
        <ErrorBoundary>
          <ThrowingChild />
        </ErrorBoundary>,
      )

      // Then: it accurately explains local preservation and exposes recovery.
      expect(screen.getByRole("heading", { name: "화면을 불러오지 못했습니다." })).toBeTruthy()
      expect(screen.getByText(/이미 저장한 로컬 기록은 이 기기에 남아 있습니다/)).toBeTruthy()
      expect(screen.getByRole("button", { name: "화면 다시 불러오기" })).toBeTruthy()
    } finally {
      errorSpy.mockRestore()
    }
  })
})
