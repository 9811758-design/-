import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { afterEach, describe, expect, it } from "vitest"

import { App } from "./App"

afterEach(cleanup)

describe("App", () => {
  it("renders the five primary mobile navigation destinations", () => {
    // Given: the application is opened at its root route.
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    )

    // When: the shell finishes rendering.

    // Then: each MVP destination is available from the bottom navigation.
    expect(screen.getByRole("navigation", { name: "주요 메뉴" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "대시보드" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "기록" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "내역" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "통계" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "설정" })).toBeTruthy()
    expect(screen.queryByRole("link", { name: "관리" })).toBeNull()
  })

  it("offers a keyboard skip link to the current main content", () => {
    // Given: a keyboard user opens the application shell.
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    )

    // When: the shell is available.
    const skipLink = screen.getByRole("link", { name: "본문으로 건너뛰기" })

    // Then: the skip destination is a focusable main landmark.
    expect(skipLink.getAttribute("href")).toBe("#main-content")
    expect(screen.getByRole("main").getAttribute("tabindex")).toBe("-1")
  })

  it("moves focus to main content after primary navigation", async () => {
    // Given: a keyboard user is on the dashboard.
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    )

    // When: the user activates a primary route.
    fireEvent.click(screen.getByRole("link", { name: "기록" }))

    // Then: the newly rendered main landmark receives focus.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("main")))
  })
})
